
// this is the routes for the form submissionss
// for all programs

<<<<<<< HEAD
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
const reportPhotosUpload = require('../middlewares/tupad.reports.upload.middleware');
=======
import { Router } from 'express';
const router = Router();

import {
  handleGetAllApplications,
  handleExportApplications,
  handleGetTupadMonthlyReport,
  handleGetDailyWage,
  handleUpdateDailyWage,
  applyToTupad,
  handleApprovedTupadApplication,
  applyToSpes,
  handleSubmitCompleteSPESApplication,
  handleCreateSpesDetails,
  handleGetSpesDetails,
  handleUpdateSpesDetails,
  handleApplyToDilp,
  handleSubmitCompleteDILPApplication,
  handleApplyToGip,
  handleSubmitCompleteGIPApplication,
  handleApplyToJobSeekers,
  handleGetRecentApplications,
  getApplicationStatus,

  handleGetPendingApplications,
  handleGetApplicationsByStatus,
  handleGetApplicationEnrollmentStatus,
  handleApproveApplication,
  handleRejectApplication,
  handleGetTupadDetails,
  handleUpdateTupadDetails,
  handleUpdateApplicationBeneficiary,
  handleExportAnnexD,
  handleExportAnnexB,
  handleExportAnnexH,
  handleExportAnnexL,
  updateExcelData,

  handleDetectDuplicates,
  handleGetMarkedDuplicates,
  handleMarkDuplicate,
  handleUnmarkDuplicate,
  handleResolveDuplicate,
  handleDetectDuplicateBeneficiaries,
  handleDeleteBeneficiary,
  handleDetectDuplicateAttendance,
  handleDeleteAttendanceRecord,
} from '../controllers/application.controller.js';


import { validateTupad } from '../validators/tupad.validators.js';
import { validatedSpes } from '../validators/spes.validators.js';
import { validateDilp } from '../validators/dilp.validators.js';


import validateJobSeekers from '../validators/jobseeker.validators.js';

import { requireAdmin, requireAdminOrStaff } from '../validators/common.validators.js';
import authMiddleware from '../middlewares/auth.middleware.js';
>>>>>>> 826997eb2a2d518c1746e3b6f423c32c134faaa7
// Get all applications from all program

router.get('/all', authMiddleware, handleGetAllApplications);
router.get('/export', authMiddleware, requireAdmin, handleExportApplications);
router.get('/reports/tupad-monthly', authMiddleware, handleGetTupadMonthlyReport);
router.get('/settings/daily-wage', authMiddleware, handleGetDailyWage);
router.put('/settings/daily-wage', authMiddleware, requireAdmin, handleUpdateDailyWage);


// You only put /apply/tupad here:
router.post('/apply/tupad', authMiddleware, validateTupad, applyToTupad);
router.put('/approved/application/tupad/:id', authMiddleware, handleApprovedTupadApplication);


// SPES route
router.post('/apply/spes', authMiddleware, validatedSpes, applyToSpes);
router.post('/apply/spes/complete', authMiddleware, handleSubmitCompleteSPESApplication);
router.post('/spes', authMiddleware, handleCreateSpesDetails);
router.get('/spes/:applicationId', authMiddleware, handleGetSpesDetails);
router.put('/spes/:detailId', authMiddleware, handleUpdateSpesDetails);


// DILP route
router.post('/apply/dilp', authMiddleware, validateDilp, handleApplyToDilp);
router.post('/apply/dilp/complete', authMiddleware, handleSubmitCompleteDILPApplication);

// GIP route
router.post('/apply/gip', authMiddleware, handleApplyToGip);

router.post('/apply/gip/complete', authMiddleware, handleSubmitCompleteGIPApplication);

// Job Seekers route
router.post('/apply/job_seekers', authMiddleware, validateJobSeekers, handleApplyToJobSeekers);


// Get recent applications
router.get('/recent', authMiddleware, handleGetRecentApplications);
router.get('/status', authMiddleware, getApplicationStatus);


// Application approval routes
router.get('/pending', authMiddleware, handleGetPendingApplications);
router.get('/', authMiddleware, handleGetApplicationsByStatus);
router.get('/:id/enrollment-status', authMiddleware, handleGetApplicationEnrollmentStatus);
router.put('/:id/approve', authMiddleware, requireAdminOrStaff, handleApproveApplication);
router.put('/:id/reject', authMiddleware, requireAdminOrStaff, handleRejectApplication);

// Admin: TUPAD details CRUD
router.get('/tupad/:applicationId', authMiddleware, handleGetTupadDetails);
router.put('/tupad/:detailId', authMiddleware, handleUpdateTupadDetails);

// Admin: Update beneficiary personal info linked to an application
router.put('/:applicationId/beneficiary', authMiddleware, handleUpdateApplicationBeneficiary);

// Admin: PESO annex Excel exports
<<<<<<< HEAD
router.get('/annex-d/export', authMiddleware, applicationController.exportAnnexD);
router.get('/annex-b/export', authMiddleware, applicationController.exportAnnexB);
router.get('/annex-h/export', authMiddleware, applicationController.exportAnnexH);
router.get('/annex-l/export', authMiddleware, applicationController.exportAnnexL);
router.get('/annex-k/export', authMiddleware, applicationController.exportAnnexK);

// TUPAD Annex K report CRUD
router.post('/tupad-reports', authMiddleware, applicationController.createTupadReport);
router.post('/tupad-reports/:reportId/photos', authMiddleware, reportPhotosUpload.fields([
    { name: 'before_photo', maxCount: 1 },
    { name: 'during_photo', maxCount: 1 },
    { name: 'after_photo', maxCount: 1 },
]), applicationController.uploadTupadReportPhotos);
router.get('/tupad-reports', authMiddleware, applicationController.getTupadReports);
router.get('/tupad-reports/:reportId', authMiddleware, applicationController.getTupadReport);
=======
router.get('/annex-d/export', authMiddleware, handleExportAnnexD);
router.get('/annex-b/export', authMiddleware, handleExportAnnexB);
router.get('/annex-h/export', authMiddleware, handleExportAnnexH);
router.get('/annex-l/export', authMiddleware, handleExportAnnexL);
>>>>>>> 826997eb2a2d518c1746e3b6f423c32c134faaa7

// Admin: Batch update Excel data inline (without MS Excel)
router.put('/excel/update', authMiddleware, updateExcelData);


// Admin: Duplicate detection & management
router.get('/duplicates/detect', authMiddleware, handleDetectDuplicates);
router.get('/duplicates/marked', authMiddleware, handleGetMarkedDuplicates);
router.put('/duplicates/:applicationId/mark', authMiddleware, handleMarkDuplicate);
router.put('/duplicates/:applicationId/unmark', authMiddleware, handleUnmarkDuplicate);
router.put('/duplicates/:applicationId/resolve', authMiddleware, handleResolveDuplicate);

// Admin: Duplicate beneficiaries
router.get('/duplicates/beneficiaries', authMiddleware, handleDetectDuplicateBeneficiaries);
router.delete('/duplicates/beneficiaries/:beneficiaryId', authMiddleware, handleDeleteBeneficiary);

// Admin: Duplicate attendance
router.get('/duplicates/attendance', authMiddleware, handleDetectDuplicateAttendance);
router.delete('/duplicates/attendance/:attendanceId', authMiddleware, handleDeleteAttendanceRecord);

export default router;