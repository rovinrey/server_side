import { Router } from 'express';
const router = Router();
import rateLimit from 'express-rate-limit';
import { requestOTP, verifyOTP, resendOTP } from '../controllers/otp.controller.js';

/**
 * OTP Routes
 * Separate, stricter rate limiting for OTP endpoints to prevent abuse
 */

// Stricter rate limit for OTP requests (prevent spam)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 OTP requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many OTP requests. Please try again later.' },
});

// Very strict limit for verification attempts
const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 verification attempts per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many OTP verification attempts. Please try again later.' },
});

/**
 * POST /api/auth/otp/request
 * Request OTP - Send verification code to email or phone
 * 
 * Request body:
 * {
 *   "identifier": "user@example.com" or "+1234567890",
 *   "user_name": "John Doe" (optional, for personalization)
 * }
 * 
 * Response:
 * {
 *   "message": "OTP sent to your email",
 *   "otpId": 123,
 *   "identifier": "us***@example.com"
 * }
 */
router.post('/request', otpLimiter, requestOTP);

/**
 * POST /api/auth/otp/verify
 * Verify OTP - Validate the OTP code provided by user
 * 
 * Request body:
 * {
 *   "identifier": "user@example.com" or "+1234567890",
 *   "otp_code": "123456"
 * }
 * 
 * Response:
 * {
 *   "message": "OTP verified successfully",
 *   "otpId": 123,
 *   "verified": true
 * }
 */
router.post('/verify', verifyLimiter, verifyOTP);

/**
 * POST /api/auth/otp/resend
 * Resend OTP - Request a new OTP code (with cooldown)
 * 
 * Request body:
 * {
 *   "identifier": "user@example.com" or "+1234567890",
 *   "user_name": "John Doe" (optional)
 * }
 * 
 * Response:
 * {
 *   "message": "OTP sent to your email",
 *   "otpId": 124,
 *   "identifier": "us***@example.com"
 * }
 */
router.post('/resend', otpLimiter, resendOTP);

export default router;
