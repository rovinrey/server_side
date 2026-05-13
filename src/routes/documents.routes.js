import { Router } from 'express';
const router = Router();
import authMiddleware from '../middlewares/auth.middleware.js';
import documentsUpload from '../middlewares/documents.upload.middleware.js';
const single = documentsUpload.single('document');

import {
  handleGetAllDocumentStatus as getAllDocumentStatus,
  handleGetDocuments as getDocuments,
  handleUploadDocument as uploadDocument,
  handleDeleteDocument as deleteDocument,
  handleVerifyDocument as verifyDocument,
  handleRejectDocument as rejectDocument,
  handleGetDocumentVerificationStatus as getDocumentVerificationStatus,
} from '../controllers/documents.controller.js';

import { requireAdminOrStaff } from '../validators/common.validators.js';

// GET document status across all programs
router.get('/status/all', authMiddleware, getAllDocumentStatus);

// GET all documents for a program
router.get('/:programType', authMiddleware, getDocuments);

// POST upload a document
router.post('/upload', authMiddleware, single('document'), uploadDocument);

// DELETE a document
router.delete('/:documentId', authMiddleware, deleteDocument);

// =============================================
// Document Verification routes
// =============================================
router.put('/:documentId/verify', authMiddleware, requireAdminOrStaff, verifyDocument);
router.put('/:documentId/reject', authMiddleware, requireAdminOrStaff, rejectDocument);
router.get('/:applicationId/verification-status', authMiddleware, requireAdminOrStaff, getDocumentVerificationStatus);

export default router;
