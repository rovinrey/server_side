const express = require('express');
const cors = require('cors');
const router = express.Router();
router.use(cors());
const reportsController = require('../controllers/reports.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireAdminOrStaff } = require('../validators/common.validators');

// ── JSON endpoints (for frontend display) ──────────

router.get('/program-accomplishment', authMiddleware, requireAdminOrStaff, reportsController.getProgramAccomplishment);
router.get('/beneficiary-master-list', authMiddleware, requireAdminOrStaff, reportsController.getBeneficiaryMasterList);
router.get('/payroll-summary', authMiddleware, requireAdminOrStaff, reportsController.getPayrollSummary);
router.get('/attendance-summary', authMiddleware, requireAdminOrStaff, reportsController.getAttendanceSummary);
router.get('/dilp-monitoring', authMiddleware, requireAdminOrStaff, reportsController.getDilpMonitoringReport);
router.get('/employment-facilitation', authMiddleware, requireAdminOrStaff, reportsController.getEmploymentFacilitationReport);
router.get('/spes', authMiddleware, requireAdminOrStaff, reportsController.getSpesReport);
router.get('/gip', authMiddleware, requireAdminOrStaff, reportsController.getGipReport);
router.get('/consolidated', authMiddleware, requireAdminOrStaff, reportsController.getConsolidatedReport);

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

module.exports = router;
