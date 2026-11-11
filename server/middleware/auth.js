'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config } = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');

const COOKIE_NAME = 'vlx_token';

/** The CSRF token is derived from the session id, so no extra state is stored. */
const csrfFor = (sid) => crypto.createHmac('sha256', config.jwt.secret).update(String(sid)).digest('hex');

function signSession(userId) {
  const sid = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ sub: userId, sid }, config.jwt.secret, { expiresIn: config.jwt.expiresInSeconds });
  return { token, sid, csrfToken: csrfFor(sid) };
}

function cookieOptions() {
  return {
    httpOnly: true, // JavaScript in the browser cannot read the token
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: config.jwt.expiresInSeconds * 1000,
  };
}

/**
 * Verifies the cookie, then loads the user and their permissions from the
 * database on every request. A deactivated account or a changed role therefore
 * takes effect immediately.
 */
async function authenticate(req, res, next) {
  try {
    const token = req.cookies && req.cookies[COOKIE_NAME];
    if (!token) throw ApiError.unauthorized('Please sign in to continue.', 'NO_SESSION');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Your session expired. Please sign in again.', 'SESSION_EXPIRED');
      throw ApiError.unauthorized('Your session is not valid. Please sign in again.', 'SESSION_INVALID');
    }

    const row = await db.one(
      `SELECT u.id, u.name, u.email, u.is_active, r.code AS role_code, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      [payload.sub]
    );
    if (!row) throw ApiError.unauthorized('Your session is not valid. Please sign in again.', 'SESSION_INVALID');
    if (!row.is_active) throw ApiError.unauthorized('This account has been deactivated.', 'ACCOUNT_DISABLED');

    const perms = await db.query(
      `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       JOIN users u ON u.role_id = rp.role_id WHERE u.id = ?`,
      [row.id]
    );
    const set = new Set(perms.map((p) => p.code));

    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role_code,
      roleName: row.role_name,
      permissions: set,
      can: (code) => set.has(code),
    };
    req.session = { sid: payload.sid };
    next();
  } catch (err) {
    next(err);
  }
}

/** Use after authenticate: every permission listed must be held. */
const requirePermission = (...codes) => (req, res, next) => {
  const missing = codes.filter((c) => !req.user.can(c));
  if (missing.length) return next(ApiError.forbidden('You do not have permission to do that.'));
  next();
};

/** Use after authenticate: at least one permission listed must be held. */
const requireAny = (...codes) => (req, res, next) => {
  if (!codes.some((c) => req.user.can(c))) return next(ApiError.forbidden('You do not have permission to do that.'));
  next();
};

/**
 * Cookie-based sign-in needs CSRF protection. Requests that change data must
 * send the X-CSRF-Token header returned by /auth/login and /auth/me. A page on
 * another website cannot read that value, so it cannot forge a request.
 */
function csrfProtect(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('x-csrf-token');
  const expected = csrfFor(req.session.sid);
  const a = Buffer.from(String(sent || ''));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new ApiError(403, 'CSRF_INVALID', 'Your session could not be verified. Reload the page and try again.'));
  }
  next();
}

module.exports = { COOKIE_NAME, authenticate, requirePermission, requireAny, csrfProtect, signSession, cookieOptions, csrfFor };
