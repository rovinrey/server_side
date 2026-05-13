import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { handleGetAllDocuments, handleGetAllSpesDocuments, handleExportDocumentsToWord, handleViewDocument, handleViewSpesDocument, handleDeleteDocument, handleDeleteSpesDocument, handleReplaceDocument, handleReplaceSpesDocument, handleGetApplicationDocuments, handleVerifyDocument, handleRejectDocument } from '../controllers/admin.documents.controller.js';
import documentsUpload from '../middlewares/documents.upload.middleware.js';
const single = documentsUpload.single('document');



const router = Router();

// All routes require authentication (admin only on frontend via ProtectedRoute)

// GET all submitted documents (with optional filters: ?programType=tupad&userId=5)
router.get('/', authMiddleware, handleGetAllDocuments);

// GET all SPES application documents
router.get('/spes', authMiddleware, handleGetAllSpesDocuments);

// GET export a user's documents to Word (.docx)
router.get('/export-word/:userId', authMiddleware, handleExportDocumentsToWord);

// GET view/download a specific document file
router.get('/view/:documentId', authMiddleware, handleViewDocument);

// GET view/download a specific SPES document file
router.get('/spes/view/:applicationId/:fieldId', authMiddleware, handleViewSpesDocument);

// DELETE a generic beneficiary document
router.delete('/:documentId', authMiddleware, handleDeleteDocument);

// DELETE a SPES document
router.delete('/spes/:applicationId/:fieldId', authMiddleware, handleDeleteSpesDocument);

// PUT replace a generic beneficiary document
router.put('/:documentId', authMiddleware, single('document'), handleReplaceDocument);

// PUT replace a SPES document
router.put('/spes/:applicationId/:fieldId', authMiddleware, _single('document'), handleReplaceSpesDocument);

// GET documents for an application
router.get('/application/:applicationId', authMiddleware, handleGetApplicationDocuments);

// PUT verify a document
router.put('/:documentId/verify', authMiddleware, handleVerifyDocument);

// PUT reject a document (unverify)
router.put('/:documentId/reject', authMiddleware, handleRejectDocument);

export default router;
