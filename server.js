require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// --- ROUTES ---
const programRoutes = require('./src/routes/program.routes.js');
const authRoutes = require('./src/routes/auth.routes.js');
const beneficiaryRoutes = require('./src/routes/beneficiary.routes.js');
const applicationsRoutes = require('./src/routes/application.routes.js');
const attendanceRoutes = require('./src/routes/attendance.routes.js');

// --- APP SETUP ---
const app = express();

// --- SECURITY MIDDLEWARE ---

// Helmet sets secure HTTP headers (XSS protection, content-type sniffing, etc.)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving uploads cross-origin
}));

// CORS — only allow the frontend origin defined in .env
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`CORS blocked origin: "${origin}" | Allowed: ${JSON.stringify(allowedOrigins)}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Rate limiting — protect auth endpoints from brute-force attacks
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // max 20 attempts per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

// General rate limit for all API routes
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

app.use('/api/', generalLimiter);

// Body parser with size limit to prevent payload attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// --- AUTH ROUTES (with stricter rate limit) ---
app.use('/api/auth', authLimiter, authRoutes);

// --- LOGOUT ROUTE ---
app.post('/logout', (req, res) => {
    res.status(200).json({ message: 'Logged out' });
});

// --- SYSTEM ROUTES ---
app.use('/api/tupad', require('./src/routes/tupad.routes.js'));
app.use('/api/forms', applicationsRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/beneficiaries', beneficiaryRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/spes-documents', require('./src/routes/spes.documents.routes.js'));
app.use('/api/documents', require('./src/routes/documents.routes.js'));
app.use('/api/admin/documents', require('./src/routes/admin.documents.routes.js'));

// Serve uploaded files as static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server live at http://localhost:${PORT}`);
});