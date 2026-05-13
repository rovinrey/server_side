#!/usr/bin/env node
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  let connection;
  try {
    const name = process.env.ADMIN_NAME || 'System Admin';
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const phone = process.env.ADMIN_PHONE || null;

    if (!email || !password) {
      throw new Error(
        'MISSING REQUIRED VARS: Please set ADMIN_EMAIL and ADMIN_PASSWORD in Railway Variables.'
      );
    }

    if (!process.env.MYSQL_PUBLIC_URL) {
      throw new Error('MYSQL_PUBLIC_URL not found. Ensure your MySQL service is linked.');
    }

    const dbUrl = new URL(process.env.MYSQL_PUBLIC_URL);
    dbUrl.searchParams.set('charset', 'utf8mb4');

    console.log('✓ Connecting to MySQL...');
    connection = await mysql.createConnection(dbUrl.toString());

    const [existing] = await connection.execute(
      'SELECT user_id FROM users WHERE role = ? OR email = ?',
      ['admin', email]
    );

    const hash = await bcrypt.hash(password, 12);

    if (existing.length > 0) {
      console.log('🔄 Admin/Email already exists. Updating credentials...');
      await connection.query(
        'UPDATE users SET user_name = ?, password = ?, email = ? WHERE user_id = ?',
        [name, hash, email, existing[0].user_id]
      );
    } else {
      console.log('✨ Creating new admin account...');
      await connection.query(
        `INSERT INTO users (user_name, email, phone, password, role)
         VALUES (?, ?, ?, ?, ?)`,
        [name, email, phone, hash, 'admin']
      );
    }

    const [verify] = await connection.execute(
      'SELECT user_id, LENGTH(password) as len FROM users WHERE email = ?',
      [email]
    );

    console.log(`✅ Success! Stored hash length: ${verify[0].len}`);
    console.log(`📄 Admin ID: ${verify[0].user_id}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

createAdmin();

