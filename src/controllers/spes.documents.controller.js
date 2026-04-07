const db = require('../../db');
const path = require('path');
const fs = require('fs');

// Field name → DB column mapping
const FIELD_TO_COLUMN = {
    spes_form2:            'form2_path',
    spes_form2a:           'form2a_path',
    spes_form4:            'form4_path',
    passport_picture:      'passport_photo_path',
    birth_certificate:     'birth_cert_path',
    certificate_of_indigency: 'indigency_path',
    certificate_of_registration: 'registration_path',
    certificate_of_grades: 'grades_path',
    philjobnet_screenshot: 'philjobnet_screenshot_path',
};

// All readable field ids for status responses
const ALL_FIELDS = Object.keys(FIELD_TO_COLUMN);

/**
 * GET /api/spes-documents/status
 * Returns the submission record for the authenticated user.
 */
exports.getDocumentStatus = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const [rows] = await db.query(
            'SELECT * FROM SPES_Applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (rows.length === 0) {
            // Return empty status — no documents submitted yet
            const emptyStatus = {};
            ALL_FIELDS.forEach((field) => {
                emptyStatus[field] = null;
            });
            return res.status(200).json({
                application_status: null,
                documents: emptyStatus,
                record_id: null,
            });
        }

        const record = rows[0];
        const documents = {};
        ALL_FIELDS.forEach((field) => {
            const col = FIELD_TO_COLUMN[field];
            documents[field] = record[col] ? `/uploads/spes-documents/${path.basename(record[col])}` : null;
        });

        return res.status(200).json({
            application_status: record.application_status,
            documents,
            record_id: record.spes_application_id,
        });
    } catch (error) {
        console.error('Error fetching document status:', error.message);
        return res.status(500).json({ message: 'Error fetching document status' });
    }
};

/**
 * POST /api/spes-documents/upload
 * Uploads one document at a time (field name = document id).
 * The multipart field name must be one of the FIELD_TO_COLUMN keys.
 */
exports.uploadDocument = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const fieldId = req.body.field_id;
    if (!fieldId || !FIELD_TO_COLUMN[fieldId]) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: `Invalid field_id: ${fieldId}` });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file provided' });
    }

    const column = FIELD_TO_COLUMN[fieldId];
    const filePath = req.file.path;

    try {
        // Check if a record already exists for this user
        const [existing] = await db.query(
            'SELECT spes_application_id FROM SPES_Applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (existing.length === 0) {
            // Create a new record
            await db.query(
                `INSERT INTO SPES_Applications (user_id, application_status, ${column}) VALUES (?, 'Draft', ?)`,
                [userId, filePath]
            );
        } else {
            const recordId = existing[0].spes_application_id;
            // Delete old file if it exists
            const [current] = await db.query(
                `SELECT ${column} FROM SPES_Applications WHERE spes_application_id = ?`,
                [recordId]
            );
            if (current[0]?.[column]) {
                const oldPath = current[0][column];
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            // Update the column
            await db.query(
                `UPDATE SPES_Applications SET ${column} = ? WHERE spes_application_id = ?`,
                [filePath, recordId]
            );
        }

        return res.status(200).json({
            message: 'Document uploaded successfully',
            field_id: fieldId,
            url: `/uploads/spes-documents/${path.basename(filePath)}`,
        });
    } catch (error) {
        // Clean up uploaded file on DB error
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error('Error uploading document:', error.message);
        return res.status(500).json({ message: 'Error saving document' });
    }
};

/**
 * DELETE /api/spes-documents/:fieldId
 * Removes a previously uploaded document.
 */
exports.deleteDocument = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { fieldId } = req.params;
    if (!FIELD_TO_COLUMN[fieldId]) {
        return res.status(400).json({ message: `Invalid field_id: ${fieldId}` });
    }

    const column = FIELD_TO_COLUMN[fieldId];

    try {
        const [rows] = await db.query(
            'SELECT spes_application_id, ?? FROM SPES_Applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [column, userId]
        );

        if (rows.length === 0 || !rows[0][column]) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const recordId = rows[0].spes_application_id;
        const filePath = rows[0][column];

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await db.query(
            `UPDATE SPES_Applications SET ${column} = NULL WHERE spes_application_id = ?`,
            [recordId]
        );

        return res.status(200).json({ message: 'Document removed successfully', field_id: fieldId });
    } catch (error) {
        console.error('Error deleting document:', error.message);
        return res.status(500).json({ message: 'Error removing document' });
    }
};
