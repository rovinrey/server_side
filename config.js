import { createPool } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

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
    ? createPool(config.uri)
    : createPool({
          ...config,
          waitForConnections: true,
          connectionLimit: 10,
      });

export function getConnection() {
    return pool.getConnection();
}

export async function execute(query, values) {
    const conn = await pool.getConnection();
    try {
        const [result] = await conn.execute(query, values);
        return [result];
    } finally {
        conn.release();
    }
}

export async function query(queryText, values) {
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(queryText, values);
        return [rows];
    } finally {
        conn.release();
    }
}

// test connection
(async () => {
    try {
        const conn = await pool.getConnection();
        conn.release();
        console.log("Database connected successfully!");
    } catch (err) {
        console.error("Database error:", err.message);
        process.exit(1);
    }
})();

export default pool;