#!/usr/bin/env node

/**
 * TUPAD AND PANGKABUHAYAN MANAGEMENT SYSTEM
 * Admin Account Initialization Script
 */

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// The lock file prevents the script from being run multiple times after success
const LOCK_FILE = path.join(__dirname, '.admin_created');

// Terminal color formatting
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

/**
 * Masks password input in the terminal with asterisks
 */
function promptPassword(question) {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        stdout.write(question);
        stdin.resume();
        stdin.setRawMode(true);
        let password = '';
        
        stdin.on('data', function onData(char) {
            char = char.toString();
            switch (char) {
                case '\n': case '\r': case '\u0004':
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdout.write('\n');
                    stdin.removeListener('data', onData);
                    resolve(password.trim());
                    break;
                case '\u0003': // Ctrl+C
                    process.exit(); 
                    break;   
                case '\x7f': // Backspace
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        stdout.write('\b \b');
                    }
                    break;
                default:
                    password += char;
                    stdout.write('*'); 
                    break;
            }
        });
    });
}

function prompt(question) {
    return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

async function createAdmin() {
    // 1. PRE-FLIGHT LOCK CHECK
    if (fs.existsSync(LOCK_FILE)) {
        console.error(`\n${colors.red}${colors.bold}🛑 ACCESS DENIED: Admin setup is locked.${colors.reset}`);
        console.log(`${colors.yellow}Setup has already been completed. To re-run, delete: ${LOCK_FILE}${colors.reset}\n`);
        process.exit(0);
    }

    let connection;
    try {
        // DB Configuration (Supports Connection String or Individual Variables)
        const dbConfig = process.env.MYSQL_URL || {
            host: process.env.MYSQLHOST || 'localhost',
            user: process.env.MYSQLUSER || 'root',
            password: process.env.MYSQLPASSWORD || '',
            database: process.env.MYSQLDATABASE || 'capstone_db',
            port: process.env.MYSQLPORT || 3306
        };

        connection = await mysql.createConnection(dbConfig);
        
        console.log(`\n${colors.bold}${colors.cyan}--- TUPAD SYSTEM ADMIN INITIALIZATION ---${colors.reset}\n`);

        // Gather Admin Information
        const name = await prompt(`${colors.cyan}Full Name [System Admin]:${colors.reset} `) || 'System Administrator';
        const email = await prompt(`${colors.cyan}Email Address:${colors.reset} `);
        const phone = await prompt(`${colors.cyan}Phone Number:${colors.reset} `);
        
        if (!email) {
            throw new Error("Email is required.");
        }

        // 2. DATABASE INTEGRITY CHECK
        const [rows] = await connection.execute('SELECT user_id FROM users WHERE role = "admin" LIMIT 1');
        if (rows.length > 0) {
            console.log(`${colors.yellow}⚠️ An admin already exists in the database. Locking script...${colors.reset}`);
            fs.writeFileSync(LOCK_FILE, `Locked on ${new Date().toISOString()} - Admin already present.`);
            process.exit(1);
        }

        const password = await promptPassword(`${colors.cyan}Enter Admin Password:${colors.reset} `);
        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters long.");
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // 3. EXECUTE INSERT
        // Matches schema: user_name, email, phone, password, role
        await connection.execute(
            'INSERT INTO users (user_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            [name, email, phone || null, hashedPassword, 'admin']
        );

        // 4. FINAL LOCKING
        fs.writeFileSync(LOCK_FILE, `Admin created: ${email}\nDate: ${new Date().toISOString()}`);
        
        console.log(`\n${colors.green}${colors.bold}✅ SUCCESS: Admin account created.${colors.reset}`);
        console.log(`${colors.green}The setup script is now locked.${colors.reset}\n`);

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.error(`\n${colors.red}❌ ERROR: Email or Phone already exists in the database.${colors.reset}\n`);
        } else {
            console.error(`\n${colors.red}❌ ERROR:${colors.reset}`, error.message, "\n");
        }
    } finally {
        if (connection) await connection.end();
        rl.close();
    }
}

createAdmin();