// services/tupadService.js
const db = require('../../db');
const tupadModel = require('../models/tupad.models');

exports.applyTupad = async (data) => {
    const userId = data.user_id || data.userId;
    if (!userId) {
        throw new Error('User ID is required for TUPAD application');
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Prevent multiple active submissions for the same program batch.
        const hasDuplicate = await tupadModel.hasPendingOrApprovedApplication(userId, data.program_id);
        if (hasDuplicate) {
            throw new Error('You already have a pending or approved application for this program batch');
        }

        // Create central application
        const applicationId = await tupadModel.createApplication(connection, userId, data.program_id);

        // Save program-specific details
        await tupadModel.createTupadDetails(connection, {
            application_id: applicationId,
            valid_id_type: data.valid_id_type,
            id_number: data.id_number,
            occupation: data.occupation,
            monthly_income: data.monthly_income,
            civil_status: data.civil_status,
            work_category: data.occupation,
            job_preference: data.job_preference,
            educational_attainment: data.Educational_attainment || data.educational_attainment
        });

        // Save beneficiary profile
        await tupadModel.createBeneficiary(connection, {
            user_id: userId,
            first_name: data.first_name,
            middle_name: data.middle_name || '',
            last_name: data.last_name,
            birth_date: data.date_of_birth,
            gender: data.gender,
            contact_number: data.contact_number,
            address: data.address || ''
        });

        await connection.commit();

        return { application_id: applicationId };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

exports.approveTupadApplication = async (applicationId) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Fetch the application
        const [appRows] = await connection.execute(
            `SELECT application_id, user_id, program_type, program_id, status
             FROM applications WHERE application_id = ? AND program_type = 'tupad'`,
            [applicationId]
        );
        if (!appRows.length) {
            throw new Error('Application not found');
        }
        const application = appRows[0];
        if (application.status === 'Approved') {
            throw new Error('Application is already approved');
        }

        // 2. Update application status
        await connection.execute(
            `UPDATE applications SET status = 'Approved', approval_date = NOW(), rejection_reason = NULL
             WHERE application_id = ?`,
            [applicationId]
        );

        // 3. Ensure beneficiary is active
        await connection.execute(
            `UPDATE beneficiaries SET is_active = 1 WHERE user_id = ?`,
            [application.user_id]
        );

        // 4. Check slot availability and increment filled slot using program_id
        if (application.program_id) {
            const [slotResult] = await connection.execute(
                `UPDATE programs
                 SET filled = filled + 1
                 WHERE program_id = ?
                   AND status IN ('active', 'ongoing')
                   AND filled < slots`,
                [application.program_id]
            );
            if (slotResult.affectedRows === 0) {
                const [progCheck] = await connection.execute(
                    `SELECT program_id, slots, filled FROM programs WHERE program_id = ?`,
                    [application.program_id]
                );
                if (progCheck.length > 0 && progCheck[0].filled >= progCheck[0].slots) {
                    throw new Error(`Cannot approve: program has no available slots (${progCheck[0].filled}/${progCheck[0].slots})`);
                }
            }
        } else {
            // Legacy fallback for applications without program_id
            const [slotResult] = await connection.execute(
                `UPDATE programs
                 SET filled = filled + 1
                 WHERE LOWER(program_name) LIKE 'tupad%'
                   AND status IN ('active', 'ongoing')
                   AND filled < slots
                 ORDER BY start_date DESC
                 LIMIT 1`
            );
            if (slotResult.affectedRows === 0) {
                const [progCheck] = await connection.execute(
                    `SELECT program_id, slots, filled FROM programs
                     WHERE LOWER(program_name) LIKE 'tupad%'
                       AND status IN ('active', 'ongoing')
                     ORDER BY start_date DESC LIMIT 1`
                );
                if (progCheck.length > 0 && progCheck[0].filled >= progCheck[0].slots) {
                    throw new Error(`Cannot approve: TUPAD program has no available slots (${progCheck[0].filled}/${progCheck[0].slots})`);
                }
            }
        }

        // 5. Send notification
        await connection.execute(
            `INSERT INTO notifications (user_id, title, message, type)
             VALUES (?, ?, ?, ?)`,
            [
                application.user_id,
                'Application Approved',
                'Your TUPAD application has been approved. You are now enrolled in the program.',
                'application'
            ]
        );

        await connection.commit();
        return { applicationId, userId: application.user_id };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

// Get TUPAD details by application ID
exports.getTupadDetails = async (applicationId) => {
    const [rows] = await db.execute(
        'SELECT * FROM tupad_details WHERE application_id = ? LIMIT 1',
        [applicationId]
    );
    return rows[0] || null;
};

// Update TUPAD details by detail_id
exports.updateTupadDetails = async (detailId, data) => {
    const query = `
        UPDATE tupad_details SET
            valid_id_type = ?, id_number = ?, occupation = ?,
            monthly_income = ?, civil_status = ?, work_category = ?,
            job_preference = ?, educational_attainment = ?
        WHERE detail_id = ?
    `;
    const values = [
        data.valid_id_type || null,
        data.id_number || null,
        data.occupation || null,
        data.monthly_income || null,
        data.civil_status || null,
        data.work_category || null,
        data.job_preference || null,
        data.educational_attainment || null,
        detailId
    ];
    const [result] = await db.execute(query, values);
    return { success: true, affectedRows: result.affectedRows };
};