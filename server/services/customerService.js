'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { customerDto, auditDto } = require('../utils/dto');
const { customerScope, canEditCustomer } = require('../utils/scope');
const { normEmail, normPhone, likeContains } = require('../utils/normalize');
const { parsePaging, pageMeta } = require('../utils/pagination');
const { writeAudit, maskEmail, maskPhone } = require('../utils/audit');
const { todayYmd } = require('../utils/dates');

const SORTS = {
  code: 'c.id',
  name: 'c.last_name, c.first_name',
  email: 'c.email',
  category: 'c.category',
  status: 'c.status',
  registered: 'c.registered_on',
  assigned: 'au.name',
};

const SELECT = `SELECT c.*, au.name AS assigned_name
                FROM customers c LEFT JOIN users au ON au.id = c.assigned_user_id`;

async function findVisible(user, id, conn, lock) {
  const scope = customerScope(user, 'c');
  const row = await db.one(
    `${SELECT} WHERE c.id = ?${scope.sql}${lock ? ' FOR UPDATE' : ''}`,
    [id, ...scope.params],
    conn
  );
  if (!row) throw ApiError.notFound('Customer not found.');
  return row;
}

async function list(user, q) {
  const paging = parsePaging(q, SORTS, 'registered', 'desc');
  const where = ['1 = 1'];
  const params = [];

  const text = String(q.q || '').trim().slice(0, 100);
  if (text) {
    const like = likeContains(text);
    const digits = normPhone(text);
    const parts = [
      'c.first_name LIKE ?', 'c.last_name LIKE ?', "CONCAT(c.first_name, ' ', c.last_name) LIKE ?",
      'c.email LIKE ?', 'c.customer_code LIKE ?', 'c.company LIKE ?',
    ];
    params.push(like, like, like, like, like, like);
    if (digits && digits.length >= 4) { parts.push('c.phone_normalized LIKE ?'); params.push(likeContains(digits)); }
    if (/^\d{1,9}$/.test(text)) { parts.push('c.id = ?'); params.push(Number(text)); }
    where.push('(' + parts.join(' OR ') + ')');
  }
  if (q.category) { where.push('c.category = ?'); params.push(String(q.category)); }
  if (q.status) { where.push('c.status = ?'); params.push(String(q.status)); }
  else where.push("c.status <> 'Archived'");
  if (q.from) { where.push('c.registered_on >= ?'); params.push(String(q.from)); }
  if (q.to) { where.push('c.registered_on <= ?'); params.push(String(q.to)); }
  const scope = customerScope(user, 'c');
  const clause = where.join(' AND ') + scope.sql;
  const all = [...params, ...scope.params];

  const total = await db.one(`SELECT COUNT(*) AS n FROM customers c WHERE ${clause}`, all);
  const rows = await db.query(
    `${SELECT} WHERE ${clause} ORDER BY ${paging.orderBy} LIMIT ${paging.pageSize} OFFSET ${paging.offset}`,
    all
  );
  return { items: rows.map(customerDto), meta: pageMeta(paging, total.n) };
}

async function get(user, id) {
  const row = await findVisible(user, id);
  const stats = await db.one(
    `SELECT (SELECT COUNT(*) FROM orders WHERE customer_id = ?) AS orders,
            (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = ? AND status <> 'Cancelled') AS lifetime,
            (SELECT COUNT(*) FROM interactions WHERE customer_id = ?) AS interactions`,
    [id, id, id]
  );
  return {
    ...customerDto(row),
    orderCount: stats.orders,
    lifetimeValue: Number(stats.lifetime),
    interactionCount: stats.interactions,
    canEdit: canEditCustomer(user, row),
  };
}

/**
 * Possible duplicates for the data being saved.
 *  hard: an active customer already has this email (the database refuses it too)
 *  soft: same name, or same phone with the same first or last name
 */
async function findDuplicates(data, excludeId, conn) {
  const email = normEmail(data.email);
  const phone = normPhone(data.phone);
  const exclude = excludeId || 0;

  const hard = email
    ? await db.query(`${SELECT} WHERE c.email_normalized = ? AND c.status <> 'Archived' AND c.id <> ?`, [email, exclude], conn)
    : [];

  let match = '(LOWER(c.first_name) = LOWER(?) AND LOWER(c.last_name) = LOWER(?))';
  const matchParams = [data.firstName, data.lastName];
  if (phone) {
    match += ' OR (c.phone_normalized = ? AND (LOWER(c.last_name) = LOWER(?) OR LOWER(c.first_name) = LOWER(?)))';
    matchParams.push(phone, data.lastName, data.firstName);
  }
  const soft = await db.query(
    `${SELECT} WHERE c.status <> 'Archived' AND c.id <> ? AND (${match}) LIMIT 10`,
    [exclude, ...matchParams],
    conn
  );
  const hardIds = new Set(hard.map((r) => r.id));
  return { hard: hard.map(customerDto), soft: soft.filter((r) => !hardIds.has(r.id)).map(customerDto) };
}

