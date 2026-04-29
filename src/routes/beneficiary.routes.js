const express = require('express');
const router = express.Router();
const beneficiaryController = require('../controllers/beneficiary.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireAdmin, requireAdminOrStaff } = require('../validators/common.validators');

router.get('/', authMiddleware, requireAdminOrStaff, beneficiaryController.getAllBeneficiaries);

// return total number of beneficiaries for dashboard stats
router.get('/count', authMiddleware, requireAdminOrStaff, beneficiaryController.getCount);

// Admin management routes
router.get('/admin/all', authMiddleware, requireAdminOrStaff, beneficiaryController.getAllForAdmin);
router.get('/admin/:beneficiaryId', authMiddleware, requireAdminOrStaff, beneficiaryController.getById);
router.post('/admin', authMiddleware, requireAdmin, beneficiaryController.addBeneficiary);
router.put('/admin/:beneficiaryId', authMiddleware, requireAdmin, beneficiaryController.updateBeneficiary);
router.delete('/admin/:beneficiaryId', authMiddleware, requireAdmin, beneficiaryController.deleteBeneficiary);

router.get('/:applicationId/details', authMiddleware, requireAdminOrStaff, beneficiaryController.getBeneficiaryApplicationDetails);

// =============================================
// Enrollment routes
// =============================================
router.post('/enroll', authMiddleware, requireAdminOrStaff, beneficiaryController.enrollBeneficiary);
router.get('/enroll/:applicationId/status', authMiddleware, requireAdminOrStaff, beneficiaryController.getEnrollmentStatus);
router.get('/program/:programId/enrollees', authMiddleware, requireAdminOrStaff, beneficiaryController.getProgramEnrollees);
router.put('/enroll/:enrolleeId/status', authMiddleware, requireAdminOrStaff, beneficiaryController.updateEnrollmentStatus);

module.exports = router;