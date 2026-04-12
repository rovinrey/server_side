// config/db.js
require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || process.env.RAILWAY_PRIVATE_DOMAIN || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || '',
    database: process.env.MYSQLDATABASE || 'capstone_db',
    port: process.env.MYSQL_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed!');
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        return;
    }
    console.log('Database connected successfully!');
    console.log('Connected as ID:', connection.threadId);
    connection.release();
});

module.exports = pool.promise();