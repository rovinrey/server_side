
import { Router } from 'express';
const router = Router();
import {
  handleGetSummaryReport as getSummaryReport,
  handleGetProgramAccomplishment as getProgramAccomplishment,
  handleGetBeneficiaryMasterList as getBeneficiaryMasterList,
  handleGetPayrollSummary as getPayrollSummary,
  handleGetAttendanceSummary as getAttendanceSummary,
  handleGetDilpMonitoringReport as getDilpMonitoringReport,
  handleGetEmploymentFacilitationReport as getEmploymentFacilitationReport,
  handleGetSpesReport as getSpesReport,
  handleGetGipReport as getGipReport,
  handleGetConsolidatedReport as getConsolidatedReport,
  handleGetBarangayBeneficiaries as getBarangayBeneficiaries,
  handleGetBarangayList as getBarangayList,

  exportProgramAccomplishment,
  exportBeneficiaryMasterList,
  exportPayrollSummary,
  exportAttendanceSummary,
  exportDilpMonitoring,
  exportEmploymentFacilitation,
  exportSpesReport,
  exportGipReport,
  exportConsolidatedReport,
} from '../controllers/reports.controller.js';

import authMiddleware from '../middlewares/auth.middleware.js';
import { requireAdminOrStaff } from '../validators/common.validators.js';

// ── JSON endpoints (for frontend display) ──────────

// ── NEW: Analytics Summary Report ─────────────────────
router.get('/summary', authMiddleware, requireAdminOrStaff, getSummaryReport);

router.get('/program-accomplishment', authMiddleware, requireAdminOrStaff, getProgramAccomplishment);
router.get('/beneficiary-master-list', authMiddleware, requireAdminOrStaff, getBeneficiaryMasterList);
router.get('/payroll-summary', authMiddleware, requireAdminOrStaff, getPayrollSummary);
router.get('/attendance-summary', authMiddleware, requireAdminOrStaff, getAttendanceSummary);
router.get('/dilp-monitoring', authMiddleware, requireAdminOrStaff, getDilpMonitoringReport);
router.get('/employment-facilitation', authMiddleware, requireAdminOrStaff, getEmploymentFacilitationReport);
router.get('/spes', authMiddleware, requireAdminOrStaff, getSpesReport);
router.get('/gip', authMiddleware, requireAdminOrStaff, getGipReport);
router.get('/consolidated', authMiddleware, requireAdminOrStaff, getConsolidatedReport);
router.get('/barangay-beneficiaries', authMiddleware, requireAdminOrStaff, getBarangayBeneficiaries);
router.get('/barangay-list', authMiddleware, requireAdminOrStaff, getBarangayList);

// ── Excel export endpoints ─────────────────────────

router.get('/export/program-accomplishment', authMiddleware, requireAdminOrStaff, exportProgramAccomplishment);
router.get('/export/beneficiary-master-list', authMiddleware, requireAdminOrStaff, exportBeneficiaryMasterList);
router.get('/export/payroll-summary', authMiddleware, requireAdminOrStaff, exportPayrollSummary);
router.get('/export/attendance-summary', authMiddleware, requireAdminOrStaff, exportAttendanceSummary);
router.get('/export/dilp-monitoring', authMiddleware, requireAdminOrStaff, exportDilpMonitoring);
router.get('/export/employment-facilitation', authMiddleware, requireAdminOrStaff, exportEmploymentFacilitation);
router.get('/export/spes', authMiddleware, requireAdminOrStaff, exportSpesReport);
router.get('/export/gip', authMiddleware, requireAdminOrStaff, exportGipReport);
router.get('/export/consolidated', authMiddleware, requireAdminOrStaff, exportConsolidatedReport);

export default router;
