// Robust config for both local and production
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

require('dotenv').config();


// Choose config based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const dbConfig = isProduction
    ? {
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            password: process.env.MYSQL_ROOT_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQLPORT || 3306,
        }
    : {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'capstone_db',
            port: process.env.DB_PORT || 3306,
        };

const pool = mysql.createPool(dbConfig);

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