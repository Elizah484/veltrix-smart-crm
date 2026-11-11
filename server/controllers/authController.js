'use strict';

const { asyncHandler, ok, ctxOf } = require('../utils/http');
const { writeAudit } = require('../utils/audit');
const { validateBody } = require('../utils/validate');
const schemas = require('../validators/schemas');
const ApiError = require('../utils/ApiError');
const { config } = require('../config/env');
const authService = require('../services/authService');
const { COOKIE_NAME, signSession, cookieOptions, csrfFor } = require('../middleware/auth');

const login = asyncHandler(async (req, res) => {
  const body = validateBody(req.body, schemas.login);
  const user = await authService.login(body.email, body.password, ctxOf(req));
  const session = signSession(user.id);
  res.cookie(COOKIE_NAME, session.token, cookieOptions());
  // Same shape as /auth/me, so the browser has one code path
  ok(res, { user: await authService.describeById(user.id), csrfToken: session.csrfToken });
});

const register = asyncHandler(async (req, res) => {
  if (!config.allowSignup) throw new ApiError(403, 'SIGNUP_DISABLED', 'Self-registration is turned off. Ask an administrator for an account.');
  const body = validateBody(req.body, schemas.register);
  const user = await authService.register(body, ctxOf(req));
  // Not signed in automatically: the person signs in next, which keeps one sign-in code path.
  res.status(201).json({ success: true, data: { registered: true, user: { name: user.name, email: user.email } } });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.describeUser(req.user);
  ok(res, { user, csrfToken: csrfFor(req.session.sid) });
});

const logout = asyncHandler(async (req, res) => {
  await writeAudit(ctxOf(req), { action: 'auth.logout', entityType: 'auth', entityId: req.user.id, summary: 'Signed out' });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  ok(res, { loggedOut: true });
});

const changePassword = asyncHandler(async (req, res) => {
  const body = validateBody(req.body, schemas.changePassword);
  await authService.changePassword(req.user, body.currentPassword, body.newPassword, ctxOf(req));
  ok(res, { changed: true });
});

module.exports = { login, register, me, logout, changePassword };
