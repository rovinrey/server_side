// 1. Core Dependencies
import "dotenv/config"; // Loads .env variables immediately
import express, { urlencoded, static as expressStatic } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// 2. Route Imports (Must include .js extension for ES Modules)
// We import these at the top level, not inside app.use()
import authRoutes from "./src/routes/auth.routes.js";
import tupadRoutes from "./src/routes/tupad.routes.js";
import programRoutes from "./src/routes/program.routes.js";
import beneficiaryRoutes from "./src/routes/beneficiary.routes.js";
import applicationRoutes from "./src/routes/application.routes.js";
import attendanceRoutes from "./src/routes/attendance.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import payrollRoutes from "./src/routes/payroll.routes.js";
import reportsRoutes from "./src/routes/reports.routes.js";
import spesRoutes from "./src/routes/spes.documents.routes.js";
import documentRoutes from "./src/routes/documents.routes.js";
import adminDocRoutes from "./src/routes/admin.documents.routes.js";

// 3. ESM Compatibility Helpers
// In ES Modules, __dirname is not globally available. We have to manually define it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 4. Infrastructure Config
app.set("trust proxy", 1); // Crucial for Railway/Vercel to get real user IPs for rate limiting
const isProduction = process.env.NODE_ENV === "production";

// 5. Security - CORS (Cross-Origin Resource Sharing)
// Ensures only our TUPAD frontend can talk to this API
const allowedOrigins = [
  "https://vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !isProduction || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn("❌ Blocked by CORS:", origin);
    return callback(new Error("CORS Not Allowed"), false);
  },
  credentials: true,
}));

// 6. Security - Helmet & Rate Limiting
// Helmet sets secure HTTP headers. Rate limit prevents brute-force attacks on our TUPAD data.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Stricter in production
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// 7. Middleware
app.use(express.json({ limit: "1mb" })); // Limits JSON payload to prevent memory exhaustion
app.use(urlencoded({ extended: true })); // Handles form-data submissions

// 8. API Routes Implementation
// We pass the imported router objects directly here. No 'require' or 'toExpressRouter' needed.
app.use("/api/auth", authRoutes);
app.use("/api/tupad", tupadRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/beneficiaries", beneficiaryRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/spes-documents", spesRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/admin/documents", adminDocRoutes);

// 9. Static Assets (For uploaded beneficiary documents/photos)
app.use("/uploads", expressStatic(join(__dirname, "uploads")));

// 10. Health Check & System Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: isProduction ? "production" : "development" });
});

app.post("/api/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// 11. Centralized Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 SYSTEM ERROR:", err.message);
  res.status(err.status || 500).json({
    message: isProduction ? "Internal Server Error" : err.message,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 TUPAD Backend running on port ${PORT}`);
});
