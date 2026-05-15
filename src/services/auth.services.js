import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../config.js';

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

export const signup = async (body) => {
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

    // Role is always 'beneficiary'
    await db.query(
      'INSERT INTO users (user_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
      [user_name.trim(), email, phone, String(hashedPassword), 'beneficiary']
    );

    return { message: 'Account created successfully!' };
  } catch (error) {
    if (!error.statusCode) {
      console.error('Signup error:', error.code || error.message);
    }
    throw error;
  }
};

export const login = async (body) => {
  const rawIdentifier = body.identifier || body.email || body.phone || null;
  const identifier = rawIdentifier ? String(rawIdentifier).trim() : null;

  // Trim password to avoid trailing spaces
  const password = body.password ? String(body.password).trim() : null;

  const INVALID_CREDENTIALS = 'Invalid email/phone or password';

  if (!identifier || !password) {
    const error = new Error('Email/Phone and Password are required');
    error.statusCode = 400;
    throw error;
  }

  try {
    const identifierDigits = identifier.replace(/\D/g, '');

    const [users] = await db.query(
      `SELECT user_id, user_name, email, phone, password, role
       FROM users
       WHERE email = ?
          OR phone = ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') = ?`,
      [identifier, identifier, identifierDigits]
    );

    if (users.length === 0) {
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

export const getProfile = async (userId) => {
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

export const updateProfile = async (userId, newUserName) => {
  if (!userId) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  if (!newUserName || newUserName.length < 2 || newUserName.length > 50) {
    const error = new Error('Username must be between 2 and 50 characters');
    error.statusCode = 400;
    throw error;
  }

  try {
    const [existing] = await db.execute(
      'SELECT user_id FROM users WHERE user_name = ? AND user_id != ?',
      [newUserName.trim(), userId]
    );

    if (existing.length > 0) {
      const error = new Error('Username is already in use');
      error.statusCode = 409;
      throw error;
    }

    await db.execute('UPDATE users SET user_name = ? WHERE user_id = ?', [newUserName.trim(), userId]);

    return { message: 'Profile updated successfully!' };
  } catch (error) {
    if (!error.statusCode) {
      console.error('Update profile error:', error.code || error.message);
    }
    throw error;
  }
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  if (!userId) {
    const error = new Error('Unauthorized');
    error.statusCode = 401;
    throw error;
  }

  if (!currentPassword || !newPassword) {
    const error = new Error('Current password and new password are required');
    error.statusCode = 400;
    throw error;
  }

  if (!PASSWORD_REGEX.test(newPassword)) {
    const error = new Error(
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
    );
    error.statusCode = 400;
    throw error;
  }

  try {
    const [users] = await db.execute('SELECT password FROM users WHERE user_id = ?', [userId]);

    if (users.length === 0) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, users[0].password);

    if (!isPasswordValid) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 401;
      throw error;
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db.query('UPDATE users SET password = ? WHERE user_id = ?', [String(hashedPassword), userId]);

    return { message: 'Password changed successfully!' };
  } catch (error) {
    if (!error.statusCode) {
      console.error('Change password error:', error.code || error.message);
    }
    throw error;
  }
};

export const createUser = async (adminId, adminRole, body) => {
  const { user_name, identifier, password, role } = body;

  if (!adminId) {
    const error = new Error('Unauthorized - Admin access required');
    error.statusCode = 401;
    throw error;
  }

  if (adminRole !== 'admin') {
    const error = new Error('Forbidden - Admin role required');
    error.statusCode = 403;
    throw error;
  }

  if (!user_name || !identifier || !password || !role) {
    const error = new Error('All fields are required: user_name, identifier, password, role');
    error.statusCode = 400;
    throw error;
  }

  const allowedRoles = ['admin', 'staff'];
  if (!allowedRoles.includes(role)) {
    const error = new Error('Role must be either "admin" or "staff"');
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

    await db.query(
      'INSERT INTO users (user_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
      [user_name.trim(), email, phone, String(hashedPassword), role]
    );

    return { message: `${role} user created successfully!` };
  } catch (error) {
    if (!error.statusCode) {
      console.error('Create user error:', error.code || error.message);
    }
    throw error;
  }
};

