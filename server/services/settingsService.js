'use strict';

const os = require('os');
const db = require('../config/db');
const { writeAudit } = require('../utils/audit');
const { toIso } = require('../utils/dates');

async function get() {
  const rows = await db.query('SELECT setting_key, setting_value FROM system_settings');
  const m = {};
  rows.forEach((r) => { m[r.setting_key] = r.setting_value; });
  return {
    companyName: m.company_name || 'Veltrix',
    currency: m.currency || 'KES',
    reminderDays: parseInt(m.reminder_days, 10) || 2,
  };
}

async function update(data, ctx) {
  const before = await get();
  await db.withTransaction(async (conn) => {
    const pairs = [['company_name', data.companyName], ['currency', data.currency], ['reminder_days', String(data.reminderDays)]];
    for (const [k, v] of pairs) {
      await db.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [k, v],
        conn
      );
    }
    await writeAudit(ctx, {
      action: 'settings.update', entityType: 'settings', summary: 'Updated system preferences',
      before: { currency: before.currency, reminderDays: before.reminderDays, companyName: before.companyName },
      after: { currency: data.currency, reminderDays: data.reminderDays, companyName: data.companyName },
    }, conn);
  });
  return get();
}

/** Counts and recent errors for the administrator. No credentials, no stack traces. */
async function health() {
  const started = Date.now();
  await db.query('SELECT 1');
  const dbMs = Date.now() - started;

  const counts = await db.one(
    `SELECT (SELECT COUNT(*) FROM customers) AS customers,
            (SELECT COUNT(*) FROM interactions) AS interactions,
            (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COUNT(*) FROM audit_logs) AS auditEntries,
            (SELECT COUNT(*) FROM users WHERE is_active = 1) AS activeUsers,
            (SELECT COUNT(*) FROM interactions WHERE follow_up_date < UTC_DATE() AND follow_up_done = 0) AS overdueFollowUps`
  );
  const errors = await db.query('SELECT request_id, status_code, method, path, message, created_at FROM error_logs ORDER BY id DESC LIMIT 15');
  const version = await db.one('SELECT VERSION() AS v');

  return {
    database: { reachable: true, responseMs: dbMs, version: version.v },
    server: { node: process.version, uptimeSeconds: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576), platform: os.platform() },
    counts,
    recentErrors: errors.map((e) => ({
      requestId: e.request_id, status: e.status_code, method: e.method, path: e.path, message: e.message, at: toIso(e.created_at),
    })),
  };
}

module.exports = { get, update, health };
