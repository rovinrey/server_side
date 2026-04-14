const db = require('../../config');

// Model for SPES application
exports.createSpesApplication = async (connection, userId) => {
    const [result] = await connection.query(
        `INSERT INTO applications (user_id, program_type)
         VALUES (?, 'spes')`,
        [userId]
    );
    return result.insertId;
};

exports.createSpesDetails = async (connection, data) => {
    const query = `
        INSERT INTO spes_details (
            application_id, place_of_birth, citizenship, social_media_account,
            civil_status, sex, type_of_student, parent_status, father_name,
            father_occupation, father_contact, mother_maiden_name,
            mother_occupation, mother_contact, education_level, name_of_school,
            degree_earned_course, year_level, present_address, permanent_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        data.application_id,
        data.place_of_birth || null,
        data.citizenship || 'Filipino',
        data.social_media_account || null,
        data.civil_status || null,
        data.sex || null, 
        data.type_of_student || null,
        data.parent_status || null,
        data.father_name || null,
        data.father_occupation || null,
        data.father_contact || null,
        data.mother_maiden_name || null,
        data.mother_occupation || null,
        data.mother_contact || null,
        data.education_level || null,
        data.name_of_school || null,
        data.degree_earned_course || null,
        data.year_level_grade || null,
        data.present_address || null,
        data.permanent_address || null
    ];

    const [result] = await connection.query(query, values);
    return result.insertId;
};

exports.getSpesDetailsByApplicationId = async (connection, applicationId) => {
    const [rows] = await connection.query(
        'SELECT * FROM spes_details WHERE application_id = ?',
        [applicationId]
    );
    return rows[0] || null;
};

// Additional utility: update status (for approval flow)
exports.updateApplicationStatus = async (connection, applicationId, status) => {
    const [result] = await connection.query(
        'UPDATE applications SET status = ? WHERE application_id = ?',
        [status, applicationId]
    );
    return result.affectedRows > 0;
};

