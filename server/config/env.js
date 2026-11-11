'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PLACEHOLDER_SECRET = 'bc3b55be6e9fa9d1d840ef5ea839c1d1f0d2dd27e4c5c6e235a8f910c89b60a3af436bf1ee6de51ce309f248688ae06b';

/** "30m", "2h", "1d" or a plain number of seconds -> seconds */
function toSeconds(value, fallback) {
  const s = String(value || '').trim();
  const m = /^(\d+)\s*([smhd]?)$/.exec(s);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400, '': 1 }[m[2]];
  return n * unit;
}

const env = process.env;
const nodeEnv = env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(env.PORT) || 5000,
  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'veltrix_db',
  },
  jwt: {
    secret: env.JWT_SECRET || '',
    expiresInSeconds: toSeconds(env.JWT_EXPIRES_IN, 7200),
  },
  cookieSecure: String(env.COOKIE_SECURE).toLowerCase() === 'true',
  bcryptRounds: Number(env.BCRYPT_ROUNDS) || 10,
  loginMaxAttempts: Number(env.LOGIN_MAX_ATTEMPTS) || 10,
  allowSignup: String(env.ALLOW_SIGNUP === undefined ? 'true' : env.ALLOW_SIGNUP).toLowerCase() !== 'false',
  demoPassword: env.DEMO_PASSWORD || 'Veltrix#2026',
};

/** Stop with a clear message when the secret is missing or still the example value. */
function assertSecure() {
  const s = config.jwt.secret;
  if (!s || s === PLACEHOLDER_SECRET || s.length < 32) {
    const msg =
      'JWT_SECRET is missing, too short (under 32 characters) or still the example value.\n' +
      'Open server/.env and set JWT_SECRET to a long random string. To generate one run:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';
    if (config.isProduction) throw new Error(msg);
    console.warn('\n[warning] ' + msg + '\nContinuing in development mode with a temporary secret. Sign-ins will not survive a restart.\n');
    config.jwt.secret = require('crypto').randomBytes(48).toString('hex');
  }
}

module.exports = { config, assertSecure, toSeconds };
