'use strict';

const db = require('../config/db');
const ApiError = require('../utils/ApiError');
const { customerScope } = require('../utils/scope');
const { customerDto } = require('../utils/dto');
const customerService = require('./customerService');

const TYPES = {
  customers: { title: 'Customer directory' },
  registrations: { title: 'Customer registrations' },
  orders: { title: 'Order report' },
  sales: { title: 'Sales summary', permission: 'reports.sales' },
  status: { title: 'Order status report' },
  interactions: { title: 'Customer interaction report' },
  followups: { title: 'Follow-up report' },
  'data-quality': { title: 'Data quality and duplicate review' },
};

const fixed = (n) => Number(n || 0).toFixed(2);

/** Builds one report. The same rules apply to the screen and to the CSV download. */
async function run(user, type, range) {
  const def = TYPES[type];
  if (!def) throw ApiError.notFound('Unknown report.');
  if (def.permission && !user.can(def.permission)) throw ApiError.forbidden('You do not have permission to open this report.');

  const scope = customerScope(user, 'c');
  const { from, to } = range;
  const dateSql = (col) => (from ? ` AND DATE(${col}) >= ?` : '') + (to ? ` AND DATE(${col}) <= ?` : '');
  const dateParams = () => [...(from ? [from] : []), ...(to ? [to] : [])];
  const out = { type, title: def.title, columns: [], rows: [], note: null };

  switch (type) {
    case 'customers': {
      const rows = await db.query(
        `SELECT c.customer_code, c.first_name, c.last_name, c.email, c.phone, c.company, c.category, c.status, c.registered_on, au.name AS assigned
         FROM customers c LEFT JOIN users au ON au.id = c.assigned_user_id
         WHERE 1 = 1${dateSql('c.registered_on')}${scope.sql} ORDER BY c.id`,
        [...dateParams(), ...scope.params]
      );
      out.columns = ['Customer ID', 'Name', 'Email', 'Phone', 'Company', 'Category', 'Status', 'Registered', 'Assigned to'];
      out.rows = rows.map((r) => [r.customer_code, r.first_name + ' ' + r.last_name, r.email, r.phone, r.company, r.category, r.status, r.registered_on, r.assigned]);
      break;
    }
    case 'registrations': {
      const rows = await db.query(
        `SELECT DATE_FORMAT(c.registered_on, '%Y-%m') AS m, COUNT(*) AS n FROM customers c
         WHERE 1 = 1${dateSql('c.registered_on')}${scope.sql} GROUP BY m ORDER BY m`,
        [...dateParams(), ...scope.params]
      );
      out.columns = ['Month', 'New customers'];
      out.rows = rows.map((r) => [r.m, r.n]);
      break;
    }
    case 'orders': {
      const rows = await db.query(
        `SELECT o.order_code, c.first_name, c.last_name, DATE(o.order_date) AS d, o.status, o.payment_status, o.subtotal, o.discount_amount, o.total_amount
         FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE 1 = 1${dateSql('o.order_date')}${scope.sql} ORDER BY o.id`,
        [...dateParams(), ...scope.params]
      );
      out.columns = ['Order', 'Customer', 'Date', 'Status', 'Payment', 'Subtotal', 'Discount', 'Total'];
      out.rows = rows.map((r) => [r.order_code, r.first_name + ' ' + r.last_name, r.d, r.status, r.payment_status, fixed(r.subtotal), fixed(r.discount_amount), fixed(r.total_amount)]);
      break;
    }
    case 'sales': {
      const rows = await db.query(
        `SELECT DATE_FORMAT(o.order_date, '%Y-%m') AS m, COUNT(*) AS n, SUM(o.subtotal) AS gross, SUM(o.discount_amount) AS disc, SUM(o.total_amount) AS net,
                SUM(CASE WHEN o.payment_status = 'Paid' THEN o.total_amount ELSE 0 END) AS paid,
                SUM(CASE WHEN o.payment_status IN ('Unpaid', 'Partially paid') THEN o.total_amount ELSE 0 END) AS outstanding
         FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE o.status <> 'Cancelled'${dateSql('o.order_date')}${scope.sql} GROUP BY m ORDER BY m`,
        [...dateParams(), ...scope.params]
      );
      out.columns = ['Month', 'Orders', 'Gross', 'Discounts', 'Net sales', 'Paid', 'Outstanding'];
      out.rows = rows.map((r) => [r.m, r.n, fixed(r.gross), fixed(r.disc), fixed(r.net), fixed(r.paid), fixed(r.outstanding)]);
      out.note = 'Cancelled orders are excluded. Amounts are in the currency chosen in Settings.';
      break;
    }
    case 'status': {
      const rows = await db.query(
        `SELECT o.status, COUNT(*) AS n, SUM(o.total_amount) AS amount FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE 1 = 1${dateSql('o.order_date')}${scope.sql} GROUP BY o.status`,
        [...dateParams(), ...scope.params]
      );
      const by = {};
      rows.forEach((r) => { by[r.status] = r; });
      out.columns = ['Order status', 'Orders', 'Value'];
      out.rows = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((s) => [s, by[s] ? by[s].n : 0, fixed(by[s] ? by[s].amount : 0)]);
      break;
    }
    case 'interactions': {
      const rows = await db.query(
        `SELECT i.type, COUNT(*) AS total, SUM(i.status = 'Open') AS open_n, SUM(i.status = 'In progress') AS inprog, SUM(i.status = 'Completed') AS done
         FROM interactions i JOIN customers c ON c.id = i.customer_id
         WHERE 1 = 1${dateSql('i.occurred_at')}${scope.sql} GROUP BY i.type`,
        [...dateParams(), ...scope.params]
      );
      const by = {};
      rows.forEach((r) => { by[r.type] = r; });
      out.columns = ['Type', 'Total', 'Open', 'In progress', 'Completed'];
      out.rows = ['Phone call', 'Email', 'In-person meeting', 'Live chat', 'Complaint', 'Follow-up', 'Other'].map((t) => {
        const r = by[t];
        return [t, r ? r.total : 0, r ? Number(r.open_n) : 0, r ? Number(r.inprog) : 0, r ? Number(r.done) : 0];
      });
      break;
    }
    case 'followups': {
      const rows = await db.query(
        `SELECT i.follow_up_date, c.first_name, c.last_name, i.subject, COALESCE(a.name, u.name) AS owner_name,
                CASE WHEN i.follow_up_done = 1 THEN 'Done' WHEN i.follow_up_date < UTC_DATE() THEN 'Overdue' ELSE 'Open' END AS state
         FROM interactions i JOIN customers c ON c.id = i.customer_id JOIN users u ON u.id = i.user_id
         LEFT JOIN users a ON a.id = i.follow_up_assignee_id
         WHERE i.follow_up_date IS NOT NULL${dateSql('i.follow_up_date')}${scope.sql} ORDER BY i.follow_up_date, i.id`,
        [...dateParams(), ...scope.params]
      );
      out.columns = ['Due', 'Customer', 'Subject', 'Owner', 'State'];
      out.rows = rows.map((r) => [r.follow_up_date, r.first_name + ' ' + r.last_name, r.subject, r.owner_name, r.state]);
      break;
    }
    case 'data-quality': {
      const pairs = await customerService.duplicatePairs();
      const gaps = await db.query(
        `SELECT 'Missing email' AS issue, c.customer_code AS record, CONCAT(c.first_name, ' ', c.last_name) AS detail FROM customers c WHERE c.status <> 'Archived' AND c.email IS NULL${scope.sql}
         UNION ALL
         SELECT 'Missing phone', c.customer_code, CONCAT(c.first_name, ' ', c.last_name) FROM customers c WHERE c.status <> 'Archived' AND c.phone IS NULL${scope.sql}
         UNION ALL
         SELECT 'No interactions', c.customer_code, CONCAT(c.first_name, ' ', c.last_name) FROM customers c
           WHERE c.status <> 'Archived'${scope.sql} AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.customer_id = c.id)`,
        [...scope.params, ...scope.params, ...scope.params]
      );
      out.columns = ['Issue', 'Record', 'Detail'];
      out.rows = pairs.map((p) => ['Possible duplicate', p.a.code + ' and ' + p.b.code, p.reason]).concat(gaps.map((g) => [g.issue, g.record, g.detail]));
      out.duplicates = pairs;
      break;
    }
    default:
      throw ApiError.notFound('Unknown report.');
  }
  return out;
}

module.exports = { run, TYPES, customerDto };
