const db = require('../../config');
const fs = require('fs');

/**
 * Get all submitted documents across all users, grouped with user info.
 * Supports optional filters: programType, userId
 */
exports.getAllDocuments = async ({ programType, userId } = {}) => {
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
            bd.uploaded_at,
            u.email,
            u.phone,
            b.first_name,
            b.last_name
        FROM beneficiary_documents bd
        JOIN users u ON bd.user_id = u.user_id
        LEFT JOIN beneficiaries b ON bd.user_id = b.user_id
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

    const [rows] = await db.query(query, params);
    return rows;
};

/**
 * Get a single document by ID (for admin - no user_id restriction).
 */
exports.getDocumentById = async (documentId) => {
    const [rows] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ?',
        [documentId]
    );
    return rows.length > 0 ? rows[0] : null;
};

/**
 * Get all SPES application documents across all users.
 */
exports.getAllSpesDocuments = async ({ userId } = {}) => {
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

    const [rows] = await db.query(query, params);
    return rows;
};

/**
 * Get documents for a specific user across all programs (for Word export).
 */
exports.getUserDocumentsForExport = async (userId) => {
    const [docs] = await db.query(
        `SELECT bd.*, u.email, u.phone, b.first_name, b.last_name, b.address
         FROM beneficiary_documents bd
         JOIN users u ON bd.user_id = u.user_id
         LEFT JOIN beneficiaries b ON bd.user_id = b.user_id
         WHERE bd.user_id = ?
         ORDER BY bd.program_type, bd.uploaded_at ASC`,
        [userId]
    );
    return docs;
};

/**
 * Delete a generic beneficiary document by ID.
 * Removes from DB and deletes file from disk.
 */
exports.deleteDocument = async (documentId) => {
    const [rows] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ?',
        [documentId]
    );
    if (rows.length === 0) return null;

    const doc = rows[0];
    if (doc.file_path && fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
    }

    await db.query('DELETE FROM beneficiary_documents WHERE document_id = ?', [documentId]);
    return doc;
};

/**
 * Replace a generic beneficiary document file.
 * Deletes old file, updates DB row with new file info.
 */
exports.replaceDocument = async (documentId, newFile) => {
    const [rows] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ?',
        [documentId]
    );
    if (rows.length === 0) return null;

    const doc = rows[0];

    // Delete old file
    if (doc.file_path && fs.existsSync(doc.file_path)) {
        fs.unlinkSync(doc.file_path);
    }

    // Update DB with new file info
    await db.query(
        `UPDATE beneficiary_documents
         SET file_path = ?, original_name = ?, file_size = ?, mime_type = ?, uploaded_at = NOW()
         WHERE document_id = ?`,
        [newFile.path, newFile.originalname, newFile.size, newFile.mimetype, documentId]
    );

    const [updated] = await db.query(
        'SELECT * FROM beneficiary_documents WHERE document_id = ?',
        [documentId]
    );
    return updated[0];
};

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
exports.getSpesDocumentPath = async (applicationId, fieldId) => {
    const column = SPES_FIELD_MAP[fieldId];
    if (!column) return null;

    const [rows] = await db.query(
        `SELECT ${column} AS file_path FROM SPES_Applications WHERE spes_application_id = ?`,
        [applicationId]
    );
    if (rows.length === 0 || !rows[0].file_path) return null;
    return rows[0].file_path;
};

/**
 * Delete a SPES document by application ID and field ID.
 * Sets column to NULL and removes file from disk.
 */
exports.deleteSpesDocument = async (applicationId, fieldId) => {
    const column = SPES_FIELD_MAP[fieldId];
    if (!column) return null;

    const [rows] = await db.query(
        `SELECT ${column} AS file_path FROM SPES_Applications WHERE spes_application_id = ?`,
        [applicationId]
    );
    if (rows.length === 0) return null;

    const filePath = rows[0].file_path;
    if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    await db.query(
        `UPDATE SPES_Applications SET ${column} = NULL WHERE spes_application_id = ?`,
        [applicationId]
    );
    return { applicationId, fieldId, deleted: true };
};

/**
 * Replace a SPES document file.
 */
exports.replaceSpesDocument = async (applicationId, fieldId, newFile) => {
    const column = SPES_FIELD_MAP[fieldId];
    if (!column) return null;

    const [rows] = await db.query(
        `SELECT ${column} AS file_path FROM SPES_Applications WHERE spes_application_id = ?`,
        [applicationId]
    );
    if (rows.length === 0) return null;

    // Delete old file
    const oldPath = rows[0].file_path;
    if (oldPath && fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
    }

    // Update DB
    await db.query(
        `UPDATE SPES_Applications SET ${column} = ? WHERE spes_application_id = ?`,
        [newFile.path, applicationId]
    );

    return { applicationId, fieldId, file_path: newFile.path };
};

/**
 * Get all documents for an application by application_id
 * Joins with applications table to find user_id from application
 */
exports.getApplicationDocuments = async (applicationId) => {
    const [rows] = await db.query(`
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
            bd.is_verified,
            bd.verified_by,
            bd.verified_at,
            u.first_name AS verified_by_name
        FROM beneficiary_documents bd
        JOIN applications a ON bd.user_id = a.user_id
        LEFT JOIN users u ON bd.verified_by = u.user_id
        WHERE a.application_id = ?
        ORDER BY bd.uploaded_at DESC
    `, [applicationId]);
    
    return rows;
};

/**
 * Verify a document by document ID
 */
exports.verifyDocument = async (documentId, adminId) => {
    const verifiedAt = new Date();
    
    const [result] = await db.query(
        `UPDATE beneficiary_documents 
         SET is_verified = 1, verified_by = ?, verified_at = ?
         WHERE document_id = ?`,
        [adminId, verifiedAt, documentId]
    );
    
    if (result.affectedRows === 0) {
        return null;
    }

    // Fetch and return the updated document
    const [rows] = await db.query(
        `SELECT bd.*, u.first_name AS verified_by_name
         FROM beneficiary_documents bd
         LEFT JOIN users u ON bd.verified_by = u.user_id
         WHERE bd.document_id = ?`,
        [documentId]
    );

    return rows[0] || null;
};

/**
 * Reject/unverify a document by document ID
 */
exports.rejectDocument = async (documentId) => {
    const [result] = await db.query(
        `UPDATE beneficiary_documents 
         SET is_verified = 0, verified_by = NULL, verified_at = NULL
         WHERE document_id = ?`,
        [documentId]
    );
    
    if (result.affectedRows === 0) {
        return null;
    }

    // Fetch and return the updated document
    const [rows] = await db.query(
        `SELECT bd.*, u.first_name AS verified_by_name
         FROM beneficiary_documents bd
         LEFT JOIN users u ON bd.verified_by = u.user_id
         WHERE bd.document_id = ?`,
        [documentId]
    );

    return rows[0] || null;
};
