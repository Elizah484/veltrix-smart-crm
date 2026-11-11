'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { interactionDto } = require('../utils/dto');
const { customerScope } = require('../utils/scope');
const { likeContains } = require('../utils/normalize');
const { parsePaging, pageMeta } = require('../utils/pagination');
const { writeAudit } = require('../utils/audit');
const { notify, managerIds } = require('../utils/notify');
const { toSqlDateTime, todayYmd, toIso } = require('../utils/dates');

const SORTS = {
  at: 'i.occurred_at',
  customer: 'c.last_name, c.first_name',
  type: 'i.type',
  subject: 'i.subject',
  status: 'i.status',
  followUp: 'i.follow_up_date',
};

const SELECT = `SELECT i.*, c.first_name AS customer_first, c.last_name AS customer_last, c.customer_code,
                       u.name AS user_name, a.name AS assignee_name
                FROM interactions i
                JOIN customers c ON c.id = i.customer_id
                JOIN users u ON u.id = i.user_id
                LEFT JOIN users a ON a.id = i.follow_up_assignee_id`;

/** Employees only work with follow-ups owned by them (assignee, or author when unassigned) */
function mineClause(user) {
  if (user.can('interactions.manage_all')) return { sql: '', params: [] };
  return {
    sql: ' AND COALESCE(i.follow_up_assignee_id, i.user_id) = ?',
    params: [user.id],
  };
}

async function findVisible(user, id, conn, lock) {
  const scope = customerScope(user, 'c');
  const row = await db.one(`${SELECT} WHERE i.id = ?${scope.sql}${lock ? ' FOR UPDATE' : ''}`, [id, ...scope.params], conn);
  if (!row) throw ApiError.notFound('Interaction not found.');
  return row;
}

const canEdit = (user, row) => user.can('interactions.edit') && (user.can('interactions.manage_all') || row.user_id === user.id);

async function list(user, q) {
  const paging = parsePaging(q, SORTS, 'at', 'desc');
  const where = ['1 = 1'];
  const params = [];
  const text = String(q.q || '').trim().slice(0, 100);
  if (text) {
    const like = likeContains(text);
    where.push("(i.subject LIKE ? OR i.notes LIKE ? OR CONCAT(c.first_name, ' ', c.last_name) LIKE ?)");
    params.push(like, like, like);
  }
  if (q.type) { where.push('i.type = ?'); params.push(String(q.type)); }
  if (q.status) { where.push('i.status = ?'); params.push(String(q.status)); }
  if (q.customerId) { where.push('i.customer_id = ?'); params.push(Number(q.customerId)); }
  if (q.from) { where.push('DATE(i.occurred_at) >= ?'); params.push(String(q.from)); }
  if (q.to) { where.push('DATE(i.occurred_at) <= ?'); params.push(String(q.to)); }
  const scope = customerScope(user, 'c');
  const clause = where.join(' AND ') + scope.sql;
  const all = [...params, ...scope.params];

  const total = await db.one(`SELECT COUNT(*) AS n FROM interactions i JOIN customers c ON c.id = i.customer_id WHERE ${clause}`, all);
  const rows = await db.query(
    `${SELECT} WHERE ${clause} ORDER BY ${paging.orderBy}, i.id DESC LIMIT ${paging.pageSize} OFFSET ${paging.offset}`,
    all
  );
  return { items: rows.map(interactionDto), meta: pageMeta(paging, total.n) };
}

/** Everything for one customer, newest first (used for the profile timeline) */
async function forCustomer(user, customerId) {
  const scope = customerScope(user, 'c');
  const rows = await db.query(
    `${SELECT} WHERE i.customer_id = ?${scope.sql} ORDER BY i.occurred_at DESC, i.id DESC LIMIT 200`,
    [customerId, ...scope.params]
  );
  return rows.map(interactionDto);
}

async function get(user, id) {
  const row = await findVisible(user, id);
  const hist = await db.query(
    `SELECT h.*, u.name AS user_name FROM interaction_history h JOIN users u ON u.id = h.user_id
     WHERE h.interaction_id = ? ORDER BY h.created_at DESC, h.id DESC`,
    [id]
  );
  return {
    ...interactionDto(row),
    canEdit: canEdit(user, row),
    canComplete: !!row.follow_up_date && !row.follow_up_done && (canEdit(user, row) || user.can('interactions.assign') || row.follow_up_assignee_id === user.id),
    history: hist.map((h) => ({ id: h.id, summary: h.summary, userName: h.user_name, at: toIso(h.created_at) })),
  };
}

async function resolveAssignee(user, requested, conn) {
  if (!user.can('interactions.assign') || !requested) return user.id;
  const u = await db.one('SELECT id FROM users WHERE id = ? AND is_active = 1', [requested], conn);
  if (!u) throw ApiError.validation({ followUpAssigneeId: 'Choose an active user.' });
  return u.id;
}

