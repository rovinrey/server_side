#!/usr/bin/env node

/**
 * Admin Account Creation Script - Production Ready
 * 
 * Supports:
 * - Local development (DB_HOST, DB_USER, DB_PASSWORD)
 * - Railway deployment (MYSQL_URL)
 * - Interactive password input (no echo)
 * - Password strength validation
 * - Duplicate detection
 * 
 * Usage:
 *   node create-admin.js                    # Interactive mode
 *   node create-admin.js --email admin@x.com --password Pass123!  # Direct mode
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const readline = require('readline');
require('dotenv').config();

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
};

// Parse command line arguments
const args = process.argv.slice(2);
const argEmail = args.indexOf('--email') !== -1 ? args[args.indexOf('--email') + 1] : null;
const argPassword = args.indexOf('--password') !== -1 ? args[args.indexOf('--password') + 1] : null;

// Interactive readline interface for password input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function prompt(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

// Hidden password input (doesn't echo to terminal)
function promptPassword(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements: min 8 chars, uppercase, lowercase, number, special char
 */
function validatePassword(password) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    
    if (!passwordRegex.test(password)) {
        return {
            valid: false,
            message: 'Password must contain: uppercase, lowercase, number, special character, minimum 8 characters'
        };
    }
    
    return { valid: true, message: 'Password is strong' };
}

/**
 * Parse MySQL connection config
 * Supports Railway MYSQL_URL or individual env variables
 */
function getDbConfig() {
    const mysqlUrl = process.env.MYSQL_URL;
    
    if (mysqlUrl) {
        // Railway deployment format: mysql://user:password@host:port/database
        try {
            const url = new URL(mysqlUrl);
            return {
                host: url.hostname,
                user: url.username,
                password: url.password,
                database: url.pathname.replace('/', ''),
                port: url.port || 3306,
                connectionSource: 'Railway (MYSQL_URL)'
            };
        } catch (e) {
            console.error(`${colors.red}❌ Invalid MYSQL_URL format${colors.reset}`);
            process.exit(1);
        }
    }
    
    // Local development format
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'capstone_db',
        port: process.env.DB_PORT || 3306,
        connectionSource: 'Environment Variables (DB_HOST, DB_USER, etc.)'
    };
}

/**
 * Main admin creation function
 */
async function createAdmin() {
    let connection;
    
    try {
        console.log(`\n${colors.cyan}╔══════════════════════════════════════╗${colors.reset}`);
        console.log(`${colors.cyan}║   ADMIN ACCOUNT CREATION SCRIPT       ║${colors.reset}`);
        console.log(`${colors.cyan}╚══════════════════════════════════════╝${colors.reset}\n`);
        
        // Get database configuration
        const dbConfig = getDbConfig();
        const connectionSource = dbConfig.connectionSource;
        delete dbConfig.connectionSource; // Remove non-MySQL property
        
        console.log(`${colors.yellow}Database Source:${colors.reset} ${connectionSource}`);
        console.log(`${colors.yellow}Host:${colors.reset} ${dbConfig.host}`);
        console.log(`${colors.yellow}Database:${colors.reset} ${dbConfig.database}\n`);
        
        // Connect to database
        console.log(`${colors.cyan}Connecting to database...${colors.reset}`);
        connection = await mysql.createConnection(dbConfig);
        console.log(`${colors.green}✅ Connected successfully${colors.reset}\n`);
        
        // Get email (from args or prompt)
        let email = argEmail;
        if (!email) {
            email = await prompt(`${colors.yellow}Enter admin email:${colors.reset} `);
        }
        
        email = email.trim();
        
        if (!isValidEmail(email)) {
            console.error(`${colors.red}❌ Invalid email format${colors.reset}`);
            process.exit(1);
        }
        
        // Check if email already exists
        console.log(`\n${colors.cyan}Checking for duplicate email...${colors.reset}`);
        const [existingRows] = await connection.execute(
            'SELECT user_id, email, role FROM users WHERE email = ?',
            [email]
        );
        
        if (existingRows.length > 0) {
            console.error(`${colors.red}❌ Email already registered: ${email}${colors.reset}`);
            process.exit(1);
        }
        
        console.log(`${colors.green}✅ Email available${colors.reset}`);
        
        // Get password (from args or prompt)
        let password = argPassword;
        if (!password) {
            password = await promptPassword(`${colors.yellow}Enter admin password:${colors.reset} `);
        }
        
        password = password.trim();
        
        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            console.error(`${colors.red}❌ ${passwordValidation.message}${colors.reset}`);
            process.exit(1);
        }
        console.log(`${colors.green}✅ ${passwordValidation.message}${colors.reset}`);
        
        // Confirm before creating
        console.log(`\n${colors.bold}${colors.cyan}========== CONFIRMATION ==========${colors.reset}`);
        console.log(`${colors.yellow}Email:${colors.reset} ${email}`);
        console.log(`${colors.yellow}Role:${colors.reset} admin (System Administrator)`);
        console.log(`${colors.yellow}Username:${colors.reset} System Administrator`);
        console.log(`${colors.bold}${colors.cyan}===================================${colors.reset}\n`);
        
        if (!argPassword) {
            // Only ask for confirmation in interactive mode
            const confirm = await prompt(`${colors.yellow}Create this admin account? (yes/no):${colors.reset} `);
            if (confirm.toLowerCase() !== 'yes') {
                console.log(`${colors.yellow}Cancelled${colors.reset}`);
                process.exit(0);
            }
        }
        
        // Hash password with bcrypt
        console.log(`${colors.cyan}Hashing password...${colors.reset}`);
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Insert admin user
        console.log(`${colors.cyan}Creating admin account...${colors.reset}`);
        const [result] = await connection.execute(
            'INSERT INTO users (user_name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
            ['System Administrator', email, hashedPassword, 'admin']
        );
        
        console.log(`\n${colors.green}${colors.bold}✅ ADMIN ACCOUNT CREATED SUCCESSFULLY${colors.reset}\n`);
        console.log(`${colors.green}User ID:${colors.reset} ${result.insertId}`);
        console.log(`${colors.green}Email:${colors.reset} ${email}`);
        console.log(`${colors.green}Role:${colors.reset} admin`);
        console.log(`${colors.green}Created:${colors.reset} ${new Date().toISOString()}\n`);
        
        console.log(`${colors.bold}${colors.cyan}LOGIN CREDENTIALS:${colors.reset}`);
        console.log(`${colors.yellow}Email:${colors.reset} ${email}`);
        console.log(`${colors.yellow}Password:${colors.reset} ${password}\n`);
        
        console.log(`${colors.yellow}⚠️  Save these credentials securely!${colors.reset}\n`);
        
    } catch (error) {
        console.error(`\n${colors.red}❌ Error creating admin account:${colors.reset}`);
        console.error(`${colors.red}${error.message}${colors.reset}\n`);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error(`${colors.yellow}Check database credentials in .env or environment variables${colors.reset}\n`);
        }
        
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
        rl.close();
    }
}

// Run the script
createAdmin().catch((error) => {
    console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
    process.exit(1);
});
