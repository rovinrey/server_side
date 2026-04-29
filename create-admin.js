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

// Lock file (prevents multiple admin creation)
const LOCK_FILE = path.join(__dirname, '.admin_created');

// Colors
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

// Prompt text input
function prompt(question) {
    return new Promise((resolve) =>
        rl.question(question, (ans) => resolve(ans.trim()))
    );
}

// Masked password input
function promptPassword(question) {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;

        stdout.write(question);
        stdin.resume();
        stdin.setRawMode(true);

        let password = '';

        function onData(char) {
            char = char.toString();

            switch (char) {
                case '\n':
                case '\r':
                case '\u0004':
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdout.write('\n');
                    stdin.removeListener('data', onData);
                    resolve(password);
                    break;

                case '\u0003':
                    process.exit();

                case '\x7f':
                    if (password.length > 0) {
                        password = password.slice(0, -1);
                        stdout.write('\b \b');
                    }
                    break;

                default:
                    password += char;
                    stdout.write('*');
            }
        }

        stdin.on('data', onData);
    });
}

async function createAdmin() {
    // Prevent re-run
    if (fs.existsSync(LOCK_FILE)) {
        console.error(
            `\n${colors.red}${colors.bold}🛑 Admin already created. Script locked.${colors.reset}\n`
        );
        process.exit(0);
    }

    let connection;

    try {
        console.log(`\n${colors.bold}${colors.cyan}=== ADMIN SETUP ===${colors.reset}\n`);

        // 🔥 FIXED: Use Railway MYSQL_URL ONLY
        if (!process.env.MYSQL_URL) {
            throw new Error("MYSQL_URL is missing in environment variables");
        }

        connection = await mysql.createConnection(process.env.MYSQL_URL);

        // Input
        const name =
            (await prompt(`${colors.cyan}Full Name [Admin]:${colors.reset} `)) ||
            'System Administrator';

        const email = await prompt(`${colors.cyan}Email:${colors.reset} `);
        const phone = await prompt(`${colors.cyan}Phone (optional):${colors.reset} `);

        if (!email) throw new Error("Email is required");

        // Check existing admin
        const [rows] = await connection.execute(
            'SELECT user_id FROM users WHERE role = ? LIMIT 1',
            ['admin']
        );

        if (rows.length > 0) {
            fs.writeFileSync(
                LOCK_FILE,
                `Admin already exists - locked at ${new Date().toISOString()}`
            );
            throw new Error("Admin already exists in database");
        }

        // Password
        const password = await promptPassword(
            `${colors.cyan}Password:${colors.reset} `
        );

        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters");
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Insert admin
        await connection.execute(
            `INSERT INTO users (user_name, email, phone, password, role)
             VALUES (?, ?, ?, ?, ?)`,
            [name, email, phone || null, hashedPassword, 'admin']
        );

        // Lock file
        fs.writeFileSync(
            LOCK_FILE,
            `Admin created: ${email}\nDate: ${new Date().toISOString()}`
        );

        console.log(
            `\n${colors.green}${colors.bold}✅ Admin created successfully!${colors.reset}\n`
        );
    } catch (err) {
        console.error(`\n${colors.red}❌ Error:${colors.reset}`, err.message, '\n');
    } finally {
        if (connection) await connection.end();
        rl.close();
    }
}

createAdmin();