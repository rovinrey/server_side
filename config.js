// Robust config for both local and production
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

require('dotenv').config();


// Choose config based on NODE_ENV

const isProduction = process.env.NODE_ENV === 'production';

// If MYSQL_URL is provided, parse it
let dbConfig;
if (process.env.MYSQL_URL) {
    const url = new URL(process.env.MYSQL_URL);
    dbConfig = {
        host: url.hostname,
        user: url.username,
        password: url.password,
        database: url.pathname.substring(1),
        port: url.port || 3306,
    };
} else {
    // Fall back to individual environment variables
    dbConfig = isProduction
        ? {
            host: process.env.MYSQLHOST || process.env.MYSQL_HOST,
            user: process.env.MYSQLUSER || process.env.MYSQL_USER,
            password: process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQLPASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
        }
        : {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
        };
}

// Fail fast if any required config is missing
['host','user','password','database','port'].forEach((key) => {
    if (!dbConfig[key] && key !== 'password') { // allow empty password
        console.error(`Database config error: Missing ${key} in environment variables.`);
        process.exit(1);
    }
});

const pool = mysql.createPool(dbConfig);

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed!');
        if (err.code) console.error('Error code:', err.code);
        if (err.message) console.error('Error message:', err.message);
        // Never log credentials or sensitive info
        process.exit(1);
    }
    if (process.env.NODE_ENV !== 'production') {
        console.log('Database connected successfully!');
        console.log('Connected as ID:', connection.threadId);
    }
    connection.release();
});

module.exports = pool.promise();