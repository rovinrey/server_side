require("dotenv").config();
const mysql = require("mysql2/promise");

// Environment configuration
const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV === "development",
};

// Validate required environment variables
const validateEnv = () => {
  const required = ENV.isProduction ? ["MYSQLHOST", "MYSQLUSER", "MYSQLDATABASE"] : [];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
};

validateEnv();

const dbConfig = {
  host: process.env.MYSQLHOST || "localhost",
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "",
  database: process.env.MYSQLDATABASE || "capstone_db",
  port: Number(process.env.MYSQLPORT) || 3306,

  waitForConnections: true,
  connectionLimit: ENV.isProduction ? 20 : 5,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  ...(ENV.isProduction && {
    ssl: { rejectUnauthorized: false }
  }),
  ...(!ENV.isProduction && {
    ssl: false
  }),
};

let pool = null;

const getPool = () => {
  if (!pool) {
    console.log("🔧 Creating database pool...");
    pool = mysql.createPool(dbConfig);

    pool.on("error", (err) => {
      console.error("❌ Pool error:", err.message, err.code);
      if (["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(err.code)) {
        console.log("⚠️  Resetting pool due to connection error");
        pool = null;
      }
    });

    if (ENV.isDevelopment) {
      pool.on("connection", () => {
        console.log("📡 Connection acquired from pool");
      });
    }
  }
  return pool;
};

const testConnection = async () => {
  try {
    console.log("🔍 Testing database connection...");
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}`);

    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();

    console.log("✅ Database connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", {
      message: error.message,
      code: error.code,
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

module.exports = {
  query,
  execute,
  getConnection,
  getPool,
  testConnection,
  ENV,
  dbConfig
};