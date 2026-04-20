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
  connectionLimit: isProduction ? 20 : 5,  // more headroom on Railway
  queueLimit: 0,
  enableKeepAlive: true,       // prevents idle connection drops
  keepAliveInitialDelay: 10000,

  // Railway MySQL requires SSL in production
  ...(isProduction && {
    ssl: { rejectUnauthorized: false },
  }),
};

let pool = null;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool(dbConfig);

    pool.on("error", (err) => {
      console.error("❌ Pool error:", err.message);
      if (["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "ETIMEDOUT"].includes(err.code)) {
        pool = null; // force re-init on next call
      }
    });
  }
  return pool;
};

// Ping on startup to catch misconfig early
const testConnection = async () => {
  const conn = await getPool().getConnection();
  await conn.ping();
  conn.release();
  console.log("✅ Database connected");
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

module.exports = { query, getConnection, getPool, testConnection };