// Robust config for both local and production
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');
let envPath = '.env';
if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, '../.env.production'))) {
  envPath = path.resolve(__dirname, '../.env.production');
}
require('dotenv').config({ path: envPath });

const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'capstone_db',
    port: process.env.MYSQL_PORT || process.env.DB_PORT || 3306,
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