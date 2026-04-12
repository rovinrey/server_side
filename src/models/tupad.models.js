// models/tupadModel.js
const db = require('../../db');

exports.createApplication = async (connection, userId, programId) => {
    const [result] = await connection.query(
        `INSERT INTO applications (user_id, program_type, program_id)
         VALUES (?, 'tupad', ?)`,
        [userId, programId || null]
    );
    return result.insertId;
};

exports.createTupadDetails = async (connection, data) => {
    await connection.query(
        `INSERT INTO tupad_details 
        (application_id, valid_id_type, id_number, occupation, monthly_income, civil_status, work_category, job_preference, educational_attainment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.application_id,
            data.valid_id_type,
            data.id_number,
            data.occupation,
            data.monthly_income,
            data.civil_status,
            data.work_category,
            data.job_preference || null,
            data.educational_attainment || null
        ]
    );
};

// insert into beneficiary

exports.createBeneficiary = async (connection, data) => {
    await connection.query(
        `INSERT INTO beneficiaries 
        (user_id, first_name, middle_name, last_name, birth_date, gender, contact_number, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.user_id,
            data.first_name,
            data.middle_name,
            data.last_name,
            data.birth_date,
            data.gender,
            data.contact_number,
            data.address
        ]
    );
};

exports.hasPendingOrApprovedApplication = async (userId, programId) => {
    // If a specific program batch is selected, check per-batch
    if (programId) {
        const [rows] = await db.query(
            `SELECT application_id FROM applications
             WHERE user_id = ? AND program_type = 'tupad' AND program_id = ? AND status IN ('Pending', 'Approved')`,
            [userId, programId]
        );
        return rows.length > 0;
    }
    // Fallback: if no program_id, block only if there's a pending (legacy behavior)
    const [rows] = await db.query(
        `SELECT application_id FROM applications
         WHERE user_id = ? AND program_type = 'tupad' AND status = 'Pending'`,
        [userId]
    );
    return rows.length > 0;
};