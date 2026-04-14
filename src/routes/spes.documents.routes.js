const express = require('express');
const cors = require('cors');
const router = express.Router();
router.use(cors());
const authMiddleware = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const docsController = require('../controllers/spes.documents.controller');

// GET current user's document submission status
router.get('/status', authMiddleware, docsController.getDocumentStatus);

// POST upload a single document (multipart/form-data)
// field: "document" (the file), body field "field_id" (the document type key)
router.post('/upload', authMiddleware, upload.single('document'), docsController.uploadDocument);

// DELETE a specific document by field id
router.delete('/:fieldId', authMiddleware, docsController.deleteDocument);

module.exports = router;
