'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { interactionDto, auditDto } = require('../utils/dto');
const { customerScope } = require('../utils/scope');
const { makeBuckets, fillBuckets, periodStart } = require('../utils/trends');
const { todayYmd } = require('../utils/dates');
const customerService = require('./customerService');
const interactionService = require('./interactionService');

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const INTERACTION_TYPES = ['Phone call', 'Email', 'In-person meeting', 'Live chat', 'Complaint', 'Follow-up', 'Other'];

function parseDays(value) {
  if (value === undefined || value === '') return 30;
  const n = Number(value);
  if (![7, 30, 90].includes(n)) throw ApiError.badRequest('days must be 7, 30 or 90.');
  return n;
}

/** Every figure below is calculated from the database each time it is requested. */
async function summary(user, q) {
  const days = parseDays(q.days);
  const since = periodStart(days, todayYmd());
  const scope = customerScope(user, 'c');
  const mine = interactionService.mineClause(user);

  const [custRow, orderRow, statusRows, typeRows, recent, upcoming, overdue, activity, dupCount] = await Promise.all([
    db.one(
      `SELECT SUM(c.status <> 'Archived') AS registered,
              SUM(c.status = 'Archived') AS archived,
              SUM(c.registered_on >= ?) AS newInPeriod
       FROM customers c WHERE 1 = 1${scope.sql}`,
      [since, ...scope.params]
    ),
    db.one(
      `SELECT COUNT(*) AS total,
              SUM(o.status = 'Pending') AS pending,
              SUM(o.status = 'Delivered') AS completed,
              SUM(o.status = 'Cancelled') AS cancelled,
              COALESCE(SUM(CASE WHEN o.payment_status = 'Paid' AND o.status <> 'Cancelled' THEN o.total_amount ELSE 0 END), 0) AS paidTotal,
              COALESCE(SUM(CASE WHEN o.payment_status IN ('Unpaid', 'Partially paid') AND o.status <> 'Cancelled' THEN o.total_amount ELSE 0 END), 0) AS unpaidTotal
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE 1 = 1${scope.sql}`,
      [...scope.params]
    ),
    db.query(
      `SELECT o.status AS k, COUNT(*) AS n FROM orders o JOIN customers c ON c.id = o.customer_id WHERE 1 = 1${scope.sql} GROUP BY o.status`,
      [...scope.params]
    ),
    db.query(
      `SELECT i.type AS k, COUNT(*) AS n FROM interactions i JOIN customers c ON c.id = i.customer_id
       WHERE DATE(i.occurred_at) >= ?${scope.sql} GROUP BY i.type`,
      [since, ...scope.params]
    ),
    db.query(
      `SELECT i.*, c.first_name AS customer_first, c.last_name AS customer_last, c.customer_code, u.name AS user_name, a.name AS assignee_name
       FROM interactions i JOIN customers c ON c.id = i.customer_id JOIN users u ON u.id = i.user_id
       LEFT JOIN users a ON a.id = i.follow_up_assignee_id
       WHERE 1 = 1${scope.sql} ORDER BY i.occurred_at DESC, i.id DESC LIMIT 5`,
      [...scope.params]
    ),
    interactionService.followUps(user, 'upcoming'),
    interactionService.followUps(user, 'overdue'),
    db.query(
      `SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
       ${user.can('audit.view') ? '' : 'WHERE a.user_id = ?'} ORDER BY a.created_at DESC, a.id DESC LIMIT 6`,
      user.can('audit.view') ? [] : [user.id]
    ),
    user.can('customers.merge') ? customerService.countDuplicatePairs() : Promise.resolve(null),
  ]);

  const byStatus = {};
  statusRows.forEach((r) => { byStatus[r.k] = r.n; });
  const byType = {};
  typeRows.forEach((r) => { byType[r.k] = r.n; });

  return {
    days,
    since,
    customers: {
      registered: Number(custRow.registered) || 0,
      archived: Number(custRow.archived) || 0,
      newInPeriod: Number(custRow.newInPeriod) || 0,
    },
    orders: {
      total: orderRow.total,
      pending: Number(orderRow.pending) || 0,
      completed: Number(orderRow.completed) || 0,
      cancelled: Number(orderRow.cancelled) || 0,
      paidTotal: Number(orderRow.paidTotal),
      unpaidTotal: Number(orderRow.unpaidTotal),
    },
    ordersByStatus: ORDER_STATUSES.map((s) => ({ label: s, value: byStatus[s] || 0 })),
    interactionsByType: INTERACTION_TYPES.map((t) => ({ label: t, value: byType[t] || 0 })),
    recentInteractions: recent.map(interactionDto),
    followUps: { counts: overdue.counts, upcoming: upcoming.items.slice(0, 5), overdue: overdue.items.slice(0, 5) },
    recentActivity: activity.map(auditDto),
    duplicatesToReview: dupCount,
  };
}

async function customerTrends(user, q) {
  const days = parseDays(q.days);
  const today = todayYmd();
  const scope = customerScope(user, 'c');
  const rows = await db.query(
    `SELECT c.registered_on AS d, COUNT(*) AS v FROM customers c
     WHERE c.registered_on >= ?${scope.sql} GROUP BY c.registered_on`,
    [periodStart(days, today), ...scope.params]
  );
  return { days, points: fillBuckets(makeBuckets(days, today), rows) };
}

async function orderTrends(user, q) {
  const days = parseDays(q.days);
  const today = todayYmd();
  const scope = customerScope(user, 'c');
  const rows = await db.query(
    `SELECT DATE(o.order_date) AS d, COUNT(*) AS n,
            COALESCE(SUM(CASE WHEN o.status <> 'Cancelled' THEN o.total_amount ELSE 0 END), 0) AS s
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE DATE(o.order_date) >= ?${scope.sql} GROUP BY DATE(o.order_date)`,
    [periodStart(days, today), ...scope.params]
  );
  return {
    days,
    orders: fillBuckets(makeBuckets(days, today), rows.map((r) => ({ d: r.d, v: r.n }))),
    sales: fillBuckets(makeBuckets(days, today), rows.map((r) => ({ d: r.d, v: r.s }))),
  };
}

module.exports = { summary, customerTrends, orderTrends };
