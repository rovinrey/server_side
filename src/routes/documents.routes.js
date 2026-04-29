const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const documentsUpload = require('../middlewares/documents.upload.middleware');
const docsController = require('../controllers/documents.controller');
const { requireAdminOrStaff } = require('../validators/common.validators');

// GET document status across all programs
router.get('/status/all', authMiddleware, docsController.getAllDocumentStatus);

// GET all documents for a program
router.get('/:programType', authMiddleware, docsController.getDocuments);

// POST upload a document
router.post('/upload', authMiddleware, documentsUpload.single('document'), docsController.uploadDocument);

// DELETE a document
router.delete('/:documentId', authMiddleware, docsController.deleteDocument);

// =============================================
// Document Verification routes
// =============================================
router.put('/:documentId/verify', authMiddleware, requireAdminOrStaff, docsController.verifyDocument);
router.put('/:documentId/reject', authMiddleware, requireAdminOrStaff, docsController.rejectDocument);
router.get('/:applicationId/verification-status', authMiddleware, requireAdminOrStaff, docsController.getDocumentVerificationStatus);

module.exports = router;
