const express = require('express');
const router = express.Router();
const beneficiaryController = require('../controllers/beneficiary.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, beneficiaryController.getAllBeneficiaries);

// return total number of beneficiaries for dashboard stats
router.get('/count', authMiddleware, beneficiaryController.getCount);

// Admin management routes (require auth)
router.get('/admin/all', authMiddleware, beneficiaryController.getAllForAdmin);
router.get('/admin/:beneficiaryId', authMiddleware, beneficiaryController.getById);
router.post('/admin', authMiddleware, beneficiaryController.addBeneficiary);
router.put('/admin/:beneficiaryId', authMiddleware, beneficiaryController.updateBeneficiary);
router.delete('/admin/:beneficiaryId', authMiddleware, beneficiaryController.deleteBeneficiary);

router.get('/:applicationId/details', authMiddleware, beneficiaryController.getBeneficiaryApplicationDetails);

module.exports = router;