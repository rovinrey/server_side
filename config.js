require("dotenv").config();
const mysql = require("mysql2/promise");

const isProduction = process.env.NODE_ENV === "production";

const dbConfig = {
  // Railway injects MYSQLHOST, local uses fallback
  host:     process.env.MYSQLHOST     || "localhost",
  user:     process.env.MYSQLUSER     || "root",
  password: process.env.MYSQLPASSWORD || "",
  database: process.env.MYSQLDATABASE || "capstone_db",
  port:     Number(process.env.MYSQLPORT) || 3306,

  waitForConnections: true,
  connectionLimit: isProduction ? 20 : 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  // Railway MySQL requires SSL - must allow self-signed certificates
  ...(isProduction && {
    ssl: {
      rejectUnauthorized: false  // Accept Railway's self-signed certs
    }
  }),
  // Local development can use 'Amazon RDS' for testing or skip SSL
  ...(!isProduction && {
    ssl: false  // No SSL for local MySQL
  }),
};

let pool = null;
let isInitialized = false;

const getPool = () => {
  if (!pool) {
    console.log("🔧 Creating database pool...");
    pool = mysql.createPool(dbConfig);

    // Handle pool errors
    pool.on("error", (err) => {
      console.error("❌ Pool error:", err.message, err.code);
      if (["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(err.code)) {
        console.log("⚠️  Resetting pool due to connection error");
        pool = null;
      }
    });

    // Log when connection acquired
    pool.on("connection", () => {
      if (process.env.NODE_ENV !== "production") {
        console.log("📡 Connection acquired from pool");
      }
    });
  }
  return pool;
};

// Test connection - logs more details
const testConnection = async () => {
  try {
    console.log("🔍 Testing database connection...");
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   User: ${dbConfig.user}`);

    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();

    isInitialized = true;
    console.log("✅ Database connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", {
      message: error.message,
      code: error.code,
      errno: error.errno,
      host: dbConfig.host
    });
    throw error;
  }
};

const query = async (sql, params) => {
  try {
    const [results] = await getPool().execute(sql, params);
    return results;
  } catch (error) {
    console.error("❌ Query error:", {
      message: error.message,
      code: error.code,
      sql: sql.substring(0, 100),
    });
    throw error;
  }
};

const getConnection = async () => {
  try {
    return await getPool().getConnection();
  } catch (error) {
    console.error("❌ Failed to acquire connection:", error.message);
    throw error;
  }
};

// Compatibility method: execute query through pool
const execute = async (sql, params) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(sql, params);
    return result;
  } catch (error) {
    console.error("❌ Execute error:", {
      message: error.message,
      code: error.code,
      sql: sql.substring(0, 100),
    });
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { query, execute, getConnection, getPool, testConnection };

// Verify exports on load
console.log("✅ config.js loaded. Exports:", Object.keys(module.exports));