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
    host: process.env.DB_HOST || process.env.MYSQL_HOST || process.env.RAILWAY_PRIVATE_DOMAIN || 'localhost',
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'capstone_db',
    port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
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