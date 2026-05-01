

const authService = require('../services/auth.services');
const passwordService = require('../services/password.services');

// POST /api/auth/updateProfile
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { user_name } = req.body;
        const result = await authService.updateProfile(userId, user_name);
        res.json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
};

// POST /api/auth/changePassword
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        const result = await authService.changePassword(userId, currentPassword, newPassword);
        res.json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await passwordService.forgotPassword(email);
        res.json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const result = await passwordService.resetPassword(token, password);
        res.json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
};

exports.signup = async (req, res) => {
    try {
        const result = await authService.signup(req.body);
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
};

exports.login = async (req, res) => {
    try {
        const data = await authService.login(req.body);
        res.json(data);
    } catch (error) {
        console.error('Login error:', error); // Log the full error for debugging
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        // Use the authenticated user's ID from the JWT token — never from query params
        const data = await authService.getProfile(req.user.id);
        res.json(data);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
};

// POST /api/auth/create-user (Admin only - for creating admin/staff accounts)
exports.createUser = async (req, res) => {
    try {
        const adminId = req.user.id;
        const adminRole = req.user.role;
        const result = await authService.createUser(adminId, adminRole, req.body);
        res.status(201).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
};
