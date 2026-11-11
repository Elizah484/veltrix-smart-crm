'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { orderDto, orderItemDto, historyDto } = require('../utils/dto');
const { customerScope } = require('../utils/scope');
const { likeContains } = require('../utils/normalize');
const { parsePaging, pageMeta } = require('../utils/pagination');
const { writeAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { toSqlDateTime } = require('../utils/dates');
const { toCents, centsToDecimal, calcTotals } = require('../utils/money');
const { allowedNext, NEXT } = require('../utils/orderRules');

const SORTS = {
  code: 'o.id',
  customer: 'c.last_name, c.first_name',
  date: 'o.order_date',
  status: 'o.status',
  pay: 'o.payment_status',
  total: 'o.total_amount',
};

const SELECT = `SELECT o.*, c.first_name AS customer_first, c.last_name AS customer_last, c.customer_code,
                       u.name AS created_by_name,
                       (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
                FROM orders o
                JOIN customers c ON c.id = o.customer_id
                JOIN users u ON u.id = o.created_by`;

async function findVisible(user, id, conn, lock) {
  const scope = customerScope(user, 'c');
  const row = await db.one(`${SELECT} WHERE o.id = ?${scope.sql}${lock ? ' FOR UPDATE' : ''}`, [id, ...scope.params], conn);
  if (!row) throw ApiError.notFound('Order not found.');
  return row;
}

async function list(user, q) {
  const paging = parsePaging(q, SORTS, 'date', 'desc');
  const where = ['1 = 1'];
  const params = [];
  const text = String(q.q || '').trim().slice(0, 100);
  if (text) {
    const like = likeContains(text);
    where.push("(o.order_code LIKE ? OR CONCAT(c.first_name, ' ', c.last_name) LIKE ?)");
    params.push(like, like);
  }
  if (q.status) { where.push('o.status = ?'); params.push(String(q.status)); }
  if (q.payment) { where.push('o.payment_status = ?'); params.push(String(q.payment)); }
  if (q.customerId) { where.push('o.customer_id = ?'); params.push(Number(q.customerId)); }
  if (q.from) { where.push('DATE(o.order_date) >= ?'); params.push(String(q.from)); }
  if (q.to) { where.push('DATE(o.order_date) <= ?'); params.push(String(q.to)); }
  const scope = customerScope(user, 'c');
  const clause = where.join(' AND ') + scope.sql;
  const all = [...params, ...scope.params];

  const total = await db.one(`SELECT COUNT(*) AS n FROM orders o JOIN customers c ON c.id = o.customer_id WHERE ${clause}`, all);
  const rows = await db.query(
    `${SELECT} WHERE ${clause} ORDER BY ${paging.orderBy}, o.id DESC LIMIT ${paging.pageSize} OFFSET ${paging.offset}`,
    all
  );
  return { items: rows.map(orderDto), meta: pageMeta(paging, total.n) };
}

async function forCustomer(user, customerId) {
  const scope = customerScope(user, 'c');
  const rows = await db.query(
    `${SELECT} WHERE o.customer_id = ?${scope.sql} ORDER BY o.order_date DESC, o.id DESC LIMIT 200`,
    [customerId, ...scope.params]
  );
  return rows.map(orderDto);
}

async function history(orderId, conn) {
  const rows = await db.query(
    `SELECT h.*, u.name AS user_name FROM order_status_history h JOIN users u ON u.id = h.user_id
     WHERE h.order_id = ? ORDER BY h.created_at ASC, h.id ASC`,
    [orderId],
    conn
  );
  return rows.map(historyDto);
}

async function loadFull(user, id, conn) {
  const row = await findVisible(user, id, conn);
  const items = await db.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [id], conn);
  return {
    ...orderDto(row),
    items: items.map(orderItemDto),
    history: await history(id, conn),
    allowedStatuses: allowedNext(row.status, user.permissions),
    canRefund: user.can('orders.refund'),
  };
}

const get = (user, id) => loadFull(user, id);

async function getHistory(user, id) {
  await findVisible(user, id);
  return history(id);
}

/**
 * Create an order and its items in one transaction. Totals are calculated here,
 * never taken from the browser. If anything fails, nothing is saved.
 *
 * idempotencyKey: the browser sends one key per order form. Sending the same
 * key again (double click, retry after a network drop) returns the order that
 * was already created instead of creating a copy.
 */
