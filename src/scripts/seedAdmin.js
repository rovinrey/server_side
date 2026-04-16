const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedAdmin() {
    let connection;

    try {
        // Priority: Use Railway's connection string
        const config = process.env.MYSQL_URL || {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        };

        connection = await mysql.createConnection(config);
        console.log('Connected to database...');

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            console.error('❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD in variables.');
            process.exit(1);
        }

        // 1. Check if admin exists
        const [rows] = await connection.execute(
            'SELECT user_id FROM users WHERE email = ?',
            [adminEmail]
        );

        if (rows.length > 0) {
            console.log('Admin user already exists. Skipping seeding.');
            return;
        }

        // 2. Hash and Insert (Including user_name)
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        await connection.execute(
            'INSERT INTO users (user_name, email, password, role) VALUES (?, ?, ?, ?)',
            ['System Administrator', adminEmail, hashedPassword, 'admin']
        );

        console.log('✅ Admin user seeded successfully!');
    } catch (error) {
        console.error('❌ Error seeding admin user:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

seedAdmin();