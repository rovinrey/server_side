const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { validateSignup, validateLogin } = require('../validators/auth.validators');

// Stricter rate limit only for login/signup to prevent brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts, please try again later.' },
});

router.post('/signup', authLimiter, validateSignup, authController.signup);
router.post('/login', authLimiter, validateLogin, authController.login);
router.get('/getProfile', authMiddleware, authController.getProfile);

module.exports = router;