async function create(user, data, idempotencyKey, ctx) {
  const items = data.items.map((i) => ({
    productName: i.productName,
    quantity: i.quantity,
    unitCents: toCents(i.unitPrice),
  }));
  if (items.some((i) => !Number.isInteger(i.unitCents) || i.unitCents < 1)) {
    throw ApiError.validation({ items: 'Every item needs a unit price above zero.' });
  }
  const totals = calcTotals(items, data.discountPercent);

  const replay = async () => {
    if (!idempotencyKey) return null;
    const existing = await db.one('SELECT id, created_by FROM orders WHERE idempotency_key = ?', [idempotencyKey]);
    if (!existing) return null;
    if (existing.created_by !== user.id) throw ApiError.conflict('KEY_IN_USE', 'This request id was already used by another user.');
    return { order: await loadFull(user, existing.id), replayed: true };
  };

  const before = await replay();
  if (before) return before;

  try {
    const id = await db.withTransaction(async (conn) => {
      // Lock the customer row so it cannot be archived while the order is being saved
      const scope = customerScope(user, 'c');
      const cust = await db.one(
        `SELECT c.id, c.customer_code, c.status FROM customers c WHERE c.id = ?${scope.sql} FOR UPDATE`,
        [data.customerId, ...scope.params],
        conn
      );
      if (!cust) throw ApiError.validation({ customerId: 'Choose an existing customer.' });
      if (cust.status !== 'Active') throw ApiError.conflict('CUSTOMER_NOT_ACTIVE', 'Orders can only be created for active customers.');

      const res = await db.query(
        `INSERT INTO orders (customer_id, order_date, status, payment_status, subtotal, discount_percent,
                             discount_amount, total_amount, shipping_details, idempotency_key, created_by)
         VALUES (?, ?, 'Pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cust.id, toSqlDateTime(new Date()), data.paymentStatus, centsToDecimal(totals.subtotal), data.discountPercent,
         centsToDecimal(totals.discount), centsToDecimal(totals.total), data.shippingDetails, idempotencyKey || null, user.id],
        conn
      );
      const orderId = res.insertId;
      const code = 'VLX-O-' + String(orderId).padStart(6, '0');
      await db.query('UPDATE orders SET order_code = ? WHERE id = ?', [code, orderId], conn);

      for (const it of items) {
        await db.query(
          'INSERT INTO order_items (order_id, product_name, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
          [orderId, it.productName, it.quantity, centsToDecimal(it.unitCents), centsToDecimal(it.unitCents * it.quantity)],
          conn
        );
      }
      await db.query(
        "INSERT INTO order_status_history (order_id, kind, from_value, to_value, note, user_id) VALUES (?, 'status', NULL, 'Pending', 'Order created', ?)",
        [orderId, user.id],
        conn
      );
      await writeAudit(ctx, {
        action: 'order.create', entityType: 'order', entityId: orderId,
        summary: 'Created order ' + code + ' for ' + cust.customer_code + ' (total ' + centsToDecimal(totals.total) + ')',
      }, conn);
      return orderId;
    });
    return { order: await loadFull(user, id), replayed: false };
  } catch (err) {
    // Two identical requests arrived at once: the second hit the unique key. Return the first order.
    if (err.code === 'ER_DUP_ENTRY' && idempotencyKey) {
      const again = await replay();
      if (again) return again;
    }
    throw err;
  }
}

async function setStatus(user, id, data, ctx) {
  return db.withTransaction(async (conn) => {
    const cur = await findVisible(user, id, conn, true);
    if (data.version && data.version !== cur.version) {
      throw ApiError.conflict('VERSION_CONFLICT', 'This order was changed by someone else. Reload to see the latest status.', { currentVersion: cur.version });
    }
    if (!(NEXT[cur.status] || []).includes(data.status)) {
      throw ApiError.conflict('INVALID_TRANSITION', 'An order that is ' + cur.status.toLowerCase() + ' cannot move to ' + data.status.toLowerCase() + '.');
    }
    if (!allowedNext(cur.status, user.permissions).includes(data.status)) {
      throw ApiError.forbidden('Your role cannot move an order to ' + data.status + '.');
    }

    const res = await db.query('UPDATE orders SET status = ?, version = version + 1 WHERE id = ? AND version = ?', [data.status, id, cur.version], conn);
    if (!res.affectedRows) throw ApiError.conflict('VERSION_CONFLICT', 'This order was changed by someone else. Reload to see the latest status.');

    await db.query(
      "INSERT INTO order_status_history (order_id, kind, from_value, to_value, note, user_id) VALUES (?, 'status', ?, ?, ?, ?)",
      [id, cur.status, data.status, data.note, user.id],
      conn
    );
    await notify([cur.created_by].filter((x) => x !== user.id), 'order', 'Order ' + cur.order_code + ' moved to ' + data.status, '/orders/' + id, null, conn);
    await writeAudit(ctx, {
      action: 'order.status', entityType: 'order', entityId: id,
      summary: cur.order_code + ': ' + cur.status + ' to ' + data.status, before: { status: cur.status }, after: { status: data.status },
    }, conn);
    return loadFull(user, id, conn);
  });
}

async function setPayment(user, id, data, ctx) {
  if (data.paymentStatus === 'Refunded' && !user.can('orders.refund')) {
    throw ApiError.forbidden('Only a manager or administrator can mark a payment as refunded.');
  }
  return db.withTransaction(async (conn) => {
    const cur = await findVisible(user, id, conn, true);
    if (data.version && data.version !== cur.version) {
      throw ApiError.conflict('VERSION_CONFLICT', 'This order was changed by someone else. Reload to see the latest values.', { currentVersion: cur.version });
    }
    if (cur.payment_status === data.paymentStatus) throw ApiError.conflict('UNCHANGED', 'The payment status is already ' + data.paymentStatus + '.');

    const res = await db.query('UPDATE orders SET payment_status = ?, version = version + 1 WHERE id = ? AND version = ?', [data.paymentStatus, id, cur.version], conn);
    if (!res.affectedRows) throw ApiError.conflict('VERSION_CONFLICT', 'This order was changed by someone else. Reload to see the latest values.');

    await db.query(
      "INSERT INTO order_status_history (order_id, kind, from_value, to_value, note, user_id) VALUES (?, 'payment', ?, ?, NULL, ?)",
      [id, cur.payment_status, data.paymentStatus, user.id],
      conn
    );
    await writeAudit(ctx, {
      action: 'order.payment', entityType: 'order', entityId: id,
      summary: cur.order_code + ' payment: ' + cur.payment_status + ' to ' + data.paymentStatus,
      before: { payment: cur.payment_status }, after: { payment: data.paymentStatus },
    }, conn);
    return loadFull(user, id, conn);
  });
}

module.exports = { list, forCustomer, get, getHistory, create, setStatus, setPayment };
