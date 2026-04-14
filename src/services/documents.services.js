const db = require('../../config');
const fs = require('fs');
const path = require('path');

/**
 * Get all documents for a user + program combination.
 */
exports.getDocumentsByUserAndProgram = async (userId, programType) => {
    const [rows] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE user_id = ? AND program_type = ? ORDER BY uploaded_at ASC',
        [userId, programType]
    );
    return rows;
};

/**
 * Upload (or replace) a document for a given user, program, and document_type.
 * Uses UNIQUE(user_id, program_type, document_type) — replaces existing file if re-uploaded.
 */
exports.uploadDocument = async (userId, programType, documentType, file) => {
    // Check for existing document of same type
    const [existing] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE user_id = ? AND program_type = ? AND document_type = ?',
        [userId, programType, documentType]
    );

    if (existing.length > 0) {
        // Delete old file from disk
        const oldPath = existing[0].file_path;
        if (oldPath && fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
        // Update the record
        await db.query(
            `UPDATE beneficiary_documents SET original_name = ?, file_path = ?, file_size = ?, mime_type = ?, uploaded_at = NOW()
             WHERE document_id = ?`,
            [file.originalname, file.path, file.size, file.mimetype, existing[0].document_id]
        );
        return existing[0].document_id;
    }

    // Insert new record
    const [result] = await db.query(
        `INSERT INTO beneficiary_documents (user_id, program_type, document_type, original_name, file_path, file_size, mime_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, programType, documentType, file.originalname, file.path, file.size, file.mimetype]
    );
    return result.insertId;
};

/**
 * Get document counts grouped by program_type for a given user.
 * Returns: [{ program_type, submitted_count }]
 */
exports.getDocumentCountsByUser = async (userId) => {
    const [rows] = await db.query(
        `SELECT program_type, COUNT(*) AS submitted_count
         FROM beneficiary_documents
         WHERE user_id = ?
         GROUP BY program_type`,
        [userId]
    );
    return rows;
};

/**
 * Get all documents for a user across all programs.
 * Returns: [{ document_id, program_type, document_type, original_name, file_size, mime_type, uploaded_at, file_path }]
 */
exports.getAllDocumentsByUser = async (userId) => {
    const [rows] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE user_id = ? ORDER BY program_type, uploaded_at ASC',
        [userId]
    );
    return rows;
};

/**
 * Delete a document by ID (only if it belongs to the requesting user).
 */
exports.deleteDocument = async (userId, documentId) => {
    const [rows] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ? AND user_id = ?',
        [documentId, userId]
    );
    if (rows.length === 0) return false;

    const filePath = rows[0].file_path;
    if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    await db.query('DELETE FROM beneficiary_documents WHERE document_id = ?', [documentId]);
    return true;
};
