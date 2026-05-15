
const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireAdminOrStaff } = require('../validators/common.validators');

// ── JSON endpoints (for frontend display) ──────────

// ── NEW: Analytics Summary Report ─────────────────────
router.get('/summary', authMiddleware, requireAdminOrStaff, reportsController.getSummaryReport);

router.get('/program-accomplishment', authMiddleware, requireAdminOrStaff, reportsController.getProgramAccomplishment);
router.get('/beneficiary-master-list', authMiddleware, requireAdminOrStaff, reportsController.getBeneficiaryMasterList);
router.get('/payroll-summary', authMiddleware, requireAdminOrStaff, reportsController.getPayrollSummary);
router.get('/attendance-summary', authMiddleware, requireAdminOrStaff, reportsController.getAttendanceSummary);
router.get('/dilp-monitoring', authMiddleware, requireAdminOrStaff, reportsController.getDilpMonitoringReport);
router.get('/employment-facilitation', authMiddleware, requireAdminOrStaff, reportsController.getEmploymentFacilitationReport);
router.get('/spes', authMiddleware, requireAdminOrStaff, reportsController.getSpesReport);
router.get('/gip', authMiddleware, requireAdminOrStaff, reportsController.getGipReport);
router.get('/consolidated', authMiddleware, requireAdminOrStaff, reportsController.getConsolidatedReport);
router.get('/barangay-beneficiaries', authMiddleware, requireAdminOrStaff, reportsController.getBarangayBeneficiaries);
router.get('/barangay-list', authMiddleware, requireAdminOrStaff, reportsController.getBarangayList);

// ── Annex K: Monthly/Completion Accomplishment Report ──
router.get('/annex-k/:programId', authMiddleware, requireAdminOrStaff, reportsController.generateAnnexK);

// ── Excel export endpoints ─────────────────────────

router.get('/export/program-accomplishment', authMiddleware, requireAdminOrStaff, reportsController.exportProgramAccomplishment);
router.get('/export/beneficiary-master-list', authMiddleware, requireAdminOrStaff, reportsController.exportBeneficiaryMasterList);
router.get('/export/payroll-summary', authMiddleware, requireAdminOrStaff, reportsController.exportPayrollSummary);
router.get('/export/attendance-summary', authMiddleware, requireAdminOrStaff, reportsController.exportAttendanceSummary);
router.get('/export/dilp-monitoring', authMiddleware, requireAdminOrStaff, reportsController.exportDilpMonitoring);
router.get('/export/employment-facilitation', authMiddleware, requireAdminOrStaff, reportsController.exportEmploymentFacilitation);
router.get('/export/spes', authMiddleware, requireAdminOrStaff, reportsController.exportSpesReport);
router.get('/export/gip', authMiddleware, requireAdminOrStaff, reportsController.exportGipReport);
router.get('/export/consolidated', authMiddleware, requireAdminOrStaff, reportsController.exportConsolidatedReport);

// Mount Before/After endpoints from a separate router for clarity.
const beforeAfterRoutes = require('./beforeAfter.reports.routes');
router.use(beforeAfterRoutes);


module.exports = router;
