#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LOCK_FILE = path.join(__dirname, '.admin_created');

// Color codes
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

// Helper for masking password input
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
                case '\u0003': process.exit(); break;
                case '\x7f': // Backspace
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        stdout.write('\b \b');
                    }
                    break;
                default:
                    password += char;
                    stdout.write('*'); // Mask with asterisks
                    break;
            }
        });
    });
}

function prompt(question) {
    return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

async function createAdmin() {
    // 1. RUN-ONCE CHECK
    if (fs.existsSync(LOCK_FILE)) {
        console.error(`\n${colors.red}🛑 ACCESS DENIED: Admin setup has already been completed.${colors.reset}`);
        console.log(`${colors.yellow}To re-run, manually delete the file: ${LOCK_FILE}${colors.reset}\n`);
        process.exit(0);
    }

    let connection;
    try {
        const mysqlUrl = process.env.MYSQL_URL;
        let dbConfig;

        if (mysqlUrl) {
            const url = new URL(mysqlUrl);
            dbConfig = {
                host: url.hostname,
                user: url.username,
                password: url.password,
                database: url.pathname.replace('/', ''),
                port: url.port || 3306
            };
        } else {
            dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'capstone_db',
                port: process.env.DB_PORT || 3306
            };
        }

        connection = await mysql.createConnection(dbConfig);
        
        const email = await prompt(`${colors.cyan}Admin Email:${colors.reset} `);
        
        // Final sanity check: Does an admin exist in DB?
        const [rows] = await connection.execute('SELECT user_id FROM users WHERE role = "admin" LIMIT 1');
        if (rows.length > 0) {
            console.log(`${colors.red}❌ An admin account already exists in the database.${colors.reset}`);
            fs.writeFileSync(LOCK_FILE, `Locked on ${new Date().toISOString()}`);
            process.exit(1);
        }

        const password = await promptPassword(`${colors.cyan}Admin Password:${colors.reset} `);
        const hashedPassword = await bcrypt.hash(password, 12);

        await connection.execute(
            'INSERT INTO users (user_name, email, password, role, created_at) VALUES (?, ?, ?, ?, NOW())',
            ['System Administrator', email, hashedPassword, 'admin']
        );

        // 2. CREATE LOCKFILE
        fs.writeFileSync(LOCK_FILE, `Admin created: ${email}\nDate: ${new Date().toISOString()}`);
        
        console.log(`\n${colors.green}✅ Admin created and script locked.${colors.reset}\n`);

    } catch (error) {
        console.error(`${colors.red}Error:${colors.reset}`, error.message);
    } finally {
        if (connection) await connection.end();
        rl.close();
    }
}

createAdmin();