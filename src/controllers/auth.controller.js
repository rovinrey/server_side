const authService = require('../services/auth.services');

exports.signup = async (req, res) => {
    try {
        const result = await authService.signup(req.body);
        res.status(201).json(result);
    } catch (error) {
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