/** Preview used by the form while typing. Needs no write permission beyond viewing. */
async function checkDuplicates(user, data, excludeId) {
  const res = await findDuplicates(data, excludeId);
  // Employees only see matches they are allowed to see
  if (user.can('customers.view_all')) return res;
  const keep = (c) => !c.assignedUserId || c.assignedUserId === user.id || c.createdBy === user.id;
  return { hard: res.hard.filter(keep), soft: res.soft.filter(keep) };
}

async function resolveAssignee(user, requested, fallbackId, conn) {
  if (!user.can('customers.view_all')) return fallbackId; // employees cannot reassign
  if (!requested) return null;
  const u = await db.one('SELECT id FROM users WHERE id = ? AND is_active = 1', [requested], conn);
  if (!u) throw ApiError.validation({ assignedUserId: 'Choose an active employee.' });
  return u.id;
}

async function create(user, data, ctx) {
  if (!data.email && !data.phone) {
    throw ApiError.validation({ email: 'Enter an email address or a phone number.', phone: 'Enter a phone number or an email address.' });
  }
  if (data.registeredOn > todayYmd()) throw ApiError.validation({ registeredOn: 'The registration date cannot be in the future.' });

  const dup = await findDuplicates(data, 0);
  if (dup.hard.length) {
    throw ApiError.conflict('DUPLICATE_EMAIL', 'An active customer already uses this email address.', { existing: dup.hard });
  }
  if (dup.soft.length && !data.confirmDuplicate) {
    throw ApiError.conflict('POSSIBLE_DUPLICATE', 'A similar customer already exists. Check it before saving.', { existing: dup.soft });
  }

  try {
    return await db.withTransaction(async (conn) => {
      const assigned = await resolveAssignee(user, data.assignedUserId, user.id, conn);
      const res = await db.query(
        `INSERT INTO customers
           (first_name, last_name, email, email_normalized, phone, phone_normalized, company, address,
            category, status, registered_on, assigned_user_id, created_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.firstName, data.lastName, data.email, normEmail(data.email), data.phone, normPhone(data.phone),
         data.company, data.address, data.category, data.status, data.registeredOn, assigned, user.id, data.notes],
        conn
      );
      const code = 'VLX-C-' + String(res.insertId).padStart(6, '0');
      await db.query('UPDATE customers SET customer_code = ? WHERE id = ?', [code, res.insertId], conn);
      await writeAudit(ctx, { action: 'customer.create', entityType: 'customer', entityId: res.insertId, summary: 'Created customer ' + code }, conn);
      const row = await db.one(`${SELECT} WHERE c.id = ?`, [res.insertId], conn);
      return customerDto(row);
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('DUPLICATE_EMAIL', 'An active customer already uses this email address.');
    }
    throw err;
  }
}

async function update(user, id, data, ctx) {
  if (!data.email && !data.phone) {
    throw ApiError.validation({ email: 'Enter an email address or a phone number.', phone: 'Enter a phone number or an email address.' });
  }
  if (data.registeredOn > todayYmd()) throw ApiError.validation({ registeredOn: 'The registration date cannot be in the future.' });

  const dup = await findDuplicates(data, id);
  if (dup.hard.length) throw ApiError.conflict('DUPLICATE_EMAIL', 'Another active customer already uses this email address.', { existing: dup.hard });
  if (dup.soft.length && !data.confirmDuplicate) {
    throw ApiError.conflict('POSSIBLE_DUPLICATE', 'A similar customer already exists. Check it before saving.', { existing: dup.soft });
  }

  try {
    return await db.withTransaction(async (conn) => {
      const cur = await findVisible(user, id, conn, true);
      if (!canEditCustomer(user, cur)) throw ApiError.forbidden('You can only edit customers assigned to you or created by you.');
      if (cur.status === 'Archived') throw ApiError.conflict('ARCHIVED', 'Archived customers cannot be edited. Restore the customer first.');
      if (data.version && data.version !== cur.version) {
        throw ApiError.conflict('VERSION_CONFLICT', 'Someone else saved changes to this customer first. Reload to see the latest values.', { currentVersion: cur.version });
      }

      const assigned = user.can('customers.view_all') ? await resolveAssignee(user, data.assignedUserId, null, conn) : cur.assigned_user_id;
      const next = {
        first_name: data.firstName, last_name: data.lastName, email: data.email, phone: data.phone,
        company: data.company, address: data.address, category: data.category, status: data.status,
        registered_on: data.registeredOn, assigned_user_id: assigned, notes: data.notes,
      };
      const before = {}; const after = {};
      Object.keys(next).forEach((k) => {
        const a = cur[k] === undefined ? null : cur[k];
        const b = next[k] === undefined ? null : next[k];
        if (String(a === null ? '' : a) !== String(b === null ? '' : b)) {
          const mask = k === 'email' ? maskEmail : k === 'phone' ? maskPhone : (v) => v;
          before[k] = mask(a); after[k] = mask(b);
        }
      });

      const res = await db.query(
        `UPDATE customers SET first_name = ?, last_name = ?, email = ?, email_normalized = ?, phone = ?,
                phone_normalized = ?, company = ?, address = ?, category = ?, status = ?, registered_on = ?,
                assigned_user_id = ?, notes = ?, version = version + 1
         WHERE id = ? AND version = ?`,
        [data.firstName, data.lastName, data.email, normEmail(data.email), data.phone, normPhone(data.phone),
         data.company, data.address, data.category, data.status, data.registeredOn, assigned, data.notes, id, cur.version],
        conn
      );
      if (!res.affectedRows) throw ApiError.conflict('VERSION_CONFLICT', 'Someone else saved changes to this customer first. Reload to see the latest values.');

      await writeAudit(ctx, {
        action: 'customer.update', entityType: 'customer', entityId: id,
        summary: 'Updated ' + cur.customer_code + (Object.keys(after).length ? ' (' + Object.keys(after).join(', ') + ')' : ' (no field changes)'),
        before, after,
      }, conn);
      return customerDto(await db.one(`${SELECT} WHERE c.id = ?`, [id], conn));
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw ApiError.conflict('DUPLICATE_EMAIL', 'Another active customer already uses this email address.');
    throw err;
  }
}

/** Archive or restore. Customers with history are never deleted. */
async function setStatus(user, id, status, ctx) {
  try {
    return await db.withTransaction(async (conn) => {
      const cur = await findVisible(user, id, conn, true);
      if (status === 'Archived' && cur.status === 'Archived') throw ApiError.conflict('ALREADY_ARCHIVED', 'This customer is already archived.');
      if (status === 'Active' && cur.status !== 'Archived') throw ApiError.conflict('NOT_ARCHIVED', 'This customer is not archived.');

      await db.query('UPDATE customers SET status = ?, version = version + 1 WHERE id = ?', [status, id], conn);
      await writeAudit(ctx, {
        action: status === 'Archived' ? 'customer.archive' : 'customer.restore', entityType: 'customer', entityId: id,
        summary: (status === 'Archived' ? 'Archived ' : 'Restored ') + cur.customer_code,
        before: { status: cur.status }, after: { status },
      }, conn);
      return customerDto(await db.one(`${SELECT} WHERE c.id = ?`, [id], conn));
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('DUPLICATE_EMAIL', 'Another active customer now uses this email address, so this profile cannot be restored.');
    }
    throw err;
  }
}

async function history(user, id) {
  await findVisible(user, id);
  const rows = await db.query(
    `SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.entity_type = 'customer' AND a.entity_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 100`,
    [id]
  );
  return rows.map(auditDto);
}

// ---- Duplicate review and merge --------------------------------------------

const PAIR_SQL = `
  FROM customers a
  JOIN customers b ON a.id < b.id
  LEFT JOIN duplicate_reviews dr ON dr.customer_a_id = a.id AND dr.customer_b_id = b.id
  WHERE a.status <> 'Archived' AND b.status <> 'Archived' AND dr.id IS NULL
    AND ( (a.email_normalized IS NOT NULL AND a.email_normalized = b.email_normalized)
       OR (LOWER(a.first_name) = LOWER(b.first_name) AND LOWER(a.last_name) = LOWER(b.last_name))
       OR (a.phone_normalized IS NOT NULL AND a.phone_normalized = b.phone_normalized
           AND (LOWER(a.last_name) = LOWER(b.last_name) OR LOWER(a.first_name) = LOWER(b.first_name))) )`;

async function duplicatePairs() {
  const pairs = await db.query(
    `SELECT a.id AS a_id, b.id AS b_id,
       CASE WHEN a.email_normalized IS NOT NULL AND a.email_normalized = b.email_normalized THEN 'Same email'
            WHEN LOWER(a.first_name) = LOWER(b.first_name) AND LOWER(a.last_name) = LOWER(b.last_name) THEN 'Same name'
            WHEN LOWER(a.last_name) = LOWER(b.last_name) THEN 'Same phone and last name'
            ELSE 'Same phone and first name' END AS reason
     ${PAIR_SQL} ORDER BY a.id, b.id LIMIT 100`
  );
  if (!pairs.length) return [];
  const ids = Array.from(new Set(pairs.flatMap((p) => [p.a_id, p.b_id])));
  const marks = ids.map(() => '?').join(',');
  const rows = await db.query(`${SELECT} WHERE c.id IN (${marks})`, ids);
  const counts = await db.query(`SELECT customer_id, COUNT(*) AS n FROM orders WHERE customer_id IN (${marks}) GROUP BY customer_id`, ids);
  const byId = {};
  rows.forEach((r) => { byId[r.id] = customerDto(r); });
  const orderCount = {};
  counts.forEach((c) => { orderCount[c.customer_id] = c.n; });
  return pairs.map((p) => ({
    reason: p.reason,
    a: { ...byId[p.a_id], orderCount: orderCount[p.a_id] || 0 },
    b: { ...byId[p.b_id], orderCount: orderCount[p.b_id] || 0 },
  }));
}

async function countDuplicatePairs() {
  const row = await db.one(`SELECT COUNT(*) AS n ${PAIR_SQL}`);
  return row.n;
}

async function dismissDuplicate(user, aId, bId, ctx) {
  if (aId === bId) throw ApiError.badRequest('Choose two different customers.');
  const [a, b] = aId < bId ? [aId, bId] : [bId, aId];
  await db.withTransaction(async (conn) => {
    const found = await db.query('SELECT id FROM customers WHERE id IN (?, ?)', [a, b], conn);
    if (found.length !== 2) throw ApiError.notFound('One of the customers was not found.');
    await db.query(
      `INSERT INTO duplicate_reviews (customer_a_id, customer_b_id, decision, decided_by) VALUES (?, ?, 'different', ?)
       ON DUPLICATE KEY UPDATE decision = 'different', decided_by = VALUES(decided_by), decided_at = UTC_TIMESTAMP()`,
      [a, b, user.id],
      conn
    );
    await writeAudit(ctx, { action: 'duplicate.dismiss', entityType: 'customer', entityId: a, summary: 'Marked customers ' + a + ' and ' + b + ' as different people' }, conn);
  });
}

/**
 * Merge two profiles. Only runs when an authorised person asks for it. Orders and
 * interactions move to the kept profile; the other profile is archived (not deleted)
 * and points to the kept one.
 */
async function merge(user, keepId, mergeId, ctx) {
  if (keepId === mergeId) throw ApiError.badRequest('Choose two different customers.');
  return db.withTransaction(async (conn) => {
    const [first, second] = keepId < mergeId ? [keepId, mergeId] : [mergeId, keepId];
    // Lock in id order so two merges cannot deadlock each other
    const rows = await db.query('SELECT * FROM customers WHERE id IN (?, ?) ORDER BY id FOR UPDATE', [first, second], conn);
    if (rows.length !== 2) throw ApiError.notFound('One of the customers was not found.');
    const keep = rows.find((r) => r.id === keepId);
    const drop = rows.find((r) => r.id === mergeId);
    if (keep.status === 'Archived' || drop.status === 'Archived') throw ApiError.conflict('ARCHIVED', 'Archived customers cannot be merged.');

    const o = await db.query('UPDATE orders SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId], conn);
    const i = await db.query('UPDATE interactions SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId], conn);
    await db.query("UPDATE customers SET status = 'Archived', merged_into_id = ?, version = version + 1 WHERE id = ?", [keepId, mergeId], conn);
    await db.query(
      `INSERT INTO duplicate_reviews (customer_a_id, customer_b_id, decision, decided_by) VALUES (?, ?, 'merged', ?)
       ON DUPLICATE KEY UPDATE decision = 'merged', decided_by = VALUES(decided_by), decided_at = UTC_TIMESTAMP()`,
      [first, second, user.id],
      conn
    );
    await writeAudit(ctx, {
      action: 'customer.merge', entityType: 'customer', entityId: keepId,
      summary: 'Merged ' + drop.customer_code + ' into ' + keep.customer_code + ' (' + o.affectedRows + ' orders, ' + i.affectedRows + ' interactions moved)',
      before: { archived: drop.customer_code }, after: { kept: keep.customer_code },
    }, conn);
    return { keptId: keepId, archivedId: mergeId, ordersMoved: o.affectedRows, interactionsMoved: i.affectedRows };
  });
}

module.exports = {
  list, get, create, update, setStatus, history, checkDuplicates,
  duplicatePairs, countDuplicatePairs, dismissDuplicate, merge, findVisible,
};
