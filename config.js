// Robust config for both local and production
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// Determine if production
const isProduction = process.env.NODE_ENV === 'production';

console.log('🔧 Database config loading...');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set (defaulting to development)');
console.log('   MYSQL_URL available:', !!process.env.MYSQL_URL);

// Try to parse MYSQL_URL first (Railway's standard format)
let dbConfig;
if (process.env.MYSQL_URL) {
    try {
        const url = new URL(process.env.MYSQL_URL);
        const decodedPassword = decodeURIComponent(url.password || '');
        dbConfig = {
            host: url.hostname,
            user: url.username,
            password: decodedPassword,
            database: url.pathname.substring(1),
            port: url.port ? parseInt(url.port) : 3306,
        };
        console.log('✓ MYSQL_URL parsed successfully');
        console.log('  - Host:', dbConfig.host);
        console.log('  - User:', dbConfig.user);
        console.log('  - Database:', dbConfig.database);
        console.log('  - Port:', dbConfig.port);
        console.log('  - Password length:', decodedPassword.length, 'chars');
    } catch (err) {
        console.error('❌ Failed to parse MYSQL_URL:', err.message);
        dbConfig = null;
    }
}

// Fall back to individual environment variables if URL parsing failed
if (!dbConfig) {
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
['host', 'user', 'database', 'port'].forEach((key) => {
    if (!dbConfig[key]) {
        console.error(`❌ Database config error: Missing ${key} in environment variables.`);
        console.error('Debug info:', {
            hasMAYSQL_URL: !!process.env.MYSQL_URL,
            host: dbConfig.host || 'undefined',
            user: dbConfig.user || 'undefined',
            database: dbConfig.database || 'undefined',
            port: dbConfig.port || 'undefined',
        });
        process.exit(1);
    }
});

console.log('\n📋 Connection Details:');
console.log('   Host:', dbConfig.host);
console.log('   Port:', dbConfig.port);
console.log('   User:', dbConfig.user);
console.log('   Database:', dbConfig.database);
console.log('   Password: ' + '*'.repeat(Math.max(1, dbConfig.password.length)));

const pool = mysql.createPool(dbConfig);

// Test the connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed!');
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        console.error('\nDebug info:');
        console.error('- HOST:', dbConfig.host);
        console.error('- USER:', dbConfig.user);
        console.error('- PORT:', dbConfig.port);
        console.error('- DATABASE:', dbConfig.database);
        console.error('- NODE_ENV:', process.env.NODE_ENV);
        console.error('- MYSQL_URL provided:', !!process.env.MYSQL_URL);
        // Never log credentials or sensitive info
        process.exit(1);
    }
    if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Database connected successfully!');
        console.log('Connected as ID:', connection.threadId);
    }
    connection.release();
});

module.exports = pool.promise();