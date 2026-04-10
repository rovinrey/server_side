// config/db.js
require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', // or your MySQL username
    password: process.env.DB_PASSWORD || '', // or your MySQL password
    database: process.env.DB_NAME || 'capstone_db', // your actual database name
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:');
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        console.error('Make sure MySQL is running and credentials are correct');
        return;
    }
    console.log('✅ Database connected successfully');
    console.log('Connected as ID:', connection.threadId);
    connection.release();
});

module.exports = pool.promise();