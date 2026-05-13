import { query as _query } from '../../config.js';
import { existsSync, unlinkSync } from 'fs';

/**
 * Get all submitted documents across all users, grouped with user info.
 * Supports optional filters: programType, userId
 */
export async function getAllDocuments({ programType, userId } = {}) {
    let query = `
        SELECT 
            bd.document_id,
            bd.user_id,
            bd.program_type,
            bd.document_type,
            bd.original_name,
            bd.file_path,
            bd.file_size,
            bd.mime_type,
            bd.status,
            bd.remarks,
            bd.verified_by,
            bd.verified_at,
            v.user_name AS verified_by_name,
            bd.uploaded_at,
            u.email,
            u.phone,
            b.first_name,
            b.last_name
        FROM beneficiary_documents bd
        JOIN users u ON bd.user_id = u.user_id
        LEFT JOIN beneficiaries b ON bd.user_id = b.user_id
        LEFT JOIN users v ON bd.verified_by = v.user_id
    `;

    const conditions = [];
    const params = [];

    if (programType) {
        conditions.push('bd.program_type = ?');
        params.push(programType);
    }
    if (userId) {
        conditions.push('bd.user_id = ?');
        params.push(userId);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY bd.uploaded_at DESC';

    const [rows] = await _query(query, params);
    return rows;
}

/**
 * Get a single document by ID (for admin - no user_id restriction).
 */
export async function getDocumentById(documentId) {
    const [rows] = await _query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ?',
        [documentId]
    );
    return rows.length > 0 ? rows[0] : null;
}

/**
 * Get all SPES application documents across all users.
 */
export async function getAllSpesDocuments({ userId } = {}) {
    let query = `
        SELECT 
            sa.spes_application_id,
            sa.user_id,
            sa.application_status,
            sa.form2_path,
            sa.form2a_path,
            sa.form4_path,
            sa.passport_photo_path,
            sa.birth_cert_path,
            sa.indigency_path,
            sa.registration_path,
            sa.grades_path,
            sa.philjobnet_screenshot_path,
            sa.admin_remarks,
            sa.created_at,
            sa.updated_at,
            u.email,
            u.phone,
            b.first_name,
            b.last_name
        FROM SPES_Applications sa
        JOIN users u ON sa.user_id = u.user_id
        LEFT JOIN beneficiaries b ON sa.user_id = b.user_id
    `;

    const params = [];
    if (userId) {
        query += ' WHERE sa.user_id = ?';
        params.push(userId);
    }

    query += ' ORDER BY sa.updated_at DESC';

    const [rows] = await _query(query, params);
    return rows;
}

/**
 * Get documents for a specific user across all programs (for Word export).
 */
export async function getUserDocumentsForExport(userId) {
    const [docs] = await _query(
        `SELECT bd.*, u.email, u.phone, b.first_name, b.last_name, b.address
         FROM beneficiary_documents bd
         JOIN users u ON bd.user_id = u.user_id
         LEFT JOIN beneficiaries b ON bd.user_id = b.user_id
         WHERE bd.user_id = ?
         ORDER BY bd.program_type, bd.uploaded_at ASC`,
        [userId]
    );
    return docs;
}

/**
 * Delete a generic beneficiary document by ID.
 * Removes from DB and deletes file from disk.
 */
export async function deleteDocument(documentId) {
    const [rows] = await _query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ?',
        [documentId]
    );
    if (rows.length === 0) return null;

    const doc = rows[0];
    if (doc.file_path && existsSync(doc.file_path)) {
        unlinkSync(doc.file_path);
    }

    await _query('DELETE FROM beneficiary_documents WHERE document_id = ?', [documentId]);
    return doc;
}

/**
 * Replace a generic beneficiary document file.
 * Deletes old file, updates DB row with new file info.
 */
export async function replaceDocument(documentId, newFile) {
    const [rows] = await _query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ?',
        [documentId]
    );
    if (rows.length === 0) return null;

    const doc = rows[0];

    // Delete old file
    if (doc.file_path && existsSync(doc.file_path)) {
        unlinkSync(doc.file_path);
    }

    // Update DB with new file info
    await _query(
        `UPDATE beneficiary_documents
         SET file_path = ?, original_name = ?, file_size = ?, mime_type = ?, uploaded_at = NOW()
         WHERE document_id = ?`,
        [newFile.path, newFile.originalname, newFile.size, newFile.mimetype, documentId]
    );

    const [updated] = await _query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ?',
        [documentId]
    );
    return updated[0];
}

/**
 * SPES field-to-column mapping (same as beneficiary-facing).
 */
