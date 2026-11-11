'use strict';

const db = require('../config/db');
const { auditDto } = require('../utils/dto');
const { likeContains } = require('../utils/normalize');
const { parsePaging, pageMeta } = require('../utils/pagination');

const SORTS = { at: 'a.created_at', user: 'u.name', action: 'a.action' };

/** Read-only. The API has no route that updates or deletes audit rows. */
async function list(q) {
  const paging = parsePaging(q, SORTS, 'at', 'desc', { defaultPageSize: 15 });
  const where = ['1 = 1'];
  const params = [];

  const text = String(q.q || '').trim().slice(0, 100);
  if (text) {
    const like = likeContains(text);
    where.push('(a.summary LIKE ? OR a.request_id LIKE ? OR a.entity_type LIKE ? OR CAST(a.entity_id AS CHAR) = ?)');
    params.push(like, like, like, text);
  }
  if (q.userId) { where.push('a.user_id = ?'); params.push(Number(q.userId)); }
  if (q.action) { where.push('a.action = ?'); params.push(String(q.action)); }
  if (q.entityType) { where.push('a.entity_type = ?'); params.push(String(q.entityType)); }
  if (q.entityId) { where.push('a.entity_id = ?'); params.push(Number(q.entityId)); }
  if (q.from) { where.push('DATE(a.created_at) >= ?'); params.push(String(q.from)); }
  if (q.to) { where.push('DATE(a.created_at) <= ?'); params.push(String(q.to)); }
  const clause = where.join(' AND ');

  const total = await db.one(`SELECT COUNT(*) AS n FROM audit_logs a WHERE ${clause}`, params);
  const rows = await db.query(
    `SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     WHERE ${clause} ORDER BY ${paging.orderBy}, a.id DESC LIMIT ${paging.pageSize} OFFSET ${paging.offset}`,
    params
  );
  const actions = await db.query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  return { items: rows.map(auditDto), meta: { ...pageMeta(paging, total.n), actions: actions.map((r) => r.action) } };
}

module.exports = { list };
