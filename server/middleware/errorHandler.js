'use strict';

const { config } = require('../config/env');
const db = require('../config/db');
const ApiError = require('../utils/ApiError');

/** Translate low-level database errors into messages that are safe to show. */
function fromDatabaseError(err) {
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return new ApiError(409, 'DUPLICATE', 'A record with the same unique value already exists.');
    case 'ER_NO_REFERENCED_ROW_2':
    case 'ER_NO_REFERENCED_ROW':
      return new ApiError(409, 'MISSING_REFERENCE', 'This record refers to something that no longer exists.');
    case 'ER_ROW_IS_REFERENCED_2':
    case 'ER_ROW_IS_REFERENCED':
      return new ApiError(409, 'IN_USE', 'This record is in use by other records, so it cannot be removed. Archive it instead.');
    case 'ER_LOCK_DEADLOCK':
    case 'ER_LOCK_WAIT_TIMEOUT':
      return new ApiError(409, 'BUSY', 'Another change was happening at the same time. Please try again.');
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ETIMEDOUT':
    case 'ER_CON_COUNT_ERROR':
      return new ApiError(503, 'DATABASE_UNAVAILABLE', 'The database is not reachable right now. Please try again shortly.');
    default:
      return null;
  }
}

/** Save a sanitized line in error_logs. Never throws. */
async function recordError(req, status, message) {
  try {
    await db.query(
      'INSERT INTO error_logs (request_id, status_code, method, path, message) VALUES (?, ?, ?, ?, ?)',
      [req.id || null, status, String(req.method || '').slice(0, 10), String(req.path || '').slice(0, 200), String(message).slice(0, 300)]
    );
  } catch (e) {
    /* logging must never break the response */
  }
}

function notFound(req, res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', 'That address does not exist.'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let apiErr;

  if (err instanceof ApiError) apiErr = err;
  else if (err && err.type === 'entity.parse.failed') apiErr = ApiError.badRequest('The request body is not valid JSON.');
  else if (err && err.type === 'entity.too.large') apiErr = new ApiError(413, 'TOO_LARGE', 'The request is too large.');
  else if (err && err.code && fromDatabaseError(err)) apiErr = fromDatabaseError(err);

  const status = apiErr ? apiErr.status : 500;

  if (status >= 500) {
    // The real cause goes to the server console only. The browser gets a generic message.
    console.error('[' + (req.id || '-') + '] ' + req.method + ' ' + req.path + ' -> ' + (err && err.code ? err.code + ': ' : '') + (err && err.message));
    if (!config.isProduction && err && err.stack) console.error(err.stack);
  }
  if (status >= 400 && status !== 401 && status !== 404) recordError(req, status, apiErr ? apiErr.message : 'Unexpected server error');

  const body = {
    success: false,
    error: {
      code: apiErr ? apiErr.code : 'SERVER_ERROR',
      message: apiErr ? apiErr.message : 'Something went wrong on the server. Please try again, and contact an administrator if it keeps happening.',
      requestId: req.id || null,
    },
  };
  if (apiErr && apiErr.extra) Object.assign(body.error, apiErr.extra);
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
