import { requestOTP, verifyOTP, resendOTP } from '../services/otp.services.js';

/**
 * OTP Controller
 * Handles HTTP endpoints for OTP verification flow
 */

/**
 * POST /api/auth/otp/request
 * Request OTP to be sent to email or phone
 */
export async function requestOTP(req, res) {
    try {
        const { identifier, user_name } = req.body;

        if (!identifier) {
            return res.status(400).json({
                message: 'Email or phone number is required',
            });
        }

        const result = await requestOTP(identifier, user_name || 'User');
        res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}

/**
 * POST /api/auth/otp/verify
 * Verify OTP code provided by user
 */
export async function verifyOTP(req, res) {
    try {
        const { identifier, otp_code } = req.body;

        if (!identifier || !otp_code) {
            return res.status(400).json({
                message: 'Identifier and OTP code are required',
            });
        }

        const result = await verifyOTP(identifier, otp_code);
        res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}

/**
 * POST /api/auth/otp/resend
 * Resend OTP code with cooldown check
 */
export async function resendOTP(req, res) {
    try {
        const { identifier, user_name } = req.body;

        if (!identifier) {
            return res.status(400).json({
                message: 'Email or phone number is required',
            });
        }

        const result = await resendOTP(identifier, user_name || 'User');
        res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        const message = error.statusCode ? error.message : 'An unexpected error occurred';
        res.status(status).json({ message });
    }
}
