'use strict';

const db = require('../config/db');

const SENSITIVE = /pass|token|secret|hash|authorization|cookie/i;

/** Remove anything that looks like a secret before it is stored */
function scrub(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (!SENSITIVE.test(k)) out[k] = obj[k];
  });
  return Object.keys(out).length ? JSON.stringify(out).slice(0, 4000) : null;
}

/**
 * Append one row to the audit log. Pass the transaction connection when the
 * audited change runs in a transaction, so the log row and the change are saved
 * or rolled back together.
 *
 * entry: { action, entityType, entityId, summary, before, after }
 */
async function writeAudit(ctx, entry, conn) {
  await db.query(
    `INSERT INTO audit_logs
       (user_id, action, entity_type, entity_id, summary, before_json, after_json, request_id, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx && ctx.userId ? ctx.userId : null,
      entry.action,
      entry.entityType || null,
      entry.entityId || null,
      String(entry.summary || '').slice(0, 500),
      scrub(entry.before),
      scrub(entry.after),
      ctx && ctx.requestId ? String(ctx.requestId).slice(0, 40) : null,
      ctx && ctx.ip ? String(ctx.ip).slice(0, 45) : null,
    ],
    conn
  );
}

/** Mask personal data in before/after values */
const maskEmail = (e) => (e ? String(e).replace(/^(.).*(@.*)$/, '$1***$2') : e);
const maskPhone = (p) => (p ? '***' + String(p).replace(/\D/g, '').slice(-3) : p);

module.exports = { writeAudit, scrub, maskEmail, maskPhone };
