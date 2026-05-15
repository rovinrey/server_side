import { Router } from 'express';
const router = Router();
import {
  getAllBeneficiariesHandler,
  getCount,
  getAllForAdmin,
  getBeneficiaryByIdHandler,
  getEmploymentHistoryByUserIdHandler,

  getBeneficiaryApplicationDetailsController,
  enrollBeneficiary,
  getEnrollmentStatusHandler,
  getProgramEnrolleesHandler,
  updateEnrollmentStatusHandler,
  getMyProfile,
  updateMyProfile,
  checkDuplicate,
  getMyProgramHistory
} from '../controllers/beneficiary.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { requireAdmin, requireAdminOrStaff } from '../validators/common.validators.js';

router.get('/', authMiddleware, requireAdminOrStaff, getAllBeneficiariesHandler);

// return total number of beneficiaries for dashboard stats
router.get('/count', authMiddleware, requireAdminOrStaff, getCount);

// Admin management routes
<<<<<<< HEAD
router.get('/admin/all', authMiddleware, requireAdminOrStaff, beneficiaryController.getAllForAdmin);
router.get('/admin/:beneficiaryId', authMiddleware, requireAdminOrStaff, beneficiaryController.getById);
router.get('/admin/user/:userId/employment-history', authMiddleware, requireAdminOrStaff, beneficiaryController.getAdminBeneficiaryEmploymentHistory);
router.post('/admin', authMiddleware, requireAdmin, beneficiaryController.addBeneficiary);
router.put('/admin/:beneficiaryId', authMiddleware, requireAdmin, beneficiaryController.updateBeneficiary);
router.delete('/admin/:beneficiaryId', authMiddleware, requireAdmin, beneficiaryController.deleteBeneficiary);
=======
router.get('/admin/all', authMiddleware, requireAdminOrStaff, getAllForAdmin);
router.get('/admin/:beneficiaryId', authMiddleware, requireAdminOrStaff, getBeneficiaryByIdHandler);
router.get('/admin/user/:userId/employment-history', authMiddleware, requireAdminOrStaff, getEmploymentHistoryByUserIdHandler);
router.post('/admin', authMiddleware, requireAdmin);
router.put('/admin/:beneficiaryId', authMiddleware, requireAdmin);
router.delete('/admin/:beneficiaryId', authMiddleware, requireAdmin);
>>>>>>> 826997eb2a2d518c1746e3b6f423c32c134faaa7


router.get('/:applicationId/details', authMiddleware, requireAdminOrStaff, getBeneficiaryApplicationDetailsController);

// =============================================
// Enrollment routes
// =============================================
router.post('/enroll', authMiddleware, requireAdminOrStaff, enrollBeneficiary);
router.get('/enroll/:applicationId/status', authMiddleware, requireAdminOrStaff, getEnrollmentStatusHandler);
router.get('/program/:programId/enrollees', authMiddleware, requireAdminOrStaff, getProgramEnrolleesHandler);
router.put('/enroll/:enrolleeId/status', authMiddleware, requireAdminOrStaff, updateEnrollmentStatusHandler);

// =============================================
// Beneficiary Profiling routes (authenticated beneficiary self-service)
// =============================================
router.get('/profile/me', authMiddleware, getMyProfile);
router.put('/profile/me', authMiddleware, updateMyProfile);
router.post('/profile/check-duplicate', authMiddleware, checkDuplicate);
router.get('/profile/program-history', authMiddleware, getMyProgramHistory);

export default router;