const SPES_FIELD_MAP = {
    spes_form2: 'form2_path',
    spes_form2a: 'form2a_path',
    spes_form4: 'form4_path',
    passport_picture: 'passport_photo_path',
    birth_certificate: 'birth_cert_path',
    certificate_of_indigency: 'indigency_path',
    certificate_of_registration: 'registration_path',
    certificate_of_grades: 'grades_path',
    philjobnet_screenshot: 'philjobnet_screenshot_path',
};

/**
 * Get a SPES document file path by application ID and field ID.
 */
export async function getSpesDocumentPath(applicationId, fieldId) {
    const column = SPES_FIELD_MAP[fieldId];
    if (!column) return null;

    const [rows] = await _query(
        `SELECT ${column} AS file_path FROM SPES_Applications WHERE spes_application_id = ?`,
        [applicationId]
    );
    if (rows.length === 0 || !rows[0].file_path) return null;
    return rows[0].file_path;
}

/**
 * Delete a SPES document by application ID and field ID.
 * Sets column to NULL and removes file from disk.
 */
export async function deleteSpesDocument(applicationId, fieldId) {
    const column = SPES_FIELD_MAP[fieldId];
    if (!column) return null;

    const [rows] = await _query(
        `SELECT ${column} AS file_path FROM SPES_Applications WHERE spes_application_id = ?`,
        [applicationId]
    );
    if (rows.length === 0) return null;

    const filePath = rows[0].file_path;
    if (filePath && existsSync(filePath)) {
        unlinkSync(filePath);
    }

    await _query(
        `UPDATE SPES_Applications SET ${column} = NULL WHERE spes_application_id = ?`,
        [applicationId]
    );
    return { applicationId, fieldId, deleted: true };
}

/**
 * Replace a SPES document file.
 */
export async function replaceSpesDocument(applicationId, fieldId, newFile) {
    const column = SPES_FIELD_MAP[fieldId];
    if (!column) return null;

    const [rows] = await _query(
        `SELECT ${column} AS file_path FROM SPES_Applications WHERE spes_application_id = ?`,
        [applicationId]
    );
    if (rows.length === 0) return null;

    // Delete old file
    const oldPath = rows[0].file_path;
    if (oldPath && existsSync(oldPath)) {
        unlinkSync(oldPath);
    }

    // Update DB
    await _query(
        `UPDATE SPES_Applications SET ${column} = ? WHERE spes_application_id = ?`,
        [newFile.path, applicationId]
    );

    return { applicationId, fieldId, file_path: newFile.path };
}

/**
 * Get all documents for an application by application_id
 * Joins with applications table to find user_id from application
 */
export async function getApplicationDocuments(applicationId) {
    const [rows] = await _query(`
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
            bd.verified_at,
            u.user_name AS verified_by_name
        FROM beneficiary_documents bd
        JOIN applications a ON bd.user_id = a.user_id
        LEFT JOIN users u ON bd.verified_by = u.user_id
        WHERE a.application_id = ?
        ORDER BY bd.uploaded_at DESC
    `, [applicationId]);
    
    return rows;
}

/**
 * Verify a document by document ID
 */
export async function verifyDocument(documentId, adminId) {
    const verifiedAt = new Date();
    
    const [result] = await _query(
        `UPDATE beneficiary_documents 
         SET status = 'verified', verified_by = ?, verified_at = ?
         WHERE document_id = ?`,
        [adminId, verifiedAt, documentId]
    );
    
    if (result.affectedRows === 0) {
        return null;
    }

    // Fetch and return the updated document
    const [rows] = await _query(
        `SELECT bd.*, u.user_name AS verified_by_name
         FROM beneficiary_documents bd
         LEFT JOIN users u ON bd.verified_by = u.user_id
         WHERE bd.document_id = ?`,
        [documentId]
    );

    return rows[0] || null;
}

/**
 * Reject/unverify a document by document ID
 */
export async function rejectDocument(documentId) {
    const [result] = await _query(
        `UPDATE beneficiary_documents 
         SET status = 'rejected', verified_by = NULL, verified_at = NULL
         WHERE document_id = ?`,
        [documentId]
    );
    
    if (result.affectedRows === 0) {
        return null;
    }

    // Fetch and return the updated document
    const [rows] = await _query(
        `SELECT bd.*, u.user_name AS verified_by_name
         FROM beneficiary_documents bd
         LEFT JOIN users u ON bd.verified_by = u.user_id
         WHERE bd.document_id = ?`,
        [documentId]
    );

    return rows[0] || null;
}
