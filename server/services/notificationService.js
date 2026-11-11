'use strict';

const db = require('../config/db');
const { notificationDto } = require('../utils/dto');
const ApiError = require('../utils/ApiError');

async function list(user, { unreadOnly, limit }) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const rows = await db.query(
    `SELECT * FROM notifications WHERE user_id = ? ${unreadOnly ? 'AND is_read = 0' : ''}
     ORDER BY created_at DESC, id DESC LIMIT ${cap}`,
    [user.id]
  );
  const unread = await db.one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [user.id]);
  return { items: rows.map(notificationDto), unread: unread.n };
}

async function markRead(user, id) {
  const res = await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!res.affectedRows) throw ApiError.notFound('Notification not found.');
}

async function markAllRead(user) {
  await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [user.id]);
}

/**
 * Create in-app reminders for overdue and soon-due follow-ups. Safe to run as
 * often as you like: dedupe_key stops the same reminder being created twice.
 */
async function syncFollowUpReminders() {
  const setting = await db.one("SELECT setting_value FROM system_settings WHERE setting_key = 'reminder_days'");
  const days = Math.min(Math.max(parseInt(setting && setting.setting_value, 10) || 2, 1), 14);

  await db.query(
    `INSERT IGNORE INTO notifications (user_id, type, message, link, dedupe_key)
     SELECT u.id, 'followup',
            LEFT(CONCAT('Overdue follow-up: ', i.subject, ' (', c.first_name, ' ', c.last_name, ')'), 300),
            CONCAT('/interactions/', i.id), CONCAT('ov-', i.id)
     FROM interactions i
     JOIN customers c ON c.id = i.customer_id
     JOIN users u ON u.id = COALESCE(i.follow_up_assignee_id, i.user_id) AND u.is_active = 1
     WHERE i.follow_up_date IS NOT NULL AND i.follow_up_done = 0 AND i.follow_up_date < UTC_DATE()`
  );

  await db.query(
    `INSERT IGNORE INTO notifications (user_id, type, message, link, dedupe_key)
     SELECT u.id, 'followup',
            LEFT(CONCAT('Follow-up due ', DATE_FORMAT(i.follow_up_date, '%d %b %Y'), ': ', i.subject, ' (', c.first_name, ' ', c.last_name, ')'), 300),
            CONCAT('/interactions/', i.id), CONCAT('up-', i.id)
     FROM interactions i
     JOIN customers c ON c.id = i.customer_id
     JOIN users u ON u.id = COALESCE(i.follow_up_assignee_id, i.user_id) AND u.is_active = 1
     WHERE i.follow_up_date IS NOT NULL AND i.follow_up_done = 0
       AND i.follow_up_date >= UTC_DATE() AND i.follow_up_date <= DATE_ADD(UTC_DATE(), INTERVAL ${days} DAY)`
  );
}

module.exports = { list, markRead, markAllRead, syncFollowUpReminders };
