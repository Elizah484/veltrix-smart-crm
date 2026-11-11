'use strict';

/** Wrap an async route handler so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Every success response has the same shape: { success: true, data, meta? } */
function ok(res, data, meta, status) {
  const body = { success: true, data: data === undefined ? null : data };
  if (meta) body.meta = meta;
  return res.status(status || 200).json(body);
}

/** Who is acting, for audit entries */
const ctxOf = (req) => ({
  userId: req.user ? req.user.id : null,
  requestId: req.id || null,
  ip: req.ip || null,
});

module.exports = { asyncHandler, ok, ctxOf };
