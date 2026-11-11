'use strict';

const db = require('../config/db');

/**
 * Create in-app notifications. A dedupeKey makes the call safe to repeat: the
 * database ignores a second notification with the same key for the same user.
 */
async function notify(userIds, type, message, link, dedupeKey, conn) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  for (const uid of unique) {
    await db.query(
      `INSERT IGNORE INTO notifications (user_id, type, message, link, dedupe_key)
       VALUES (?, ?, ?, ?, ?)`,
      [uid, type, String(message).slice(0, 300), link || null, dedupeKey || null],
      conn
    );
  }
}

/** Ids of active managers and administrators */
async function managerIds(conn) {
  const rows = await db.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = 1 AND r.code IN ('admin', 'manager')`,
    [],
    conn
  );
  return rows.map((r) => r.id);
}

module.exports = { notify, managerIds };
