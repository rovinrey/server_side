const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const documentsUpload = require('../middlewares/documents.upload.middleware');
const docsController = require('../controllers/documents.controller');

// GET document status across all programs
router.get('/status/all', authMiddleware, docsController.getAllDocumentStatus);

// GET all documents for a program
router.get('/:programType', authMiddleware, docsController.getDocuments);

// POST upload a document
router.post('/upload', authMiddleware, documentsUpload.single('document'), docsController.uploadDocument);

// DELETE a document
router.delete('/:documentId', authMiddleware, docsController.deleteDocument);

module.exports = router;
