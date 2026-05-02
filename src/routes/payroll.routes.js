const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireAdmin, requireAdminOrStaff } = require('../validators/common.validators');

// Payroll management (admin only for generate/approve/release)
router.post('/generate', authMiddleware, requireAdmin, payrollController.generatePayroll);
router.get('/', authMiddleware, requireAdminOrStaff, payrollController.getPayroll);
router.put('/approve', authMiddleware, requireAdmin, payrollController.approvePayroll);
router.put('/release', authMiddleware, requireAdmin, payrollController.releasePayroll);

// Analytics (admin/staff)
router.get('/analytics', authMiddleware, requireAdminOrStaff, payrollController.getAnalytics);

// Disbursements (admin only)
router.post('/disbursements', authMiddleware, requireAdmin, payrollController.createDisbursement);
router.get('/disbursements', authMiddleware, requireAdminOrStaff, payrollController.getDisbursements);
router.put('/disbursements/:id/status', authMiddleware, requireAdmin, payrollController.updateDisbursementStatus);

// Beneficiary self-service
router.get('/my-payouts', authMiddleware, payrollController.getBeneficiaryPayouts);

// Daily wage settings
router.post('/daily-wage', authMiddleware, requireAdmin, payrollController.setDailyWage);
router.get('/daily-wage', authMiddleware, requireAdminOrStaff, payrollController.getAllDailyWages);

module.exports = router;
