const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const createConnection = async () => {
    try {
        const connection = await mysql.createConnection({
            host: process.env.MYSQLHOST || 'localhost',
            user: process.env.MYSQLUSER || 'root',
            password: process.env.MYSQLPASSWORD || '',
            database: process.env.MYSQLDATABASE || 'capstone_db',
            port: process.env.MYSQLPORT || 3306,
        });
        console.log('✅ Database connection established');
        return connection;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        throw error;
    }
};

module.exports = {
    createConnection,
};