function checkTiming(data, existing) {
  const errors = {};
  if (data.occurredAt.getTime() > Date.now() + 60000) {
    errors.occurredAt = 'The interaction cannot be in the future. Use a follow-up date to schedule ahead.';
  }
  if (data.followUpDate) {
    const day = toSqlDateTime(data.occurredAt).slice(0, 10);
    if (data.followUpDate < day) errors.followUpDate = 'The follow-up cannot be before the interaction date.';
    else if (data.followUpDate < todayYmd() && !(existing && existing.follow_up_date === data.followUpDate)) {
      errors.followUpDate = 'Choose today or a later date.';
    }
  }
  if (Object.keys(errors).length) throw ApiError.validation(errors);
}

async function create(user, data, ctx) {
  checkTiming(data, null);
  return db.withTransaction(async (conn) => {
    const scope = customerScope(user, 'c');
    const cust = await db.one(`SELECT c.id, c.first_name, c.last_name, c.customer_code, c.status FROM customers c WHERE c.id = ?${scope.sql} FOR UPDATE`, [data.customerId, ...scope.params], conn);
    if (!cust) throw ApiError.validation({ customerId: 'Choose the customer this interaction belongs to.' });
    if (cust.status === 'Archived') throw ApiError.validation({ customerId: 'Archived customers cannot receive new interactions.' });

    const assignee = data.followUpDate ? await resolveAssignee(user, data.followUpAssigneeId, conn) : null;
    const res = await db.query(
      `INSERT INTO interactions (customer_id, type, occurred_at, user_id, subject, notes, outcome, follow_up_date, follow_up_assignee_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cust.id, data.type, toSqlDateTime(data.occurredAt), user.id, data.subject, data.notes, data.outcome, data.followUpDate, assignee, data.status],
      conn
    );
    await writeAudit(ctx, { action: 'interaction.create', entityType: 'interaction', entityId: res.insertId, summary: 'Recorded ' + data.type.toLowerCase() + ' for ' + cust.customer_code }, conn);

    const name = cust.first_name + ' ' + cust.last_name;
    if (data.type === 'Complaint') {
      const mgrs = (await managerIds(conn)).filter((id) => id !== user.id);
      await notify(mgrs, 'complaint', 'New complaint from ' + name + ': ' + data.subject, '/interactions/' + res.insertId, 'cmp-' + res.insertId, conn);
    }
    if (assignee && assignee !== user.id) {
      await notify([assignee], 'followup', 'You were assigned a follow-up: ' + data.subject + ' (' + name + ')', '/interactions/' + res.insertId, 'asg-' + res.insertId, conn);
    }
    return interactionDto(await db.one(`${SELECT} WHERE i.id = ?`, [res.insertId], conn));
  });
}

async function update(user, id, data, ctx) {
  return db.withTransaction(async (conn) => {
    const cur = await findVisible(user, id, conn, true);
    if (!canEdit(user, cur)) throw ApiError.forbidden('You can only edit interactions you recorded.');
    checkTiming(data, cur);

    const scope = customerScope(user, 'c');
    const cust = await db.one(`SELECT c.id, c.customer_code FROM customers c WHERE c.id = ?${scope.sql}`, [data.customerId, ...scope.params], conn);
    if (!cust) throw ApiError.validation({ customerId: 'Choose a customer you can access.' });

    let assignee = cur.follow_up_assignee_id;
    if (!data.followUpDate) assignee = null;
    else if (user.can('interactions.assign') && data.followUpAssigneeId) assignee = await resolveAssignee(user, data.followUpAssigneeId, conn);
    else if (!assignee) assignee = user.id;

    const next = {
      customer_id: cust.id, type: data.type, occurred_at: toSqlDateTime(data.occurredAt), subject: data.subject,
      notes: data.notes, outcome: data.outcome, follow_up_date: data.followUpDate, follow_up_assignee_id: assignee, status: data.status,
    };
    const labels = { customer_id: 'customer', type: 'type', occurred_at: 'time', subject: 'subject', notes: 'notes', outcome: 'outcome', follow_up_date: 'follow-up', follow_up_assignee_id: 'owner', status: 'status' };
    const changes = [];
    Object.keys(next).forEach((k) => {
      const a = cur[k] === null || cur[k] === undefined ? '' : String(cur[k]);
      const b = next[k] === null || next[k] === undefined ? '' : String(next[k]);
      if (a !== b) changes.push(labels[k]);
    });

    await db.query(
      `UPDATE interactions SET customer_id = ?, type = ?, occurred_at = ?, subject = ?, notes = ?, outcome = ?,
              follow_up_date = ?, follow_up_assignee_id = ?, status = ?, follow_up_done = ?
       WHERE id = ?`,
      [next.customer_id, next.type, next.occurred_at, next.subject, next.notes, next.outcome, next.follow_up_date, next.follow_up_assignee_id, next.status, next.follow_up_date ? cur.follow_up_done : 0, id],
      conn
    );
    if (changes.length) {
      await db.query('INSERT INTO interaction_history (interaction_id, user_id, summary) VALUES (?, ?, ?)', [id, user.id, 'Changed ' + changes.join(', ')], conn);
      await writeAudit(ctx, { action: 'interaction.update', entityType: 'interaction', entityId: id, summary: 'Updated interaction #' + id + ' for ' + cust.customer_code + ' (' + changes.join(', ') + ')' }, conn);
    }
    return interactionDto(await db.one(`${SELECT} WHERE i.id = ?`, [id], conn));
  });
}

async function complete(user, id, ctx) {
  return db.withTransaction(async (conn) => {
    const cur = await findVisible(user, id, conn, true);
    if (!cur.follow_up_date) throw ApiError.conflict('NO_FOLLOW_UP', 'This interaction has no follow-up to complete.');
    if (cur.follow_up_done) throw ApiError.conflict('ALREADY_DONE', 'This follow-up is already done.');
    const allowed = canEdit(user, cur) || user.can('interactions.assign') || cur.follow_up_assignee_id === user.id;
    if (!allowed) throw ApiError.forbidden('You cannot complete this follow-up.');

    await db.query("UPDATE interactions SET follow_up_done = 1, status = 'Completed' WHERE id = ?", [id], conn);
    await db.query('INSERT INTO interaction_history (interaction_id, user_id, summary) VALUES (?, ?, ?)', [id, user.id, 'Follow-up marked done'], conn);
    await db.query("UPDATE notifications SET is_read = 1 WHERE dedupe_key IN (?, ?)", ['ov-' + id, 'up-' + id], conn);
    await writeAudit(ctx, { action: 'interaction.complete', entityType: 'interaction', entityId: id, summary: 'Completed follow-up for interaction #' + id }, conn);
    return interactionDto(await db.one(`${SELECT} WHERE i.id = ?`, [id], conn));
  });
}

async function assign(user, id, assigneeId, ctx) {
  return db.withTransaction(async (conn) => {
    const cur = await findVisible(user, id, conn, true);
    if (!cur.follow_up_date || cur.follow_up_done) throw ApiError.conflict('NO_OPEN_FOLLOW_UP', 'Only open follow-ups can be assigned.');
    const target = await db.one('SELECT id, name FROM users WHERE id = ? AND is_active = 1', [assigneeId], conn);
    if (!target) throw ApiError.validation({ assigneeId: 'Choose an active user.' });

    await db.query('UPDATE interactions SET follow_up_assignee_id = ? WHERE id = ?', [target.id, id], conn);
    await db.query('INSERT INTO interaction_history (interaction_id, user_id, summary) VALUES (?, ?, ?)', [id, user.id, 'Follow-up owner: ' + (cur.assignee_name || 'unassigned') + ' to ' + target.name], conn);
    await notify([target.id], 'followup', 'You were assigned a follow-up: ' + cur.subject, '/interactions/' + id, 'asg-' + id + '-' + target.id, conn);
    await writeAudit(ctx, { action: 'interaction.assign', entityType: 'interaction', entityId: id, summary: 'Assigned follow-up #' + id + ' to ' + target.name }, conn);
    return interactionDto(await db.one(`${SELECT} WHERE i.id = ?`, [id], conn));
  });
}

/** Follow-up lists for the three tabs, plus counts for every tab */
async function followUps(user, state) {
  const scope = customerScope(user, 'c');
  const mine = mineClause(user);
  const base = ` FROM interactions i JOIN customers c ON c.id = i.customer_id WHERE i.follow_up_date IS NOT NULL${scope.sql}${mine.sql}`;
  const bp = [...scope.params, ...mine.params];

  const counts = await db.one(
    `SELECT SUM(i.follow_up_done = 0 AND i.follow_up_date < UTC_DATE()) AS overdue,
            SUM(i.follow_up_done = 0 AND i.follow_up_date >= UTC_DATE()) AS upcoming,
            SUM(i.follow_up_done = 1) AS done ${base}`,
    bp
  );

  const conds = {
    overdue: 'AND i.follow_up_done = 0 AND i.follow_up_date < UTC_DATE() ORDER BY i.follow_up_date ASC, i.id ASC',
    upcoming: 'AND i.follow_up_done = 0 AND i.follow_up_date >= UTC_DATE() ORDER BY i.follow_up_date ASC, i.id ASC',
    done: 'AND i.follow_up_done = 1 ORDER BY i.updated_at DESC, i.id DESC',
  };
  const rows = await db.query(
    `${SELECT} WHERE i.follow_up_date IS NOT NULL${scope.sql}${mine.sql} ${conds[state]} LIMIT 100`,
    bp
  );
  return {
    items: rows.map(interactionDto),
    counts: { overdue: Number(counts.overdue) || 0, upcoming: Number(counts.upcoming) || 0, done: Number(counts.done) || 0 },
  };
}

module.exports = { list, forCustomer, get, create, update, complete, assign, followUps, mineClause };
