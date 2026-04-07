const db = require('../../db');

// Apply to SPES – creates a new application or updates the existing one.
// Supports individual per-form submissions (upsert pattern).
exports.applyToSpes = async (data) => {
    const userId = data.user_id || data.userId;
    if (!userId) {
        throw new Error('User ID is required for SPES application');
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Check if the user already has an active (Pending/Approved) SPES application
        const [existingApps] = await connection.execute(
            `SELECT application_id FROM applications
             WHERE user_id = ? AND program_type = 'spes' AND status IN ('Pending', 'Approved')
             ORDER BY applied_at DESC LIMIT 1`,
            [userId]
        );

        let applicationId;

        if (existingApps.length > 0) {
            // ── UPDATE existing application ──
            applicationId = existingApps[0].application_id;

            await connection.execute(
                `UPDATE spes_details SET
                    place_of_birth = ?, citizenship = ?,
                    social_media_account = ?, civil_status = ?, sex = ?,
                    type_of_student = ?, parent_status = ?,
                    father_name = ?, father_occupation = ?, father_contact = ?,
                    mother_maiden_name = ?, mother_occupation = ?, mother_contact = ?,
                    education_level = ?, name_of_school = ?, degree_earned_course = ?,
                    year_level = ?, present_address = ?, permanent_address = ?,
                    form2_meta = ?, form2a_meta = ?, form4_meta = ?
                 WHERE application_id = ?`,
                [
                    data.place_of_birth || null,
                    data.citizenship || 'Filipino',
                    data.social_media_account || null,
                    data.civil_status || 'Single',
                    data.sex || 'Male',
                    data.type_of_student || 'Student',
                    data.parent_status || 'Living together',
                    data.father_name || null,
                    data.father_occupation || null,
                    data.father_contact || null,
                    data.mother_maiden_name || null,
                    data.mother_occupation || null,
                    data.mother_contact || null,
                    data.education_level || 'Secondary',
                    data.name_of_school || null,
                    data.degree_earned_course || null,
                    data.year_level || null,
                    data.present_address || null,
                    data.permanent_address || null,
                    data.form2_meta ? JSON.stringify(data.form2_meta) : null,
                    data.form2a_meta ? JSON.stringify(data.form2a_meta) : null,
                    data.form4_meta ? JSON.stringify(data.form4_meta) : null,
                    applicationId
                ]
            );
        } else {
            // ── CREATE new application ──
            const [appResult] = await connection.execute(
                `INSERT INTO applications (
                    user_id, program_type, status, applied_at
                ) VALUES (?, 'spes', 'Pending', NOW())`,
                [userId]
            );
            applicationId = appResult.insertId;

            await connection.execute(
                `INSERT INTO spes_details (
                    application_id, place_of_birth, citizenship,
                    social_media_account, civil_status, sex, type_of_student, parent_status,
                    father_name, father_occupation, father_contact,
                    mother_maiden_name, mother_occupation, mother_contact,
                    education_level, name_of_school, degree_earned_course, year_level,
                    present_address, permanent_address,
                    form2_meta, form2a_meta, form4_meta
                ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    applicationId,
                    data.place_of_birth || null,
                    data.citizenship || 'Filipino',
                    data.social_media_account || null,
                    data.civil_status || 'Single',
                    data.sex || 'Male',
                    data.type_of_student || 'Student',
                    data.parent_status || 'Living together',
                    data.father_name || null,
                    data.father_occupation || null,
                    data.father_contact || null,
                    data.mother_maiden_name || null,
                    data.mother_occupation || null,
                    data.mother_contact || null,
                    data.education_level || 'Secondary',
                    data.name_of_school || null,
                    data.degree_earned_course || null,
                    data.year_level || null,
                    data.present_address || null,
                    data.permanent_address || null,
                    data.form2_meta ? JSON.stringify(data.form2_meta) : null,
                    data.form2a_meta ? JSON.stringify(data.form2a_meta) : null,
                    data.form4_meta ? JSON.stringify(data.form4_meta) : null
                ]
            );
        }

        // Upsert beneficiary profile (same pattern as TUPAD, DILP, GIP, Job Seekers)
        await connection.query(
            `INSERT INTO beneficiaries (user_id, first_name, middle_name, last_name, birth_date, gender, civil_status, contact_number, address, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE
                first_name = VALUES(first_name),
                middle_name = VALUES(middle_name),
                last_name = VALUES(last_name),
                contact_number = VALUES(contact_number),
                address = VALUES(address)`,
            [
                userId,
                data.first_name || '',
                data.middle_name || '',
                data.last_name || '',
                data.birth_date || data.date_of_birth || null,
                data.sex || 'Other',
                data.civil_status || 'Single',
                data.contact_number || null,
                data.present_address || data.address || '',
            ]
        );

        await connection.commit();

        return { success: true, insertId: applicationId };
    } catch (error) {
        await connection.rollback();
        console.error('SPES Application Error:', error.message);
        throw error;
    } finally {
        connection.release();
    }
};

// Get SPES details by application_id.
exports.getSpesDetails = async (applicationId) => {
    try {
        const query = `SELECT * FROM spes_details WHERE application_id = ?`;
        const [rows] = await db.execute(query, [applicationId]);
        return rows[0] || null;
    } catch (error) {
        console.error('Error fetching SPES details:', error.message);
        throw error;
    }
};

// Update SPES details.
exports.updateSpesDetails = async (detailId, data) => {
    try {
        const query = `
            UPDATE spes_details SET
                gsis_beneficiary = ?, place_of_birth = ?, citizenship = ?,
                social_media_account = ?, status = ?, sex = ?, type_of_student = ?, parent_status = ?,
                is_pwd = ?, is_senior_citizen = ?, is_indigenous_people = ?, is_displaced_worker = ?, is_ofw_descendant = ?,
                father_name = ?, father_occupation = ?, father_contact = ?,
                mother_maiden_name = ?, mother_occupation = ?, mother_contact = ?,
                education_level = ?, name_of_school = ?, degree_earned_course = ?, year_level_grade = ?, date_of_attendance = ?,
                present_address = ?, permanent_address = ?
            WHERE detail_id = ?
        `;

        const values = [
            data.gsis_beneficiary || null,
            data.place_of_birth || null,
            data.citizenship || 'Filipino',
            data.social_media_account || null,
            data.status || null,
            data.sex || null,
            data.type_of_student || null,
            data.parent_status || null,
            data.is_pwd || false,
            data.is_senior_citizen || false,
            data.is_indigenous_people || false,
            data.is_displaced_worker || false,
            data.is_ofw_descendant || false,
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
            data.date_of_attendance || null,
            data.present_address || null,
            data.permanent_address || null,
            detailId
        ];

        const [result] = await db.execute(query, values);
        return { success: true, affectedRows: result.affectedRows };
    } catch (error) {
        console.error('Error updating SPES details:', error.message);
        throw error;
    }
};

// Approve a SPES application in centralized applications table.
exports.approveApplication = async (applicationId) => {
    const query = `
        UPDATE applications
        SET status = 'Approved', approval_date = NOW(), rejection_reason = NULL, updated_at = NOW()
        WHERE application_id = ? AND program_type = 'spes'
    `;

    const [result] = await db.execute(query, [applicationId]);
    return { success: true, affectedRows: result.affectedRows };
};

// Reject a SPES application in centralized applications table.
exports.rejectApplication = async (applicationId, reason) => {
    const query = `
        UPDATE applications
        SET status = 'Rejected', rejection_reason = ?, updated_at = NOW()
        WHERE application_id = ? AND program_type = 'spes'
    `;

    const [result] = await db.execute(query, [reason || null, applicationId]);
    return { success: true, affectedRows: result.affectedRows };
};
