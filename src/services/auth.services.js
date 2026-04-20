const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config');

const SALT_ROUNDS = 12;
const TOKEN_EXPIRY = '8h';

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    return secret;
};

// Email regex: standard RFC 5322 simplified pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;   

// Phone regex: digits with optional +, -, (), spaces (7-15 digits)
const PHONE_REGEX = /^\+?[\d\s()-]{7,20}$/;

// Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

// --- SIGNUP FUNCTION ---
const signup = async (body) => {
    const { user_name, identifier, password } = body;

    if (!user_name || !identifier || !password) {
        const error = new Error('All fields are required');
        error.statusCode = 400;
        throw error;
    }

    if (user_name.length < 2 || user_name.length > 50) {
        const error = new Error('Username must be between 2 and 50 characters');
        error.statusCode = 400;
        throw error;
    }

    if (!PASSWORD_REGEX.test(password)) {
        const error = new Error(
            'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        );
        error.statusCode = 400;
        throw error;
    }

    const trimmedIdentifier = String(identifier).trim();
    let email = null;
    let phone = null;

    if (trimmedIdentifier.includes('@')) {
        if (!EMAIL_REGEX.test(trimmedIdentifier)) {
            const error = new Error('Please provide a valid email address');
            error.statusCode = 400;
            throw error;
        }
        email = trimmedIdentifier.toLowerCase();
    } else {
        const digitsOnly = trimmedIdentifier.replace(/\D/g, '');
        if (!PHONE_REGEX.test(trimmedIdentifier) || digitsOnly.length < 7 || digitsOnly.length > 15) {
            const error = new Error('Please provide a valid phone number');
            error.statusCode = 400;
            throw error;
        }
        phone = trimmedIdentifier;
    }

    try {
        const [existingUsers] = await db.execute(
            'SELECT user_id FROM users WHERE email = ? OR phone = ?',
            [email, phone]
        );
        if (existingUsers.length > 0) {
            const error = new Error('Email or phone number already in use');
            error.statusCode = 409;
            throw error;
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Role is always 'beneficiary' — never accept role from client input
        await db.execute(
            'INSERT INTO users (user_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
            [user_name.trim(), email, phone, hashedPassword, 'beneficiary']
        );

        return { message: 'Account created successfully!' };
    } catch (error) {
        if (!error.statusCode) {
            console.error('Signup error:', error.code || error.message);
        }
        throw error;
    }
};

// --- LOGIN FUNCTION ---
const login = async (body) => {
    const rawIdentifier = body.identifier || body.email || body.phone || null;
    const identifier = rawIdentifier ? String(rawIdentifier).trim() : null;
    const password = body.password || null;

    // Generic error message to prevent user enumeration
    const INVALID_CREDENTIALS = 'Invalid email/phone or password';

    if (!identifier || !password) {
        const error = new Error('Email/Phone and Password are required');
        error.statusCode = 400;
        throw error;
    }

    try {
        const identifierDigits = identifier.replace(/\D/g, '');

        // Only select the columns we actually need — never SELECT *
        const [users] = await db.execute(
            `SELECT user_id, user_name, email, phone, password, role
             FROM users
             WHERE email = ?
                OR phone = ?
                OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?`,
            [identifier, identifier, identifierDigits]
        );

        if (users.length === 0) {
            // Run a dummy bcrypt compare to prevent timing-based user enumeration
            await bcrypt.compare(password, '$2a$12$000000000000000000000uGAIGGJPAVDKJzaO7ghrJO0DeeWXnlm');
            const error = new Error(INVALID_CREDENTIALS);
            error.statusCode = 401;
            throw error;
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            const error = new Error(INVALID_CREDENTIALS);
            error.statusCode = 401;
            throw error;
        }

        const userId = user.user_id;
        if (!userId) {
            console.error('Database schema error: no user_id returned');
            const error = new Error('Authentication failed');
            error.statusCode = 500;
            throw error;
        }

        // Only put the minimum necessary claims in the token — no PII
        const token = jwt.sign(
            { id: userId, role: user.role },
            getJwtSecret(),
            { expiresIn: TOKEN_EXPIRY }
        );

        return {
            message: 'Login successful!',
            token,
            role: user.role,
            user: {
                id: userId,
                user_name: user.user_name,
                email: user.email,
                phone: user.phone
            }
        };
    } catch (error) {
        if (!error.statusCode) {
            console.error('Login error:', error.code || error.message);
        }
        throw error;
    }
};

// --- GET PROFILE (uses authenticated user ID from JWT — never trust query params) ---
const getProfile = async (userId) => {
    if (!userId) {
        const error = new Error('Unauthorized');
        error.statusCode = 401;
        throw error;
    }

    try {
        const [users] = await db.execute(
            'SELECT user_id, user_name, email, phone, role FROM users WHERE user_id = ?',
            [userId]
        );
        if (users.length === 0) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        return users[0];
    } catch (error) {
        if (!error.statusCode) {
            console.error('Get profile error:', error.code || error.message);
        }
        throw error;
    }
};

module.exports = {
    signup,
    login,
    getProfile
};