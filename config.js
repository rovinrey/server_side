// ============================================================================
// DATABASE CONFIGURATION - Production Ready (Dev & Production)
// ============================================================================
const mysql = require('mysql2');
require('dotenv').config();

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================
const NODE_ENV = process.env.NODE_ENV || 'development';
const isDevelopment = NODE_ENV === 'development';
const isProduction = NODE_ENV === 'production';

console.log(`\n🔧 Database Config: ${NODE_ENV.toUpperCase()} mode\n`);

// ============================================================================
// DATABASE CONFIGURATION - Production Tested Strategy
// ============================================================================
let dbConfig = null;

// PRODUCTION MODE: Use Railway's environment variables
if (isProduction) {
    // Railway provides these variables automatically
    const mysqlUser = process.env.MYSQLUSER || process.env.MYSQL_USER || 'root';
    const mysqlPassword = process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
    const mysqlHost = process.env.MYSQLHOST || process.env.MYSQL_HOST || 'mysql.railway.internal';
    const mysqlPort = parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306');
    const mysqlDatabase = process.env.MYSQL_DATABASE || 'railway';

    dbConfig = {
        host: mysqlHost,
        user: mysqlUser,
        password: mysqlPassword,
        database: mysqlDatabase,
        port: mysqlPort,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    };

    console.log('✓ Using Railway production variables');
}
// DEVELOPMENT MODE: Use local environment variables
else {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'capstone_db';
    const dbPort = parseInt(process.env.DB_PORT || '3306');

    dbConfig = {
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        port: dbPort,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    };

    console.log('✓ Using local development configuration');
}

// ============================================================================
// VALIDATION
// ============================================================================
const requiredFields = ['host', 'user', 'database', 'port'];
const missingFields = requiredFields.filter(field => !dbConfig[field]);

if (missingFields.length > 0) {
    console.error(`\n❌ Configuration Error: Missing required fields: ${missingFields.join(', ')}`);
    console.error('\nDebug Information:');
    console.error({
        NODE_ENV: NODE_ENV,
        host: dbConfig.host || 'undefined',
        user: dbConfig.user || 'undefined',
        database: dbConfig.database || 'undefined',
        port: dbConfig.port || 'undefined',
        password: dbConfig.password ? '***SET***' : 'EMPTY',
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
        console.error('\n❌ Database Connection Failed!');
        console.error('Error Code:', err.code);
        console.error('Error Message:', err.message);
        console.error('\nConnection Attempt:');
        console.error(`  Host: ${dbConfig.host}:${dbConfig.port}`);
        console.error(`  User: ${dbConfig.user}`);
        console.error(`  Database: ${dbConfig.database}`);
        console.error(`  Password: ${dbConfig.password ? '***SET***' : 'EMPTY (This is the problem!)'}`);
        process.exit(1);
    }

    if (isDevelopment) {
        console.log('✅ Database connected successfully!');
        console.log(`   Thread ID: ${connection.threadId}`);
    }
    connection.release();
    console.log('');
});

// ============================================================================
// EXPORT
// ============================================================================
module.exports = pool.promise();