'use strict';

// Gives the four demo accounts from database/seed.sql a real password hash.
// Run from the server folder:  npm run seed:passwords
const bcrypt = require('bcryptjs');
const { config } = require('../config/env');
const db = require('../config/db');

const EMAILS = ['admin@veltrix.test', 'manager@veltrix.test', 'employee@veltrix.test', 'kevin@veltrix.test'];

(async () => {
  try {
    const hash = await bcrypt.hash(config.demoPassword, config.bcryptRounds);
    let updated = 0;
    for (const email of EMAILS) {
      const res = await db.query('UPDATE users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP() WHERE email = ?', [hash, email]);
      updated += res.affectedRows;
    }
    if (!updated) {
      console.error('No demo accounts found. Import database/seed.sql first, then run this again.');
      process.exitCode = 1;
    } else {
      console.log('Set the demo password on ' + updated + ' account(s).');
      console.log('Sign in with admin@veltrix.test / manager@veltrix.test / employee@veltrix.test and the password from DEMO_PASSWORD in server/.env.');
      console.log('These accounts are for development only. Change or deactivate them before real use.');
    }
  } catch (err) {
    console.error('Could not update the accounts: ' + (err.code || err.message));
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
