'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { config } = require('../config/env');
const ApiError = require('../utils/ApiError');
const { writeAudit } = require('../utils/audit');
const { passwordProblem } = require('../utils/normalize');
const { toIso } = require('../utils/dates');
const notificationService = require('./notificationService');

// A valid-looking hash used when the email does not exist, so a wrong email and
// a wrong password take about the same time to reject.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

async function safeCompare(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (e) {
    return false;
  }
}

async function login(email, password, ctx) {
  const user = await db.one(
    `SELECT u.id, u.name, u.email, u.password_hash, u.is_active, r.code AS role_code, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?`,
    [email.trim().toLowerCase()]
  );

  const valid = await safeCompare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !valid) {
    // The attempted email is not logged, only the fact that an attempt failed.
    await writeAudit(ctx, { action: 'auth.login_failed', entityType: 'auth', summary: 'Failed sign-in attempt' });
    throw ApiError.unauthorized('The email or password is not correct.', 'INVALID_CREDENTIALS');
  }
  if (!user.is_active) {
    await writeAudit({ ...ctx, userId: user.id }, { action: 'auth.login_blocked', entityType: 'auth', summary: 'Sign-in refused: account deactivated' });
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated. Contact an administrator.');
  }

  await db.query('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [user.id]);
  await writeAudit({ ...ctx, userId: user.id }, { action: 'auth.login', entityType: 'auth', entityId: user.id, summary: 'Signed in' });
  notificationService.syncFollowUpReminders().catch(() => {});

  return { id: user.id, name: user.name, email: user.email, role: user.role_code };
}

/**
 * Public self-registration. Always creates an Employee account (the lowest
 * role); an administrator can promote the person later from the Users page.
 */
async function register(data, ctx) {
  if (!data.acceptTerms) throw ApiError.validation({ acceptTerms: 'Tick the box to accept the terms and continue.' });
  const problem = passwordProblem(data.password);
  if (problem) throw ApiError.validation({ password: problem });

  const email = data.email.trim().toLowerCase();
  const hash = await bcrypt.hash(data.password, config.bcryptRounds);

  const id = await db.withTransaction(async (conn) => {
    const taken = await db.one('SELECT id FROM users WHERE email = ?', [email], conn);
    if (taken) throw ApiError.validation({ email: 'An account with this email already exists. Try signing in.' });
    const role = await db.one("SELECT id FROM roles WHERE code = 'employee'", [], conn);
    const res = await db.query(
      'INSERT INTO users (name, email, password_hash, role_id, password_changed_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
      [data.name, email, hash, role.id],
      conn
    );
    await writeAudit(
      { ...ctx, userId: res.insertId },
      { action: 'auth.register', entityType: 'user', entityId: res.insertId, summary: 'Registered an account and accepted the terms' },
      conn
    );
    return res.insertId;
  });

  return { id, name: data.name, email, role: 'employee' };
}

/** Current user plus permission codes, for the browser to decide what to show. */
async function describeUser(user) {
  const row = await db.one('SELECT last_login_at FROM users WHERE id = ?', [user.id]);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleName: user.roleName,
    permissions: Array.from(user.permissions).sort(),
    lastLoginAt: row ? toIso(row.last_login_at) : null,
  };
}

/** Same as describeUser, for a user id (used right after sign-in, before a request carries a session). */
async function describeById(userId) {
  const row = await db.one(
    `SELECT u.id, u.name, u.email, u.last_login_at, r.code AS role_code, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [userId]
  );
  const perms = await db.query(
    `SELECT p.code FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     JOIN users u ON u.role_id = rp.role_id WHERE u.id = ?`,
    [userId]
  );
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role_code,
    roleName: row.role_name,
    permissions: perms.map((p) => p.code).sort(),
    lastLoginAt: toIso(row.last_login_at),
  };
}

async function changePassword(user, currentPassword, newPassword, ctx) {
  const row = await db.one('SELECT password_hash FROM users WHERE id = ?', [user.id]);
  if (!row || !(await safeCompare(currentPassword, row.password_hash))) {
    throw ApiError.validation({ currentPassword: 'The current password is not correct.' });
  }
  const problem = passwordProblem(newPassword);
  if (problem) throw ApiError.validation({ newPassword: problem });
  if (newPassword === currentPassword) throw ApiError.validation({ newPassword: 'Choose a password different from the current one.' });

  const hash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await db.query('UPDATE users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP() WHERE id = ?', [hash, user.id]);
  await writeAudit(ctx, { action: 'auth.password_change', entityType: 'user', entityId: user.id, summary: 'Changed own password' });
}

module.exports = { login, register, describeUser, describeById, changePassword };
