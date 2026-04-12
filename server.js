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
const notificationRoutes = require('./src/routes/notification.routes.js');

// --- APP SETUP ---
const app = express();
app.set('trust proxy', 1); // if behind a proxy (e.g. Heroku, Railway) to get correct client IP for rate limiting  

// --- SECURITY MIDDLEWARE ---

// CORS must come FIRST — before helmet, before anything else
// so that preflight OPTIONS requests get proper headers even on error responses
const allowedOrigins = [
    'https://pesojuban.netlify.app',
    ...(process.env.CORS_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
];
// Deduplicate origins
const uniqueOrigins = [...new Set(allowedOrigins)];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin || uniqueOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`CORS blocked origin: "${origin}" | Allowed: ${JSON.stringify(uniqueOrigins)}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Helmet sets secure HTTP headers (XSS protection, content-type sniffing, etc.)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving uploads cross-origin
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
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

app.use('/api/', generalLimiter);

// Body parser with size limit to prevent payload attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// --- AUTH ROUTES (stricter limiter applied per-route inside auth.routes) ---
app.use('/api/auth', authRoutes);

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
app.use('/api/notifications', notificationRoutes);
app.use('/api/payroll', require('./src/routes/payroll.routes.js'));
app.use('/api/reports', require('./src/routes/reports.routes.js'));
app.use('/api/spes-documents', require('./src/routes/spes.documents.routes.js'));
app.use('/api/documents', require('./src/routes/documents.routes.js'));
app.use('/api/admin/documents', require('./src/routes/admin.documents.routes.js'));

// Serve uploaded files as static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- HEALTH CHECK (useful for Railway / uptime monitors) ---
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server live at http://localhost:${PORT}`);
});