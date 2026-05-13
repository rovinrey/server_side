

import {
    updateProfile as updateProfileService,
    changePassword as changePasswordService,
    signup as signupService,
    login as loginService,
    getProfile as getProfileService,
    createUser as createUserService,
} from '../services/auth.services.js';
import passwordServices from '../services/password.services.js';

// password.services.js is CommonJS (module.exports = { forgotPassword, resetPassword })
const forgotPasswordService = passwordServices.forgotPassword;
const resetPasswordService = passwordServices.resetPassword;

// NOTE: password.services.js is CommonJS

// POST /api/auth/updateProfile
export async function updateProfile(req, res) {
    try {
        const userId = req.user.id;
        const { user_name } = req.body;
        const result = await updateProfileService(userId, user_name);
        res.json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}

// POST /api/auth/changePassword
export async function changePassword(req, res) {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        const result = await changePasswordService(userId, currentPassword, newPassword);
        res.json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}

// POST /api/auth/forgot-password
export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        const result = await forgotPasswordService(email);
        res.json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}

// POST /api/auth/reset-password
export async function resetPassword(req, res) {
    try {
        const { token, password } = req.body;
        const result = await resetPasswordService(token, password);
        res.json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}


export async function signup(req, res) {
    try {
        const result = await signupService(req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error('❌ Signup error:', {
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            stack: error.stack
        });
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}

export async function login(req, res) {
    try {
        const data = await loginService(req.body);
        res.json(data);
    } catch (error) {
        console.error('Login error:', error); // Log the full error for debugging
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}

export async function getProfile(req, res) {
    try {
        // Use the authenticated user's ID from the JWT token — never from query params
        const data = await getProfileService(req.user.id);
        res.json(data);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}

// POST /api/auth/create-user (Admin only - for creating admin/staff accounts)
export async function createUser(req, res) {
    try {
        const adminId = req.user.id;
        const adminRole = req.user.role;
        const result = await createUserService(adminId, adminRole, req.body);
        res.status(201).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}
