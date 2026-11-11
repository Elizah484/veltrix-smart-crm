'use strict';

const crypto = require('crypto');

/** Give every request a short id, returned in the X-Request-Id header and saved in audit and error logs. */
module.exports = function requestId(req, res, next) {
  req.id = crypto.randomBytes(6).toString('hex');
  res.setHeader('X-Request-Id', req.id);
  next();
};
