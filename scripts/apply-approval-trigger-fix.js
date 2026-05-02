/**
 * Drops auto-enrollment trigger so only POST /api/beneficiaries/enroll assigns program slots.
 * Run from backend/: node scripts/apply-approval-trigger-fix.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'capstone_db',
    multipleStatements: true,
  });
  await c.query('DROP TRIGGER IF EXISTS after_application_approval');
  console.log('Dropped trigger after_application_approval (admin-driven enrollment only).');
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
