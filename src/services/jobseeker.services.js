const db = require('../../db');

/**
 * Apply to Job Seekers program — creates central application + jobseeker_details + beneficiary record.
 */
exports.applyToJobSeekers = async (data) => {
    const userId = data.user_id;
    if (!userId) throw new Error('User ID is required for Job Seekers application');

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Prevent duplicate pending applications
        const [pending] = await connection.query(
            "SELECT application_id FROM applications WHERE user_id = ? AND program_type = 'job_seekers' AND status = 'Pending'",
            [userId]
        );
        if (pending.length > 0) {
            throw new Error('You already have a pending Job Seekers application');
        }

        // Create central application record
        const [appResult] = await connection.query(
            "INSERT INTO applications (user_id, program_type, status, applied_at) VALUES (?, 'job_seekers', 'Pending', NOW())",
            [userId]
        );
        const applicationId = appResult.insertId;

        // Save job seeker specific details
        const technicalSkills = Array.isArray(data.technical_skills)
            ? data.technical_skills.join(', ')
            : data.technical_skills || null;

        await connection.query(
            `INSERT INTO jobseeker_details 
                (application_id, employment_status, preferred_work_type, preferred_industry, years_of_experience, technical_skills, urgent_training, certifications, availability, expected_salary) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                applicationId,
                data.employment_status || null,
                data.preferred_work_type || null,
                data.preferred_industry || null,
                data.years_of_experience || null,
                technicalSkills,
                data.urgent_training || null,
                data.certifications || null,
                data.availability || null,
                data.expected_salary || null,
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
