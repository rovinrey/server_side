
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedAdmin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    // Use environment variables for credentials if available

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword) {
        console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in your environment variables.');
        await connection.end();
        process.exit(1);
    }

    try {
        // Check if admin already exists
        const [rows] = await connection.execute(
            'SELECT user_id FROM users WHERE email = ? AND role = ?',
            [adminEmail, 'admin']
        );
        if (rows.length > 0) {
            console.log('Admin user already exists. Skipping seeding.');
            return;
        }

        // Hash password securely
        const hashedPassword = await bcrypt.hash(adminPassword, 12);

        await connection.execute(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [adminEmail, hashedPassword, 'admin']
        );
        console.log('Admin user seeded successfully!');
    } catch (error) {
        console.error('Error seeding admin user:', error);
    } finally {
        await connection.end();
    }
}

seedAdmin();