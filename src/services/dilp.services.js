const db = require("../../db");

// Apply to DILP program
exports.applyDilp = async (data) => {
    const query = `
        INSERT INTO dilp_applications (
            proponent_name, sex, civil_status, date_of_birth,
            email, project_title, project_type, category,
            proposed_amount, location, barangay, city, province, contact_person, 
            contact_number, business_experience, estimated_monthly_income,
            number_of_beneficiaries, skills_training, valid_id_number, brief_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        data.proponent_name,
        data.sex,
        data.civil_status,
        data.date_of_birth,
        data.email,
        data.project_title,
        data.project_type,
        data.category,
        data.proposed_amount,
        data.location,
        data.barangay,
        data.city,
        data.province,
        data.contact_person,
        data.contact_number,
        data.business_experience,
        data.estimated_monthly_income,
        data.number_of_beneficiaries,
        data.skills_training,
        data.valid_id_number,
        data.brief_description,
    ];

    try {
        const result = await db.execute(query, values);
        return result;
    } catch (err) {
        console.error("Database Error:", err.message);
        throw new Error("Failed to save DILP application.");
    }
};

// Get all DILP applications
exports.getDilpApplications = async (limit = 10) => {
    const query = `
        SELECT id, proponent_name, project_title, project_type, category,
               proposed_amount, location, mobile_number, status, created_at
        FROM dilp_applications 
        ORDER BY created_at DESC 
        LIMIT ?
    `;
    try {
        const result = await db.execute(query, [limit]);
        return result;
    } catch (err) {
        console.error("Database Error:", err.message);
        throw new Error("Failed to fetch DILP applications.");
    }
};

// Get DILP application by ID
exports.getDilpApplicationById = async (id) => {
    const query = `
        SELECT * FROM dilp_applications WHERE id = ?
    `;
    try {
        const result = await db.execute(query, [id]);
        return result;
    } catch (err) {
        console.error("Database Error:", err.message);
        throw new Error("Failed to fetch DILP application.");
    }
};

// Update DILP application status
exports.updateDilpStatus = async (id, status) => {
    const query = `
        UPDATE dilp_applications 
        SET status = ?, approval_date = ?
        WHERE id = ?
    `;
    const timestamp = status === "Approved" ? new Date().toISOString() : null;

    try {
        const result = await db.execute(query, [status, timestamp, id]);
        return result;
    } catch (err) {
        console.error("Database Error:", err.message);
        throw new Error("Failed to update DILP application status.");
    }
};

// Get DILP applications by status
exports.getDilpApplicationsByStatus = async (status, limit = 10) => {
    const query = `
        SELECT id, proponent_name, project_title, project_type, category,
               proposed_amount, location, contact_number, status
        FROM dilp_applications 
        WHERE status = ?
        ORDER BY created_at DESC 
        LIMIT ?
    `;
    try {
        const result = await db.execute(query, [status, limit]);
        return result;
    } catch (err) {
        console.error("Database Error:", err.message);
        throw new Error("Failed to fetch DILP applications by status.");
    }
};

/**
 * Apply to DILP using the central applications table + dilp_details.
 * This follows the same pattern as TUPAD/SPES.
 */
exports.applyToDilp = async (data) => {
    const userId = data.user_id;
    if (!userId) throw new Error('User ID is required for DILP application');

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Prevent duplicate pending applications
        const [pending] = await connection.query(
            "SELECT application_id FROM applications WHERE user_id = ? AND program_type = 'dilp' AND status = 'Pending'",
            [userId]
        );
        if (pending.length > 0) {
            throw new Error('You already have a pending DILP application');
        }

        // Create central application record
        const [appResult] = await connection.query(
            "INSERT INTO applications (user_id, program_type, status, applied_at) VALUES (?, 'dilp', 'Pending', NOW())",
            [userId]
        );
        const applicationId = appResult.insertId;

        // Save DILP-specific details
        await connection.query(
            `INSERT INTO dilp_details 
                (application_id, project_title, project_type, category, proposed_amount, location, barangay, municipality, district, street, province, contact_person, business_experience, estimated_monthly_income, number_of_beneficiaries, skills_training, valid_id_number, brief_description) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                applicationId,
                data.project_title || null,
                data.project_type || 'Individual',
                data.category || 'Formation',
                data.proposed_amount || null,
                data.location || null,
                data.barangay || null,
                data.municipality || null,
                data.district || null,
                data.street || null,
                data.province || null,
                data.contact_person || null,
                data.business_experience || null,
                data.estimated_monthly_income || 0,
                data.number_of_beneficiaries || 0,
                data.skills_training || null,
                data.valid_id_number || null,
                data.brief_description || null,
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
                data.proponent_name || '',
                '',
                '',
                data.birthdate || data.date_of_birth || null,
                data.sex || 'Other',
                data.civil_status || 'Single',
                data.mobile_number || data.contact_number || null,
                [data.street, data.barangay, data.municipality, data.province].filter(Boolean).join(', ') || '',
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
