const db = require('../../config');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Production-Ready OTP Service
 * Handles OTP generation, sending, and verification
 * Supports both email and SMS/phone verification
 */

// Configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10; // OTP valid for 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60; // 1 minute between resends

/**
 * Initialize Email Service
 * Requires: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD
 */
const emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

/**
 * Verify email transporter connection (non-blocking)
 */
if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    emailTransporter.verify((error) => {
        if (error) {
            console.warn('⚠️  Email service not configured:', error.message);
        } else {
            console.log('✅ Email service configured successfully');
        }
    });
}

/**
 * Initialize SMS Service (Twilio)
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
let twilioClient = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
        const twilio = require('twilio');
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio SMS service configured successfully');
    } catch (error) {
        console.warn('⚠️  Twilio not available, SMS will use fallback mode:', error.message);
    }
}

/**
 * Generate random OTP code
 * @returns {string} 6-digit OTP code
 */
const generateOTP = () => {
    return crypto.randomInt(0, 999999).toString().padStart(OTP_LENGTH, '0');
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate phone format
 */
const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[\d\s()-]{7,20}$/;
    const digitsOnly = phone.replace(/\D/g, '');
    return phoneRegex.test(phone) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
};

/**
 * Send OTP via Email
 */
const sendOTPEmail = async (email, otp, userName = 'User') => {
    try {
        if (!process.env.EMAIL_USER) {
            console.warn('Email service not configured. OTP:', otp);
            return true; // Continue flow even if email fails in dev
        }

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'PESO Juban'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your PESO Account Verification Code',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
                        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                        .otp-box { background: white; border: 2px solid #0d9488; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
                        .otp-code { font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 5px; font-family: 'Courier New', monospace; }
                        .expiry { color: #6b7280; font-size: 14px; margin-top: 15px; }
                        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
                        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>PESO Juban</h1>
                            <p>Account Verification</p>
                        </div>
                        <div class="content">
                            <p>Hello ${userName},</p>
                            <p>Thank you for signing up with PESO Juban. To complete your registration and verify your email address, please use the following verification code:</p>
                            
                            <div class="otp-box">
                                <div class="otp-code">${otp}</div>
                                <div class="expiry">This code expires in ${OTP_EXPIRY_MINUTES} minutes</div>
                            </div>

                            <div class="warning">
                                <strong>Security Notice:</strong> Never share this code with anyone. PESO Juban staff will never ask for this code.
                            </div>

                            <p>If you didn't request this code, please ignore this email or contact our support team immediately.</p>
                            
                            <p>Best regards,<br><strong>PESO Juban Team</strong></p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2026 Public Employment Service Office — Juban. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        };

        await emailTransporter.sendMail(mailOptions);
        console.log(`✅ OTP email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending OTP email:', error.message);
        throw error;
    }
};

/**
 * Send OTP via SMS using Twilio
 * Production: Uses Twilio API
 * Development: Logs OTP to console
 */
const sendOTPSMS = async (phone, otp, userName = 'User') => {
    try {
        const message = `PESO Juban: Your verification code is ${otp}. This code expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`;

        // Production: Use Twilio
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER && process.env.NODE_ENV === 'production') {
            try {
                await twilioClient.messages.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phone, // Ensure phone is in E.164 format
                });
                console.log(`✅ OTP SMS sent to ${phone}`);
                return true;
            } catch (twilioError) {
                console.error('❌ Twilio SMS error:', twilioError.message);
                throw twilioError;
            }
        }

        // Development: Log to console
        if (process.env.NODE_ENV === 'development') {
            console.log(`\n${'='.repeat(60)}`);
            console.log('📱 SMS OTP (Development Mode)');
            console.log(`${'='.repeat(60)}`);
            console.log(`To: ${phone}`);
            console.log(`User: ${userName}`);
            console.log(`OTP Code: ${otp}`);
            console.log(`Message: ${message}`);
            console.log(`${'='.repeat(60)}\n`);
            return true;
        }

        // Fallback if Twilio not configured in production
        if (process.env.NODE_ENV === 'production' && !twilioClient) {
            console.warn('⚠️  Twilio not configured, SMS OTP:', otp);
            return true; // Allow flow to continue
        }

        return true;
    } catch (error) {
        console.error('❌ Error sending OTP SMS:', error.message);
        throw error;
    }
};

/**
 * Request OTP - Generate and send OTP to email or phone
 * @param {string} identifier - Email or phone number
 * @param {string} userName - User's name for personalization
 * @returns {object} Response with message and OTP ID
 */
const requestOTP = async (identifier, userName = 'User') => {
    try {
        const trimmedIdentifier = String(identifier).trim();

        // Determine if email or phone
        let otpType = 'email';
        let isValidIdentifier = false;

        if (trimmedIdentifier.includes('@')) {
            isValidIdentifier = isValidEmail(trimmedIdentifier);
            otpType = 'email';
        } else {
            isValidIdentifier = isValidPhone(trimmedIdentifier);
            otpType = 'phone';
        }

        if (!isValidIdentifier) {
            const error = new Error(
                otpType === 'email' 
                    ? 'Please provide a valid email address' 
                    : 'Please provide a valid phone number'
            );
            error.statusCode = 400;
            throw error;
        }

        // Check for existing unverified OTP (cooldown)
        const [existingOTP] = await db.execute(
            `SELECT otp_id, created_at FROM otp_verifications 
             WHERE identifier = ? AND is_verified = 0 
             ORDER BY created_at DESC LIMIT 1`,
            [trimmedIdentifier]
        );

        if (existingOTP.length > 0) {
            const createdAt = new Date(existingOTP[0].created_at);
            const secondsSinceCreation = Math.floor((Date.now() - createdAt) / 1000);

            if (secondsSinceCreation < RESEND_COOLDOWN_SECONDS) {
                const secondsRemaining = RESEND_COOLDOWN_SECONDS - secondsSinceCreation;
                const error = new Error(
                    `Please wait ${secondsRemaining} seconds before requesting a new OTP`
                );
                error.statusCode = 429;
                throw error;
            }
        }

        // Check if identifier already has verified account
        const [existingUser] = await db.execute(
            'SELECT user_id FROM users WHERE email = ? OR phone = ?',
            [trimmedIdentifier, trimmedIdentifier]
        );

        if (existingUser.length > 0) {
            const error = new Error('This email or phone number is already registered');
            error.statusCode = 409;
            throw error;
        }

        // Generate new OTP
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // Store OTP in database
        const [result] = await db.execute(
            `INSERT INTO otp_verifications 
             (identifier, otp_code, otp_type, expires_at, attempts, max_attempts) 
             VALUES (?, ?, ?, ?, 0, ?)`,
            [trimmedIdentifier, otp, otpType, expiresAt, MAX_ATTEMPTS]
        );

        // Send OTP
        if (otpType === 'email') {
            await sendOTPEmail(trimmedIdentifier, otp, userName);
        } else {
            await sendOTPSMS(trimmedIdentifier, otp);
        }

        return {
            message: `OTP sent to your ${otpType}`,
            otpId: result.insertId,
            identifier: otpType === 'email' 
                ? `${trimmedIdentifier.substring(0, 2)}***@${trimmedIdentifier.split('@')[1]}`
                : `${trimmedIdentifier.substring(0, 3)}***${trimmedIdentifier.substring(trimmedIdentifier.length - 4)}`,
        };
    } catch (error) {
        if (!error.statusCode) {
            console.error('Request OTP error:', error.message);
            error.statusCode = 500;
        }
        throw error;
    }
};

/**
 * Verify OTP - Validate OTP code
 * @param {string} identifier - Email or phone number
 * @param {string} otpCode - OTP code to verify
 * @returns {object} Response with verified status
 */
const verifyOTP = async (identifier, otpCode) => {
    try {
        const trimmedIdentifier = String(identifier).trim();
        const trimmedOTP = String(otpCode).trim();

        if (!trimmedOTP || trimmedOTP.length !== OTP_LENGTH) {
            const error = new Error(`OTP must be ${OTP_LENGTH} digits`);
            error.statusCode = 400;
            throw error;
        }

        // Get the unverified OTP
        const [otpRecords] = await db.execute(
            `SELECT otp_id, otp_code, attempts, max_attempts, expires_at 
             FROM otp_verifications 
             WHERE identifier = ? AND is_verified = 0 
             ORDER BY created_at DESC LIMIT 1`,
            [trimmedIdentifier]
        );

        if (otpRecords.length === 0) {
            const error = new Error('No OTP request found. Please request a new OTP.');
            error.statusCode = 404;
            throw error;
        }

        const otpRecord = otpRecords[0];

        // Check if OTP has expired
        const expiresAt = new Date(otpRecord.expires_at);
        if (Date.now() > expiresAt) {
            const error = new Error('OTP has expired. Please request a new one.');
            error.statusCode = 410;
            throw error;
        }

        // Check max attempts
        if (otpRecord.attempts >= otpRecord.max_attempts) {
            const error = new Error(
                `Maximum OTP verification attempts exceeded. Please request a new OTP.`
            );
            error.statusCode = 429;
            throw error;
        }

        // Increment attempts
        await db.execute(
            'UPDATE otp_verifications SET attempts = attempts + 1 WHERE otp_id = ?',
            [otpRecord.otp_id]
        );

        // Verify OTP code (constant-time comparison)
        const isOTPValid = crypto.timingSafeEqual(
            Buffer.from(otpRecord.otp_code),
            Buffer.from(trimmedOTP)
        );

        if (!isOTPValid) {
            const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts;
            const error = new Error(
                `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
            );
            error.statusCode = 401;
            throw error;
        }

        // Mark OTP as verified
        await db.execute(
            'UPDATE otp_verifications SET is_verified = 1, verified_at = NOW() WHERE otp_id = ?',
            [otpRecord.otp_id]
        );

        return {
            message: 'OTP verified successfully',
            otpId: otpRecord.otp_id,
            verified: true,
        };
    } catch (error) {
        if (!error.statusCode) {
            console.error('Verify OTP error:', error.message);
            error.statusCode = 500;
        }
        throw error;
    }
};

