// models/tupadModel.js
import db from '../../config.js';
const { query } = db;

export async function createApplication(connection, userId) {
    const [result] = await connection.query(
        `INSERT INTO applications (user_id, program_type)
         VALUES (?, 'tupad')`,
        [userId]
    );
    return result.insertId;
}

export async function createTupadDetails(connection, data) {
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
}

// insert into beneficiary

export async function createBeneficiary(connection, data) {
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
}

export async function hasPendingOrApprovedApplication(userId) {
    const [rows] = await query(
        `SELECT application_id FROM applications
         WHERE user_id = ? AND program_type = 'tupad' AND status IN ('Pending', 'Approved')`,
        [userId]
    );
    return rows.length > 0;
}