import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, login, forgotPassword, resetPassword, getProfile, updateProfile, changePassword, createUser } from '../controllers/auth.controller.js';
import authMiddleware, { requireRole } from '../middlewares/auth.middleware.js';
import authValidators from '../validators/auth.validators.js';
const { validateSignup, validateLogin } = authValidators;

// Stricter rate limit only for login/signup to prevent brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts, please try again later.' },
});


const router = Router();

router.post('/signup', authLimiter, validateSignup, signup);
router.post('/login', authLimiter, validateLogin, login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/getProfile', authMiddleware, getProfile);
router.put('/updateProfile', authMiddleware, updateProfile);
router.put('/changePassword', authMiddleware, changePassword);

// Admin-only route: Create admin or staff user
// Uses authMiddleware to authenticate, then checks user has 'admin' role
router.post('/create-user', authMiddleware, requireRole('admin'), createUser);

export default router;
