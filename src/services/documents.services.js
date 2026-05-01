const db = require('../../config');
const fs = require('fs').promises; // Senior tip: Use promises for non-blocking file I/O
const path = require('path');

/**
 * VERIFICATION LOGIC
 * Replaced 'is_verified' with the correct 'status' ENUM from the schema.
 */

/**
 * Approves a document and records the verifier's ID.
 * @param {number} documentId - The ID of the document to verify.
 * @param {number} adminId - The user_id of the staff performing the action.
 */
exports.verifyDocument = async (documentId, adminId) => {
    // We use the 'status' column as defined: ENUM('pending','verified','rejected')
    const [result] = await db.query(
        `UPDATE beneficiary_documents 
         SET status = 'verified', 
             verified_by = ?, 
             verified_at = NOW(),
             remarks = 'Document verified and approved.'
         WHERE document_id = ?`,
        [adminId, documentId]
    );
    return result.affectedRows > 0;
};

/**
 * Rejects a document and saves the reason for the beneficiary to see.
 * @param {number} documentId 
 * @param {number} adminId 
 * @param {string} reason - Feedback for the user (e.g., "Image too blurry").
 */
exports.rejectDocument = async (documentId, adminId, reason = null) => {
    const [result] = await db.query(
        `UPDATE beneficiary_documents 
         SET status = 'rejected', 
             verified_by = ?, 
             verified_at = NOW(), 
             remarks = ?
         WHERE document_id = ?`,
        [adminId, reason || 'Document rejected: Please re-upload.', documentId]
    );
    return result.affectedRows > 0;
};

/**
 * RETRIEVAL & MAINTENANCE LOGIC
 */

/**
 * Fetches all documents for a specific user within a specific program (e.g., TUPAD).
 */
exports.getDocumentsByUserAndProgram = async (userId, programType) => {
    const [rows] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE user_id = ? AND program_type = ? ORDER BY uploaded_at ASC',
        [userId, programType]
    );
    return rows;
};

/**
 * Deletes a document and its physical file from the server.
 */
exports.deleteDocument = async (userId, documentId) => {
    const [rows] = await db.query(
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

    await db.query('DELETE FROM beneficiary_documents WHERE document_id = ?', [documentId]);
    return true;
};