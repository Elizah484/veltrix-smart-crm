'use strict';

const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

function handler(message) {
  return (req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message, requestId: req.id || null },
    });
}

/** Sign-in attempts per IP address */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.loginMaxAttempts,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler('Too many sign-in attempts. Wait 15 minutes and try again.'),
});

/** General protection for the whole API */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler('You are sending requests too quickly. Wait a moment and try again.'),
});

module.exports = { loginLimiter, apiLimiter };
