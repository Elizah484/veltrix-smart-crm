'use strict';

/** An error whose message is safe to show to the person using the app. */
class ApiError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extra = extra || null; // for example { fields } or { existing }
  }

  static badRequest(message, fields) {
    return new ApiError(400, 'BAD_REQUEST', message, fields ? { fields } : null);
  }
  static validation(fields, message) {
    return new ApiError(400, 'VALIDATION_ERROR', message || 'Please correct the highlighted fields.', { fields });
  }
  static unauthorized(message, code) {
    return new ApiError(401, code || 'UNAUTHORIZED', message || 'Please sign in to continue.');
  }
  static forbidden(message) {
    return new ApiError(403, 'FORBIDDEN', message || 'You do not have permission to do that.');
  }
  static notFound(message) {
    return new ApiError(404, 'NOT_FOUND', message || 'That record was not found.');
  }
  static conflict(code, message, extra) {
    return new ApiError(409, code || 'CONFLICT', message, extra);
  }
}

module.exports = ApiError;