/**
 * Resend OTP - Send a new OTP code
 */
const resendOTP = async (identifier, userName = 'User') => {
    try {
        const trimmedIdentifier = String(identifier).trim();

        // Delete old unverified OTP
        await db.execute(
            'DELETE FROM otp_verifications WHERE identifier = ? AND is_verified = 0',
            [trimmedIdentifier]
        );

        // Request new OTP
        return await requestOTP(trimmedIdentifier, userName);
    } catch (error) {
        if (!error.statusCode) {
            console.error('Resend OTP error:', error.message);
            error.statusCode = 500;
        }
        throw error;
    }
};

/**
 * Store temporary user data during signup flow
 * Data is stored with OTP and retrieved after verification
 */
const storeTempUserData = async (identifier, userData) => {
    try {
        const trimmedIdentifier = String(identifier).trim();

        const [otpRecords] = await db.execute(
            `SELECT otp_id FROM otp_verifications 
             WHERE identifier = ? AND is_verified = 0 
             ORDER BY created_at DESC LIMIT 1`,
            [trimmedIdentifier]
        );

        if (otpRecords.length === 0) {
            const error = new Error('OTP not found');
            error.statusCode = 404;
            throw error;
        }

        await db.execute(
            'UPDATE otp_verifications SET temp_user_data = ? WHERE otp_id = ?',
            [JSON.stringify(userData), otpRecords[0].otp_id]
        );

        return true;
    } catch (error) {
        console.error('Store temp user data error:', error.message);
        throw error;
    }
};

