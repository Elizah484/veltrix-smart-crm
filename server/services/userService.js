'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { config } = require('../config/env');
const ApiError = require('../utils/ApiError');
const { userDto } = require('../utils/dto');
const { writeAudit } = require('../utils/audit');
const { passwordProblem } = require('../utils/normalize');

const BASE = `SELECT u.id, u.name, u.email, u.is_active, u.last_login_at, u.created_at,
                     r.code AS role_code, r.name AS role_name
              FROM users u JOIN roles r ON r.id = u.role_id`;

async function list() {
  const rows = await db.query(BASE + ' ORDER BY u.is_active DESC, u.name ASC');
  return rows.map(userDto);
}

/** Active staff for dropdowns (assignees). Needs no special permission. */
async function directory() {
  const rows = await db.query(BASE + ' WHERE u.is_active = 1 ORDER BY u.name ASC');
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role_code }));
}

async function create(data, ctx) {
  const problem = passwordProblem(data.password);
  if (problem) throw ApiError.validation({ password: problem });

  const email = data.email.toLowerCase();
  const hash = await bcrypt.hash(data.password, config.bcryptRounds);

  const id = await db.withTransaction(async (conn) => {
    const taken = await db.one('SELECT id FROM users WHERE email = ?', [email], conn);
    if (taken) throw ApiError.validation({ email: 'A user with this email already exists.' });
    const role = await db.one('SELECT id FROM roles WHERE code = ?', [data.role], conn);
    const res = await db.query(
      'INSERT INTO users (name, email, password_hash, role_id, password_changed_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
      [data.name, email, hash, role.id],
      conn
    );
    await writeAudit(ctx, { action: 'user.create', entityType: 'user', entityId: res.insertId, summary: 'Created ' + data.role + ' account for ' + data.name }, conn);
    return res.insertId;
  });

  return userDto(await db.one(BASE + ' WHERE u.id = ?', [id]));
}

async function update(id, data, actor, ctx) {
  const current = await db.one(BASE + ' WHERE u.id = ?', [id]);
  if (!current) throw ApiError.notFound('User not found.');

  const changes = {};
  const before = {};
  const after = {};

  if (data.name && data.name !== current.name) { changes.name = data.name; before.name = current.name; after.name = data.name; }
  if (data.role && data.role !== current.role_code) { changes.role = data.role; before.role = current.role_code; after.role = data.role; }
  if (data.active !== null && data.active !== undefined && data.active !== !!current.is_active) { changes.active = data.active; before.active = !!current.is_active; after.active = data.active; }
  if (data.password) {
    const problem = passwordProblem(data.password);
    if (problem) throw ApiError.validation({ password: problem });
    changes.password = await bcrypt.hash(data.password, config.bcryptRounds);
    after.passwordReset = true;
  }
  if (!Object.keys(changes).length) return userDto(current);

  if (id === actor.id && (changes.role || changes.active === false)) {
    throw ApiError.conflict('SELF_CHANGE', 'You cannot change your own role or deactivate your own account.');
  }

  await db.withTransaction(async (conn) => {
    // Never leave the system without an active administrator
    const losesAdmin = current.role_code === 'admin' && current.is_active && ((changes.role && changes.role !== 'admin') || changes.active === false);
    if (losesAdmin) {
      const admins = await db.one(
        `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.code = 'admin' AND u.is_active = 1 FOR UPDATE`, [], conn);
      if (admins.n <= 1) throw ApiError.conflict('LAST_ADMIN', 'At least one active administrator is required.');
    }

    const sets = [];
    const params = [];
    if (changes.name) { sets.push('name = ?'); params.push(changes.name); }
    if (changes.role) {
      const role = await db.one('SELECT id FROM roles WHERE code = ?', [changes.role], conn);
      sets.push('role_id = ?'); params.push(role.id);
    }
    if (changes.active !== undefined) { sets.push('is_active = ?'); params.push(changes.active ? 1 : 0); }
    if (changes.password) { sets.push('password_hash = ?', 'password_changed_at = UTC_TIMESTAMP()'); params.push(changes.password); }
    params.push(id);
    await db.query('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?', params, conn);

    await writeAudit(ctx, {
      action: 'user.update', entityType: 'user', entityId: id,
      summary: 'Updated account for ' + current.name + ' (' + Object.keys(after).join(', ') + ')', before, after,
    }, conn);
  });

  return userDto(await db.one(BASE + ' WHERE u.id = ?', [id]));
}

module.exports = { list, directory, create, update };
