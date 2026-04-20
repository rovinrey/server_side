require("dotenv").config();

const ENV = {
  // Core
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "8080", 10),

  // Database (handled by config.js)
  DB_HOST: process.env.MYSQLHOST || "localhost",
  DB_USER: process.env.MYSQLUSER || "root",
  DB_PASSWORD: process.env.MYSQLPASSWORD || "",
  DB_NAME: process.env.MYSQLDATABASE || "capstone_db",
  DB_PORT: parseInt(process.env.MYSQLPORT || "3306", 10),

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,

  // CORS - environment-based origins
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(",") || [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000"
  ],

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

// Determine if production
ENV.isProduction = ENV.NODE_ENV === "production";
ENV.isDevelopment = ENV.NODE_ENV === "development";

// Validate critical environment variables
const validateEnv = () => {
  if (ENV.isProduction) {
    const missing = [];
    if (!ENV.JWT_SECRET) missing.push("JWT_SECRET");

    if (missing.length > 0) {
      console.error(`❌ Missing required environment variables for production: ${missing.join(", ")}`);
      process.exit(1);
    }

    if (ENV.JWT_SECRET.length < 32) {
      console.error("❌ JWT_SECRET must be at least 32 characters long");
      process.exit(1);
    }
  }
};

validateEnv();

module.exports = ENV;
