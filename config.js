// ============================================================================
// DATABASE CONFIGURATION - Works for both Development & Production
// ============================================================================
const mysql = require('mysql2');
require('dotenv').config();

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';

console.log(`\n🔧 Initializing database config for ${NODE_ENV.toUpperCase()} environment\n`);

// ============================================================================
// DATABASE CONFIGURATION LOGIC
// ============================================================================
let dbConfig;

// Strategy 1: Try to parse MYSQL_URL (Railway production or local override)
if (process.env.MYSQL_URL) {
    try {
        const url = new URL(process.env.MYSQL_URL);
        dbConfig = {
            host: url.hostname,
            user: url.username,
            password: decodeURIComponent(url.password || ''),
            database: url.pathname.substring(1) || 'railway',
            port: url.port ? parseInt(url.port) : 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        };
        console.log('✓ Using MYSQL_URL configuration');
    } catch (error) {
        console.error('❌ Failed to parse MYSQL_URL:', error.message);
        dbConfig = null;
    }
}

// Strategy 2: If MYSQL_URL not available or failed, use individual environment variables
if (!dbConfig) {
    if (isProduction) {
        // Production: Use Railway's provided variables
        dbConfig = {
            host: process.env.MYSQLHOST || process.env.MYSQL_HOST || 'mysql.railway.internal',
            user: process.env.MYSQL_USER || process.env.MYSQLUSER || 'root',
            password: process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQLPASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'railway',
            port: parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306'),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        };
        console.log('✓ Using Railway individual environment variables (production mode)');
    } else {
        // Development: Use local development variables
        dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'capstone_db',
            port: parseInt(process.env.DB_PORT || '3306'),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        };
        console.log('✓ Using local development configuration');
    }
}

// ============================================================================
// VALIDATION
// ============================================================================
const requiredFields = ['host', 'user', 'database', 'port'];
const missingFields = requiredFields.filter(field => !dbConfig[field]);

if (missingFields.length > 0) {
    console.error(`\n❌ Database configuration error: Missing required fields: ${missingFields.join(', ')}`);
    console.error('\nDebug info:');
    console.error({
        host: dbConfig.host || 'undefined',
        user: dbConfig.user || 'undefined',
        database: dbConfig.database || 'undefined',
        port: dbConfig.port || 'undefined',
        NODE_ENV: NODE_ENV,
        MYSQL_URL_set: !!process.env.MYSQL_URL,
    });
    process.exit(1);
}

// ============================================================================
// CREATE CONNECTION POOL
// ============================================================================
const pool = mysql.createPool(dbConfig);

// ============================================================================
// TEST CONNECTION
// ============================================================================
pool.getConnection((err, connection) => {
    if (err) {
        console.error('\n❌ Database connection failed!');
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        console.error('\nConnection Details:');
        console.error(`  Host: ${dbConfig.host}`);
        console.error(`  Port: ${dbConfig.port}`);
        console.error(`  User: ${dbConfig.user}`);
        console.error(`  Database: ${dbConfig.database}`);
        process.exit(1);
    }

    console.log('✅ Database connected successfully!');
    if (!isProduction) {
        console.log(`   Thread ID: ${connection.threadId}`);
    }
    connection.release();
    console.log('');
});

// ============================================================================
// EXPORT
// ============================================================================
module.exports = pool.promise();