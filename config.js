import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((error) => {
  if (error) {
    console.error('❌ Connection error:', error);
  } else {
    console.log('✅ Connected to the MySQL database!');
  }
});

export default connection;