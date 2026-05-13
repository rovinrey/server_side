import { Router } from 'express';
const router = Router();
import authMiddleware from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';
const single = upload.single('document');

import {
  getDocumentStatus,
  handleUploadDocument as uploadDocument,
  handleDeleteDocument as deleteDocument,
} from '../controllers/spes.documents.controller.js';


// GET current user's document submission status
router.get('/status', authMiddleware, getDocumentStatus);

// POST upload a single document (multipart/form-data)
// field: "document" (the file), body field "field_id" (the document type key)
router.post('/upload', authMiddleware, single, uploadDocument);

// DELETE a specific document by field id
router.delete('/:fieldId', authMiddleware, deleteDocument);

export default router;
