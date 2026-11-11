'use strict';

const mysql = require('mysql2/promise');
const { config } = require('./env');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  dateStrings: true, // DATE and DATETIME come back as plain strings
  decimalNumbers: true, // DECIMAL columns come back as numbers
});

// Make every connection use UTC, so NOW(), CURRENT_TIMESTAMP and UTC_DATE() agree.
if (pool.pool && typeof pool.pool.on === 'function') {
  pool.pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'", () => {});
  });
}

const clean = (params) => (params || []).map((p) => (p === undefined ? null : p));

/**
 * Run a prepared statement. Values are always passed separately from the SQL text.
 * Pass a transaction connection as the third argument to run inside a transaction.
 * Returns the rows for SELECT, or the result header for INSERT/UPDATE/DELETE.
 */
async function query(sql, params = [], conn = pool) {
  const [result] = await conn.execute(sql, clean(params));
  return result;
}

/** First row or null */
async function one(sql, params = [], conn = pool) {
  const rows = await query(sql, params, conn);
  return rows.length ? rows[0] : null;
}

/**
 * Run several statements as one unit. If the callback throws, everything it
 * wrote is rolled back and the error is re-thrown.
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      /* the connection is already gone; nothing more to undo */
    }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, one, withTransaction };
