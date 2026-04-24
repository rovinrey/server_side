const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

// Load correct env file
const NODE_ENV = process.env.NODE_ENV || "development";

dotenv.config({
    path: NODE_ENV === "production" ? ".env.production" : ".env",
});

const isProduction = NODE_ENV === "production";

// Helper to ensure required env vars exist
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`❌ Missing environment variable: ${name}`);
    }
    return value;
}

// Build config
function getDbConfig() {
    // Option 1: Railway provides full URL
    if (process.env.MYSQL_URL) {
        return {
            uri: process.env.MYSQL_URL,
        };
    }

    // Option 2: Manual config
    if (isProduction) {
        return {
            host: requireEnv("MYSQLHOST"),
            user: requireEnv("MYSQLUSER"),
            password: process.env.MYSQLPASSWORD || "",
            database: requireEnv("MYSQLDATABASE"),
            port: parseInt(process.env.MYSQLPORT || "3306", 10),
        };
    }

    // Local dev
    return {
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_DATABASE || "capstone_db",
        port: 3306,
    };
}

const dbConfig = getDbConfig();

// Create pool
const pool =
    dbConfig.uri
        ? mysql.createPool(dbConfig.uri)
        : mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });

// Verify connection properly
async function testConnection() {
    try {
        const conn = await pool.getConnection();
        conn.release();

        console.log(
            `✅ Database connected (${isProduction ? "PRODUCTION" : "DEVELOPMENT"})`
        );
    } catch (err) {
        console.error("❌ Database connection failed:", err.message);
        process.exit(1); // crash early (important in production)
    }
}

testConnection();

module.exports = pool;