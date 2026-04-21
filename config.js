const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// local development configuration
const connection = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'capstone_db',
});

connection.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        throw err;
    }
    console.log('✅ Database connection established');
    connection.release();
});

module.exports = connection;

const urlDB = `mysql://${process.env.MYSQLUSER}:${process.env.MYSQLPASSWORD}@${process.env.MYSQLHOST}:3306/${process.env.MYSQLDATABASE}`;
// database configuration for production deployment on Railway. Do not use in local development.
const productionConnection = mysql.createConnection(urlDB);

productionConnection.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Production database connection failed:', err.message);
        throw err;
    }   
    console.log('✅ Production database connection established');
    connection.release();
});
module.exports = productionConnection;