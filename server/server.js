'use strict';

const { config, assertSecure } = require('./config/env');

assertSecure();

const app = require('./app');
const db = require('./config/db');
const notificationService = require('./services/notificationService');

function explainDbError(err) {
  const where = config.db.host + ':' + config.db.port;
  switch (err.code) {
    case 'ECONNREFUSED':
      return 'Cannot reach MySQL at ' + where + '.\n' +
        '  1. Open the XAMPP Control Panel and click Start next to MySQL.\n' +
        '  2. Check the Port shown there matches DB_PORT in server/.env (default 3306).';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'MySQL refused the username or password.\n' +
        '  Check DB_USER and DB_PASSWORD in server/.env. XAMPP\'s root user has an empty password by default.';
    case 'ER_BAD_DB_ERROR':
      return 'The database "' + config.db.database + '" does not exist yet.\n' +
        '  Import database/schema.sql in phpMyAdmin (see README, step "Create the database").';
    case 'ER_NO_SUCH_TABLE':
      return 'The database exists but its tables are missing. Import database/schema.sql in phpMyAdmin.';
    default:
      return 'Database error: ' + (err.code || err.message);
  }
}

async function start() {
  try {
    await db.query('SELECT 1');
    await db.query('SELECT COUNT(*) AS n FROM roles');
  } catch (err) {
    console.error('\nVeltrix could not start.\n' + explainDbError(err) + '\n');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log('Veltrix API running at http://localhost:' + config.port + '/api  (' + config.nodeEnv + ')');
    console.log('Database: ' + config.db.database + ' at ' + config.db.host + ':' + config.db.port);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('\nPort ' + config.port + ' is already in use.\n  Close the other program, or set a different PORT in server/.env\n  (and update the proxy target in client/vite.config.js to match).\n');
    } else {
      console.error('\nServer error: ' + err.message + '\n');
    }
    process.exit(1);
  });

  // Follow-up reminders: at start-up, then every 15 minutes
  const sync = () => notificationService.syncFollowUpReminders().catch((e) => console.error('Reminder sync failed: ' + (e.code || e.message)));
  sync();
  setInterval(sync, 15 * 60 * 1000).unref();

  const shutdown = () => {
    server.close(() => db.pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection: ' + (reason && reason.message ? reason.message : reason));
});

// Vercel imports this Express app as a serverless function. Keep the listener
// and recurring reminder worker for local development only.
if (require.main === module) start();

module.exports = app;
