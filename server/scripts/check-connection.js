'use strict';

// Quick check that Node can reach MySQL with the settings in server/.env
// Run from the server folder:  npm run db:check
const { config } = require('../config/env');
const db = require('../config/db');

(async () => {
  console.log('Trying ' + config.db.user + '@' + config.db.host + ':' + config.db.port + ' / ' + config.db.database + ' ...');
  try {
    const v = await db.one('SELECT VERSION() AS v');
    console.log('Connected. Server version: ' + v.v);
    const tables = await db.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [config.db.database]);
    console.log('Tables in ' + config.db.database + ': ' + tables[0].n + (tables[0].n >= 15 ? ' (looks right)' : ' (expected 15; import database/schema.sql)'));
    const users = await db.one('SELECT COUNT(*) AS n FROM users').catch(() => null);
    if (users) console.log('Users: ' + users.n + (users.n ? '' : ' (import database/seed.sql for demo accounts)'));
  } catch (err) {
    console.error('Failed: ' + (err.code || '') + ' ' + err.message);
    if (err.code === 'ECONNREFUSED') console.error('MySQL is not running on that port. Start it in the XAMPP Control Panel and check DB_PORT.');
    if (err.code === 'ER_ACCESS_DENIED_ERROR') console.error('Wrong DB_USER or DB_PASSWORD.');
    if (err.code === 'ER_BAD_DB_ERROR') console.error('Database not found. Import database/schema.sql first.');
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
