// config.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || '',
  database: process.env.MYSQLDATABASE || 'capstone_db',
  port: process.env.MYSQLPORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
};

let pool = null;

const initializePool = async () => {
  try {
    pool = mysql.createPool(dbConfig);
    console.log('✅ Database pool initialized successfully');

    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ Database connection verified');
    connection.release();

    return pool;
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool() first.');
  }
  return pool;
};

// Async wrapper for safer connection retrieval
const getConnection = async () => {
  try {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }
    return await pool.getConnection();
  } catch (error) {
    console.error('❌ Failed to get database connection:', error.message);
    throw error;
  }
};

// Execute query with connection management
const executeQuery = async (query, values = []) => {
  let connection;
  try {
    connection = await getConnection();
    const [results] = await connection.execute(query, values);
    return results;
  } catch (error) {
    console.error('❌ Query execution error:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  initializePool,
  getPool,
  getConnection,
  executeQuery,
  dbConfig,
  // Compatibility method for direct pool.execute() calls
  execute: async (...args) => executeQuery(...args),
  query: async (...args) => {
    let connection;
    try {
      if (!pool) throw new Error('Database pool not initialized');
      connection = await pool.getConnection();
      const [results] = await connection.query(...args);
      return [results];
    } catch (error) {
      console.error('❌ Query execution error:', error.message);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }
};