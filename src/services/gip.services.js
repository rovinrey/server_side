const db = require('../../db');

/**
 * Apply to GIP program — creates central application + gip_details + beneficiary record.
 */
exports.applyToGip = async (data) => {
    const userId = data.user_id;
    if (!userId) throw new Error('User ID is required for GIP application');

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Prevent duplicate pending/approved applications for the same program batch
        const pendingSql = data.program_id
            ? "SELECT application_id FROM applications WHERE user_id = ? AND program_type = 'gip' AND program_id = ? AND status IN ('Pending', 'Approved')"
            : "SELECT application_id FROM applications WHERE user_id = ? AND program_type = 'gip' AND status = 'Pending'";
        const pendingParams = data.program_id ? [userId, data.program_id] : [userId];
        const [pending] = await connection.query(pendingSql, pendingParams);
        if (pending.length > 0) {
            throw new Error('You already have a pending or approved application for this program batch');
        }

        // Create central application record
        const [appResult] = await connection.query(
            "INSERT INTO applications (user_id, program_type, program_id, status, applied_at) VALUES (?, 'gip', ?, 'Pending', NOW())",
            [userId, data.program_id || null]
        );
        const applicationId = appResult.insertId;

        // Save GIP-specific details
        await connection.query(
            `INSERT INTO gip_details 
                (application_id, school, course, year_graduated, education_level, employment_status, skills, government_id, emergency_name, emergency_contact) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                applicationId,
                data.school || null,
                data.course || null,
                data.year_graduated || null,
                data.education_level || null,
                data.employment_status || null,
                data.skills || null,
                data.government_id || null,
                data.emergency_name || null,
                data.emergency_contact || null,
            ]
        );

        // Upsert beneficiary profile
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
                data.first_name,
                data.middle_name || '',
                data.last_name,
                data.birth_date || null,
                data.gender || 'Other',
                data.civil_status || 'Single',
                data.contact_number || null,
                data.address || '',
            ]
        );

        await connection.commit();
        return { application_id: applicationId };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};
