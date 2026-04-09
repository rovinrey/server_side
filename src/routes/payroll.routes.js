const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Payroll management (admin/staff)
router.post('/generate', authMiddleware, payrollController.generatePayroll);
router.get('/', authMiddleware, payrollController.getPayroll);
router.put('/approve', authMiddleware, payrollController.approvePayroll);
router.put('/release', authMiddleware, payrollController.releasePayroll);

// Analytics
router.get('/analytics', authMiddleware, payrollController.getAnalytics);

// Disbursements
router.post('/disbursements', authMiddleware, payrollController.createDisbursement);
router.get('/disbursements', authMiddleware, payrollController.getDisbursements);
router.put('/disbursements/:id/status', authMiddleware, payrollController.updateDisbursementStatus);

// Beneficiary self-service
router.get('/my-payouts', authMiddleware, payrollController.getBeneficiaryPayouts);

module.exports = router;