/**
 * Retrieve temporary user data after OTP verification
 */
const getTempUserData = async (identifier) => {
    try {
        const trimmedIdentifier = String(identifier).trim();

        const [otpRecords] = await db.execute(
            `SELECT temp_user_data FROM otp_verifications 
             WHERE identifier = ? AND is_verified = 1 
             ORDER BY verified_at DESC LIMIT 1`,
            [trimmedIdentifier]
        );

        if (otpRecords.length === 0) {
            return null;
        }

        const tempData = otpRecords[0].temp_user_data;
        return tempData ? JSON.parse(tempData) : null;
    } catch (error) {
        console.error('Get temp user data error:', error.message);
        return null;
    }
};

/**
 * Clean up expired OTPs (run periodically)
 */
const cleanupExpiredOTPs = async () => {
    try {
        const [result] = await db.execute(
            `DELETE FROM otp_verifications 
             WHERE expires_at < NOW() AND is_verified = 0`
        );
        console.log(`✅ Cleaned up ${result.affectedRows} expired OTPs`);
    } catch (error) {
        console.error('Cleanup expired OTPs error:', error.message);
    }
};

// Run cleanup every hour
setInterval(cleanupExpiredOTPs, 60 * 60 * 1000);

module.exports = {
    requestOTP,
    verifyOTP,
    resendOTP,
    storeTempUserData,
    getTempUserData,
    cleanupExpiredOTPs,
    OTP_EXPIRY_MINUTES,
};
