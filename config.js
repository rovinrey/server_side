const mysql = require('mysql2/promise');
require('dotenv').config();

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

let pool;

if (isProduction) {
    // Production: Use Railway environment variables
    pool = mysql.createPool({
        host: process.env.MYSQLHOST,
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD || '',
        database: process.env.MYSQLDATABASE,
        port: parseInt(process.env.MYSQLPORT || '3306', 10),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });

    console.log('✅ [PRODUCTION] Database pool connected');
} else {
    // Development: Use local configuration
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'capstone_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });

    console.log('✅ [DEVELOPMENT] Database pool connected');
}

// Test connection
pool.getConnection()
    .then((connection) => {
        connection.release();
        console.log('✅ Database connection verified');
    })
    .catch((err) => {
        console.error('❌ Database connection failed:', err.message);
    });

module.exports = pool;