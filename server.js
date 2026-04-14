require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// --- TRUST PROXY ---
// Required for Railway/Heroku to see the real client IP for rate limiting
app.set('trust proxy', 1);

// --- CORS CONFIGURATION ---
const allowedOrigins = [
    'https://pesojuban.netlify.app',
    ...(process.env.CORS_ORIGIN || 'http://localhost:5173')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
];

// Deduplicate for safety
const uniqueOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        if (uniqueOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Logs precisely which origin was blocked for easier debugging in Railway logs
            console.error(`CORS blocked origin: "${origin}"`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Apply CORS FIRST
app.use(cors(corsOptions));

// --- SECURITY MIDDLEWARE ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Essential for serving /uploads to the frontend
}));

// Rate Limiters
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});
app.use('/api/', generalLimiter);

// Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// --- ROUTES ---

// Auth
app.use('/api/auth', require('./src/routes/auth.routes.js'));

// Business Logic
app.use('/api/tupad', require('./src/routes/tupad.routes.js'));
app.use('/api/programs', require('./src/routes/program.routes.js'));
app.use('/api/beneficiaries', require('./src/routes/beneficiary.routes.js'));
app.use('/api/applications', require('./src/routes/application.routes.js'));
app.use('/api/attendance', require('./src/routes/attendance.routes.js'));
app.use('/api/notifications', require('./src/routes/notification.routes.js'));
app.use('/api/payroll', require('./src/routes/payroll.routes.js'));
app.use('/api/reports', require('./src/routes/reports.routes.js'));
app.use('/api/spes-documents', require('./src/routes/spes.documents.routes.js'));
app.use('/api/documents', require('./src/routes/documents.routes.js'));
app.use('/api/admin/documents', require('./src/routes/admin.documents.routes.js'));

// Static Assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Logout (Simple JSON response)
app.post('/api/logout', (req, res) => {
    res.status(200).json({ message: 'Logged out' });
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Whitelisted Origins:`, uniqueOrigins);
});