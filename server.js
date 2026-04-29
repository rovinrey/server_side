require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();

// Trust proxy (needed for Railway)
app.set("trust proxy", 1);

// Detect environment
const isProduction = process.env.NODE_ENV === "production";

// ============================
// ✅ CORS CONFIG (FIXED)
// ============================
const allowedOrigins = [
    "https://peso-juban.vercel.app", // production frontend
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];

app.use(
    cors({
        origin: (origin, callback) => {
            console.log("Incoming Origin:", origin);

            // Allow tools like Postman / server-to-server
            if (!origin) return callback(null, true);

            // In development → allow everything
            if (!isProduction) {
                return callback(null, true);
            }

            // In production → restrict
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.warn("❌ Blocked by CORS:", origin);

            // IMPORTANT: don't throw error → avoids fake 403
            return callback(null, false);
        },
        credentials: true,
    })
);

// ============================
// 🔒 SECURITY
// ============================
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);

// ============================
// 🚦 RATE LIMIT
// ============================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000, // stricter in production
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
});

app.use("/api/", limiter);

// ============================
// 📦 BODY PARSER
// ============================
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ============================
// 🧪 DEBUG LOGGER (DEV ONLY)
// ============================
if (!isProduction) {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    });
}

// ============================
// 📂 ROUTES
// ============================
app.use("/api/auth", require("./src/routes/auth.routes.js"));
app.use("/api/tupad", require("./src/routes/tupad.routes.js"));
app.use("/api/programs", require("./src/routes/program.routes.js"));
app.use("/api/beneficiaries", require("./src/routes/beneficiary.routes.js"));
app.use("/api/applications", require("./src/routes/application.routes.js"));
app.use("/api/attendance", require("./src/routes/attendance.routes.js"));
app.use("/api/notifications", require("./src/routes/notification.routes.js"));
app.use("/api/payroll", require("./src/routes/payroll.routes.js"));
app.use("/api/reports", require("./src/routes/reports.routes.js"));
app.use("/api/spes-documents", require("./src/routes/spes.documents.routes.js"));
app.use("/api/documents", require("./src/routes/documents.routes.js"));
app.use("/api/admin/documents", require("./src/routes/admin.documents.routes.js"));

// ============================
// 📁 STATIC FILES
// ============================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============================
// ❤️ HEALTH CHECK
// ============================
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        env: isProduction ? "production" : "development",
        time: new Date().toISOString(),
    });
});

// ============================
// 🚪 LOGOUT
// ============================
app.post("/api/logout", (req, res) => {
    res.json({ message: "Logged out successfully" });
});

// ============================
// ❌ GLOBAL ERROR HANDLER
// ============================
app.use((err, req, res, next) => {
    console.error("🔥 ERROR:", err.message);

    // Handle CORS safely
    if (err.message && err.message.includes("CORS")) {
        return res.status(403).json({
            message: "Request blocked by CORS",
        });
    }

    res.status(500).json({
        message: "Internal Server Error",
    });
});

// ============================
// 🚀 START SERVER
// ============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(
        `🚀 Server running on port ${PORT} (${isProduction ? "PROD" : "DEV"})`
    );
});