const nodemailer = require('nodemailer');

const sendResetEmail = async (to, token) => {
    // Configure your transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail', // or your email provider
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: 'Password Reset Request',
        html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset Password</a></p><p>If you did not request this, ignore this email.</p>`
    });
};

module.exports = { sendResetEmail };