const documentsService = require('../services/documents.services');
const path = require('path');
const fs = require('fs');

const VALID_PROGRAMS = ['tupad', 'spes', 'dilp', 'gip', 'job_seekers'];

// Program → expected document types mapping
const PROGRAM_REQUIREMENTS = {
    tupad: ['government_id', 'barangay_certification', 'birth_certificate'],
    dilp: ['valid_government_id', 'project_proposal', 'barangay_clearance', 'business_registration'],
    gip: ['government_id', 'transcript_of_records', 'certificate_of_graduation', 'barangay_clearance', 'nbi_police_clearance'],
    job_seekers: ['updated_resume', 'valid_government_id', 'proof_of_address', 'certifications'],
};

/**
 * GET /api/documents/status/all
 * Returns per-program document submission status across all programs for the authenticated user.
 */
exports.getAllDocumentStatus = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const allDocs = await documentsService.getAllDocumentsByUser(userId);

        // Group documents by program_type
        const byProgram = {};
        allDocs.forEach((doc) => {
            if (!byProgram[doc.program_type]) {
                byProgram[doc.program_type] = [];
            }
            byProgram[doc.program_type].push({
                document_id: doc.document_id,
                document_type: doc.document_type,
                original_name: doc.original_name,
                file_size: doc.file_size,
                mime_type: doc.mime_type,
                uploaded_at: doc.uploaded_at,
                url: `/uploads/beneficiary-documents/${path.basename(doc.file_path)}`,
            });
        });

        // Build status for each program
        const programs = {};
        Object.keys(PROGRAM_REQUIREMENTS).forEach((programType) => {
            const required = PROGRAM_REQUIREMENTS[programType];
            const submitted = byProgram[programType] || [];
            const submittedTypes = submitted.map((d) => d.document_type);

            programs[programType] = {
                total_required: required.length,
                submitted_count: submitted.length,
                is_complete: required.every((r) => submittedTypes.includes(r)),
                documents: submitted,
                missing: required.filter((r) => !submittedTypes.includes(r)),
            };
        });

        return res.status(200).json({ programs });
    } catch (error) {
        console.error('Error fetching all document status:', error.message);
        return res.status(500).json({ message: 'Error fetching document status' });
    }
};

/**
 * GET /api/documents/:programType
 * Returns all uploaded documents for the authenticated user + program.
 */
exports.getDocuments = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { programType } = req.params;
    if (!VALID_PROGRAMS.includes(programType)) {
        return res.status(400).json({ message: 'Invalid program type' });
    }

    try {
        const documents = await documentsService.getDocumentsByUserAndProgram(userId, programType);

        const mapped = documents.map((doc) => ({
            document_id: doc.document_id,
            document_type: doc.document_type,
            original_name: doc.original_name,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            uploaded_at: doc.uploaded_at,
            url: `/uploads/beneficiary-documents/${path.basename(doc.file_path)}`,
        }));

        return res.status(200).json({ documents: mapped });
    } catch (error) {
        console.error('Error fetching documents:', error.message);
        return res.status(500).json({ message: 'Error fetching documents' });
    }
};

/**
 * POST /api/documents/upload
 * Body: program_type, document_type   |   File field: "document"
 */
exports.uploadDocument = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { program_type, document_type } = req.body;

    if (!program_type || !VALID_PROGRAMS.includes(program_type)) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Invalid or missing program_type' });
    }
    if (!document_type || typeof document_type !== 'string' || document_type.trim() === '') {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Invalid or missing document_type' });
    }
    if (!req.file) {
        return res.status(400).json({ message: 'No file provided' });
    }

    try {
        const docId = await documentsService.uploadDocument(userId, program_type, document_type.trim(), req.file);

        return res.status(200).json({
            message: 'Document uploaded successfully',
            document_id: docId,
            document_type: document_type.trim(),
            original_name: req.file.originalname,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            url: `/uploads/beneficiary-documents/${path.basename(req.file.path)}`,
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error('Error uploading document:', error.message);
        return res.status(500).json({ message: 'Error uploading document' });
    }
};

/**
 * DELETE /api/documents/:documentId
 */
exports.deleteDocument = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const documentId = parseInt(req.params.documentId, 10);
    if (isNaN(documentId)) {
        return res.status(400).json({ message: 'Invalid document ID' });
    }

    try {
        const deleted = await documentsService.deleteDocument(userId, documentId);
        if (!deleted) {
            return res.status(404).json({ message: 'Document not found' });
        }
        return res.status(200).json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error.message);
        return res.status(500).json({ message: 'Error deleting document' });
    }
};
