// config.js
require('dotenv').config(); // Only needed for local development

const config = {
  db: {
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'capstone_db',
    port: process.env.MYSQLPORT || 3306,
  },
  app: {
    port: process.env.PORT || 3000
  }
};

module.exports = config;