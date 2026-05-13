import { Router } from 'express';
const router = Router();
import {
  handleGeneratePayroll,
  handleGetPayroll,
  handleApprovePayroll,
  handleReleasePayroll,
  handleGetAnalytics,
  handleCreateDisbursement,
  handleGetDisbursements,
  handleUpdateDisbursementStatus,
  handleGetBeneficiaryPayouts,
  handleSetDailyWage,
  handleGetAllDailyWages,
} from '../controllers/payroll.controller.js';


import authMiddleware from '../middlewares/auth.middleware.js';
import { requireAdmin, requireAdminOrStaff } from '../validators/common.validators.js';

// Payroll management (admin only for generate/approve/release)
router.post('/generate', authMiddleware, requireAdmin, handleGeneratePayroll);
router.get('/', authMiddleware, requireAdminOrStaff, handleGetPayroll);
router.put('/approve', authMiddleware, requireAdmin, handleApprovePayroll);
router.put('/release', authMiddleware, requireAdmin, handleReleasePayroll);


// Analytics (admin/staff)
router.get('/analytics', authMiddleware, requireAdminOrStaff, handleGetAnalytics);


// Disbursements (admin only)
router.post('/disbursements', authMiddleware, requireAdmin, handleCreateDisbursement);

router.get('/disbursements', authMiddleware, requireAdminOrStaff, handleGetDisbursements);

router.put('/disbursements/:id/status', authMiddleware, requireAdmin, handleUpdateDisbursementStatus);


// Beneficiary self-service
router.get('/my-payouts', authMiddleware, handleGetBeneficiaryPayouts);


// Daily wage settings
router.post('/daily-wage', authMiddleware, requireAdmin, handleSetDailyWage);

router.get('/daily-wage', authMiddleware, requireAdminOrStaff, handleGetAllDailyWages);


export default router;
