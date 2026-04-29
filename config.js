const mysql = require("mysql2/promise");
require("dotenv").config();

function getDbConfig() {
    if (process.env.MYSQL_URL) {
        return { uri: process.env.MYSQL_URL };
    }

    return {
        host: process.env.MYSQLHOST || process.env.DB_HOST || "localhost",
        user: process.env.MYSQLUSER || process.env.DB_USER || "root",
        password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || "",
        database:
            process.env.MYSQLDATABASE ||
            process.env.DB_DATABASE ||
            "capstone_db",
        port: parseInt(
            process.env.MYSQLPORT || process.env.DB_PORT || "3306",
            10
        ),
    };
}

const config = getDbConfig();

const pool = config.uri
    ? mysql.createPool(config.uri)
    : mysql.createPool({
          ...config,
          waitForConnections: true,
          connectionLimit: 10,
      });

// test connection
(async () => {
    try {
        const conn = await pool.getConnection();
        conn.release();
        console.log("✅ DB connected");
    } catch (err) {
        console.error("❌ DB error:", err.message);
        process.exit(1);
    }
})();

module.exports = pool;