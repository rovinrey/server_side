import { randomBytes } from 'crypto';
import db from '../../config.js';
const { execute, query } = db;
import bcrypt from 'bcryptjs';
const { hash } = bcrypt;
import emailUtils from '../utils/email.js';
const { sendResetEmail } = emailUtils;

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

// 1. Request password reset
const forgotPassword = async (email) => {
    // Find user by email
    const [users] = await execute('SELECT user_id, email FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
        // Do not reveal if email exists
        return { message: 'If the email exists, a reset link will be sent.' };
    }
    const user = users[0];
    // Generate token
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    // Store token in DB
    await execute('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?', [token, expires, user.user_id]);
    // Send email
    await sendResetEmail(user.email, token);
    return { message: 'If the email exists, a reset link will be sent.' };
};

// 2. Reset password
const resetPassword = async (token, newPassword) => {
    if (!PASSWORD_REGEX.test(newPassword)) {
        const error = new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
        error.statusCode = 400;
        throw error;
    }
    // Find user by token
    const [users] = await execute('SELECT user_id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
    if (users.length === 0) {
        const error = new Error('Invalid or expired token');
        error.statusCode = 400;
        throw error;
    }
    const user = users[0];
    const hashedPassword = await hash(newPassword, 12);
    await query(
        'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?',
        [String(hashedPassword), user.user_id]
    );
    return { message: 'Password reset successful!' };
};

export default { forgotPassword, resetPassword };