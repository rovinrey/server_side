// this is the routes for the form submissionss
// for all programs

const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');
const { validateTupad } = require('../validators/tupad.validators');
const { validatedSpes } = require('../validators/spes.validators');
const { validateDilp } = require('../validators/dilp.validators');
const { validateGip } = require('../validators/gip.validators');
const { validateJobSeekers } = require('../validators/jobseeker.validators');
const { requireAdmin, requireAdminOrStaff } = require('../validators/common.validators');
const authMiddleware = require('../middlewares/auth.middleware');
// Get all applications from all program

router.get('/all', authMiddleware, applicationController.getAllApplications);
router.get('/export', authMiddleware, requireAdmin, applicationController.exportApplications);
router.get('/reports/tupad-monthly', authMiddleware, applicationController.getTupadMonthlyReport);
router.get('/settings/daily-wage', authMiddleware, applicationController.getDailyWage);
router.put('/settings/daily-wage', authMiddleware, requireAdmin, applicationController.updateDailyWage);

// If you want the full URL to be /api/forms/apply/tupad
// You only put /apply/tupad here:
router.post('/apply/tupad', authMiddleware, validateTupad, applicationController.applyToTupad);
router.put('/approved/application/tupad/:id', authMiddleware, applicationController.approvedTupadApplication);

// SPES route
router.post('/apply/spes', authMiddleware, validatedSpes, applicationController.applyToSpes);
router.post('/spes', authMiddleware, applicationController.createSpesDetails);
router.get('/spes/:applicationId', authMiddleware, applicationController.getSpesDetails);
router.put('/spes/:detailId', authMiddleware, applicationController.updateSpesDetails);

// DILP route
router.post('/apply/dilp', authMiddleware, validateDilp, applicationController.applyToDilp);

// GIP route
router.post('/apply/gip', authMiddleware, validateGip, applicationController.applyToGip);

// Job Seekers route
router.post('/apply/job_seekers', authMiddleware, validateJobSeekers, applicationController.applyToJobSeekers);

// Get recent applications
router.get('/recent', authMiddleware, applicationController.getRecentApplications);
router.get('/status', authMiddleware, applicationController.getApplicationStatus);

// Application approval routes
router.get('/applications/pending', authMiddleware, applicationController.getPendingApplications);
router.get('/applications', authMiddleware, applicationController.getApplicationsByStatus);
router.put('/applications/:id/approve', authMiddleware, requireAdminOrStaff, applicationController.approveApplication);
router.put('/applications/:id/reject', authMiddleware, requireAdminOrStaff, applicationController.rejectApplication);

// Admin: TUPAD details CRUD
router.get('/tupad/:applicationId', authMiddleware, applicationController.getTupadDetails);
router.put('/tupad/:detailId', authMiddleware, applicationController.updateTupadDetails);

// Admin: Update beneficiary personal info linked to an application
router.put('/applications/:applicationId/beneficiary', authMiddleware, applicationController.updateApplicationBeneficiary);

// Admin: Annex D export
router.get('/annex-d/export', authMiddleware, applicationController.exportAnnexD);

// Admin: Batch update Excel data inline (without MS Excel)
router.put('/excel/update', authMiddleware, applicationController.updateExcelData);

// Admin: Duplicate detection & management
router.get('/duplicates/detect', authMiddleware, applicationController.detectDuplicates);
router.get('/duplicates/marked', authMiddleware, applicationController.getMarkedDuplicates);
router.put('/duplicates/:applicationId/mark', authMiddleware, applicationController.markDuplicate);
router.put('/duplicates/:applicationId/unmark', authMiddleware, applicationController.unmarkDuplicate);
router.put('/duplicates/:applicationId/resolve', authMiddleware, applicationController.resolveDuplicate);

// Admin: Duplicate beneficiaries
router.get('/duplicates/beneficiaries', authMiddleware, applicationController.detectDuplicateBeneficiaries);
router.delete('/duplicates/beneficiaries/:beneficiaryId', authMiddleware, applicationController.deleteBeneficiary);

// Admin: Duplicate attendance
router.get('/duplicates/attendance', authMiddleware, applicationController.detectDuplicateAttendance);
router.delete('/duplicates/attendance/:attendanceId', authMiddleware, applicationController.deleteAttendanceRecord);

module.exports = router;