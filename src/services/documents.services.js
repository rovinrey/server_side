import { query } from '../../config.js';
import { promises as fs } from 'fs'; // Senior tip: Use promises for non-blocking file I/O

/**
 * VERIFICATION LOGIC
 * Replaced 'is_verified' with the correct 'status' ENUM from the schema.
 */

/**
 * Approves a document and records the verifier's ID.
 * @param {number} documentId - The ID of the document to verify.
 * @param {number} adminId - The user_id of the staff performing the action.
 */
export async function verifyDocument(documentId, adminId) {
    // We use the 'status' column as defined: ENUM('pending','verified','rejected')
    const [result] = await query(
        `UPDATE beneficiary_documents 
         SET status = 'verified', 
             verified_by = ?, 
             verified_at = NOW(),
             remarks = 'Document verified and approved.'
         WHERE document_id = ?`,
        [adminId, documentId]
    );
    return result.affectedRows > 0;
}

/**
 * Rejects a document and saves the reason for the beneficiary to see.
 * @param {number} documentId 
 * @param {number} adminId 
 * @param {string} reason - Feedback for the user (e.g., "Image too blurry").
 */
export async function rejectDocument(documentId, adminId, reason = null) {
    const [result] = await query(
        `UPDATE beneficiary_documents 
         SET status = 'rejected', 
             verified_by = ?, 
             verified_at = NOW(), 
             remarks = ?
         WHERE document_id = ?`,
        [adminId, reason || 'Document rejected: Please re-upload.', documentId]
    );
    return result.affectedRows > 0;
}

/**
 * RETRIEVAL & MAINTENANCE LOGIC
 */

/**
 * Fetches all documents for a specific user within a specific program (e.g., TUPAD).
 */
export async function getDocumentsByUserAndProgram(userId, programType) {
    const [rows] = await query(
        'SELECT * FROM beneficiary_documents WHERE user_id = ? AND program_type = ? ORDER BY uploaded_at ASC',
        [userId, programType]
    );
    return rows;
}

/**
 * Deletes a document and its physical file from the server.
 */
export async function deleteDocument(userId, documentId) {
    const [rows] = await query(
        'SELECT file_path FROM beneficiary_documents WHERE document_id = ? AND user_id = ?',
        [documentId, userId]
    );

    if (rows.length === 0) return false;

    // Clean up the physical file to prevent storage bloat
    try {
        await fs.unlink(rows[0].file_path);
    } catch (err) {
        console.error("File deletion failed:", err.message);
    }

    await query('DELETE FROM beneficiary_documents WHERE document_id = ?', [documentId]);
    return true;
}

/**
 * Fetches all documents for a specific user across all programs.
 */
export async function getAllDocumentsByUser(userId) {
    const [rows] = await query(
        'SELECT * FROM beneficiary_documents WHERE user_id = ? ORDER BY uploaded_at ASC',
        [userId]
    );
    return rows;
}

/**
 * Inserts a new row or replaces file metadata when (user_id, program_type, document_type) already exists.
 * @param {number} userId
 * @param {string} programType
 * @param {string} documentType
 * @param {Express.Multer.File} file
 * @returns {Promise<number>} document_id
 */
export async function uploadDocument(userId, programType, documentType, file) {
    const filePath = file.path;
    const originalName = file.originalname;
    const fileSize = file.size;
    const mimeType = file.mimetype;

    const [existing] = await query(
        'SELECT document_id, file_path FROM beneficiary_documents WHERE user_id = ? AND program_type = ? AND document_type = ?',
        [userId, programType, documentType]
    );

    if (existing.length > 0) {
        const oldPath = existing[0].file_path;
        if (oldPath && oldPath !== filePath) {
            try {
                await fs.unlink(oldPath);
            } catch (err) {
                console.error('Old document file unlink failed:', err.message);
            }
        }
        await query(
            `UPDATE beneficiary_documents
             SET original_name = ?, file_path = ?, file_size = ?, mime_type = ?,
                 status = 'pending', remarks = NULL, verified_by = NULL, verified_at = NULL,
                 uploaded_at = CURRENT_TIMESTAMP
             WHERE document_id = ?`,
            [originalName, filePath, fileSize, mimeType, existing[0].document_id]
        );
        return existing[0].document_id;
    }

    const [result] = await query(
        `INSERT INTO beneficiary_documents
            (user_id, program_type, document_type, original_name, file_path, file_size, mime_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, programType, documentType, originalName, filePath, fileSize, mimeType]
    );
    return result.insertId;
}

/**
 * Documents for the application's beneficiary (same rows as admin getApplicationDocuments).
 * @param {string|number} applicationId
 */
export async function getDocumentsByApplicationId(applicationId) {
    const [rows] = await query(
        `
        SELECT
            bd.document_id,
            bd.user_id,
            bd.program_type,
            bd.document_type,
            bd.original_name,
            bd.file_path,
            bd.file_size,
            bd.mime_type,
            bd.uploaded_at,
            bd.status,
            bd.remarks,
            bd.verified_by,
            bd.verified_at
        FROM beneficiary_documents bd
        JOIN applications a ON bd.user_id = a.user_id
        WHERE a.application_id = ?
        ORDER BY bd.uploaded_at DESC
        `,
        [applicationId]
    );
    return rows;
}