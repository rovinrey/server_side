const express = require('express');
const cors = require('cors');
const router = express.Router();
router.use(cors());
const authMiddleware = require('../middlewares/auth.middleware');
const adminDocsController = require('../controllers/admin.documents.controller');
const documentsUpload = require('../middlewares/documents.upload.middleware');
const spesUpload = require('../middlewares/upload.middleware');

// All routes require authentication (admin only on frontend via ProtectedRoute)

// GET all submitted documents (with optional filters: ?programType=tupad&userId=5)
router.get('/', authMiddleware, adminDocsController.getAllDocuments);

// GET all SPES application documents
router.get('/spes', authMiddleware, adminDocsController.getAllSpesDocuments);

// GET export a user's documents to Word (.docx)
router.get('/export-word/:userId', authMiddleware, adminDocsController.exportDocumentsToWord);

// GET view/download a specific document file
router.get('/view/:documentId', authMiddleware, adminDocsController.viewDocument);

// GET view/download a specific SPES document file
router.get('/spes/view/:applicationId/:fieldId', authMiddleware, adminDocsController.viewSpesDocument);

// DELETE a generic beneficiary document
router.delete('/:documentId', authMiddleware, adminDocsController.deleteDocument);

// DELETE a SPES document
router.delete('/spes/:applicationId/:fieldId', authMiddleware, adminDocsController.deleteSpesDocument);

// PUT replace a generic beneficiary document
router.put('/:documentId', authMiddleware, documentsUpload.single('document'), adminDocsController.replaceDocument);

// PUT replace a SPES document
router.put('/spes/:applicationId/:fieldId', authMiddleware, spesUpload.single('document'), adminDocsController.replaceSpesDocument);

module.exports = router;
