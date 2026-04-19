require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

app.set("trust proxy", 1);

// --- CORS CONFIGURATION ---
const allowedOrigins = [
    "https://peso-juban.vercel.app", // additional production frontend
    "http://localhost:5173", // this is for local development (Vite default port)
    "http://localhost:5174", // additional local port (if needed)
    "http://localhost:5175", // additional local port (if needed)
];

const corsOptions = {
    origin: (origin, callback) => {
        console.log("Incoming Origin:", origin);

        // Allow requests with no origin (Postman, curl, mobile apps)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.error(`❌ CORS blocked: ${origin}`);
        return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// --- SECURITY ---
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
);

// --- RATE LIMIT (skip OPTIONS) ---
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS", // 🔥 IMPORTANT FIX
    message: { message: "Too many requests, please try again later." },
});

app.use("/api/", generalLimiter);

// --- BODY PARSERS ---
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// --- DEBUG LOGGER (optional but useful) ---
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// --- ROUTES ---
app.use("/api/auth", require("./src/routes/auth.routes.js"));
app.use("/api/tupad", require("./src/routes/tupad.routes.js"));
app.use("/api/programs", require("./src/routes/program.routes.js"));
app.use("/api/beneficiaries", require("./src/routes/beneficiary.routes.js"));
app.use("/api/applications", require("./src/routes/application.routes.js"));
app.use("/api/attendance", require("./src/routes/attendance.routes.js"));
app.use("/api/notifications", require("./src/routes/notification.routes.js"));
app.use("/api/payroll", require("./src/routes/payroll.routes.js"));
app.use("/api/reports", require("./src/routes/reports.routes.js"));
app.use(
    "/api/spes-documents",
    require("./src/routes/spes.documents.routes.js"),
);
app.use("/api/documents", require("./src/routes/documents.routes.js"));
app.use(
    "/api/admin/documents",
    require("./src/routes/admin.documents.routes.js"),
);

// --- STATIC FILES ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- HEALTH CHECK ---
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
});

// --- LOGOUT ---
app.post("/api/logout", (req, res) => {
    res.status(200).json({ message: "Logged out successfully" });
});

// --- GLOBAL ERROR HANDLER (VERY IMPORTANT) ---
app.use((err, req, res, next) => {
    console.error("🔥 ERROR:", err.message);

    if (err.message.includes("CORS")) {
        return res.status(403).json({
            message: "CORS Error: Origin not allowed",
        });
    }

    res.status(500).json({
        message: "Internal Server Error",
    });
});

// --- START SERVER ---
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log("✅ Allowed Origins:", allowedOrigins);
});
