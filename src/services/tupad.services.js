// services/tupadService.js
import { getConnection, execute } from '../../config.js';
import { hasPendingOrApprovedApplication, createApplication, createTupadDetails, createBeneficiary } from '../models/tupad.models.js';


export async function applyTupad(data) {
    const userId = data.user_id || data.userId;
    if (!userId) {
        throw new Error('User ID is required for TUPAD application');
    }

    const connection = await getConnection();

    try {
        await connection.beginTransaction();

        // Prevent multiple active submissions for the user 
        const hasDuplicate = await hasPendingOrApprovedApplication(userId);  
        if (hasDuplicate) {
            throw new Error('You already have a pending or approved application');
        }

        // Create central application 
        const applicationId = await createApplication(connection, userId);

        // Save program-specific details
        await createTupadDetails(connection, {
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
        await createBeneficiary(connection, {
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
}

export async function approveTupadApplication(applicationId) {
    const connection = await getConnection();
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

        // 2. Fetch beneficiary (family key = contact_number)
        const [benefRows] = await connection.execute(
            `SELECT beneficiary_id, contact_number FROM beneficiaries WHERE user_id = ? LIMIT 1`,
            [application.user_id]
        );
        if (!benefRows.length) {
            throw new Error('Beneficiary profile not found');
        }
        const beneficiary = benefRows[0];
        if (!beneficiary.contact_number) {
            throw new Error('Contact number is required for family eligibility validation');
        }

        // 3. Enforce: 6-month cooldown after COMPLETED/COMPLETED enrollment (TUPAD)
        //    Prefer program_enrollees completion_date when present.
        const [cooldownRows] = await connection.execute(
            `SELECT pe.completion_date, pe.enrollment_date
             FROM program_enrollees pe
             INNER JOIN applications a ON a.application_id = pe.application_id
             WHERE a.user_id = ?
               AND LOWER(a.program_type) = 'tupad'
               AND pe.current_status IN ('Completed','Completed ')
             ORDER BY COALESCE(pe.completion_date, pe.enrollment_date) DESC
             LIMIT 1`,
            [application.user_id]
        );

        if (cooldownRows.length) {
            const last = cooldownRows[0];
            const lastDateRaw = last.completion_date || last.enrollment_date;
            if (lastDateRaw) {
                const lastDate = new Date(lastDateRaw);
                const now = new Date();
                const allowed = new Date(lastDate);
                allowed.setMonth(allowed.getMonth() + 6);
                if (now < allowed) {
                    const diffMs = allowed.getTime() - now.getTime();
                    const diffMonths = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30));
                    throw new Error(`TUPAD cooldown active. Please wait ${diffMonths} more month(s).`);
                }
            }
        }

        // 4. Enforce: 1 member per family (family key = beneficiaries.contact_number)
        //    Block if another active/completed TUPAD enrollee exists in same family.
        const [familyRows] = await connection.execute(
            `SELECT pe.enrollee_id, pe.current_status, pe.completion_date, pe.enrollment_date
             FROM program_enrollees pe
             INNER JOIN applications a ON a.application_id = pe.application_id
             INNER JOIN beneficiaries b ON b.user_id = a.user_id
             WHERE LOWER(a.program_type) = 'tupad'
               AND b.contact_number = ?
               AND a.user_id <> ?
               AND pe.current_status IN ('Active','Completed','Completed ')
             ORDER BY COALESCE(pe.completion_date, pe.enrollment_date) DESC
             LIMIT 1`,
            [String(beneficiary.contact_number).trim(), application.user_id]
        );

        if (familyRows.length) {
            throw new Error('Only one member per family can be a TUPAD beneficiary');
        }

        // 5. Update application status
        await connection.execute(
            `UPDATE applications SET status = 'Approved', approval_date = NOW(), rejection_reason = NULL
             WHERE application_id = ?`,
            [applicationId]
        );

        // 6. Ensure beneficiary is active
        await connection.execute(
            `UPDATE beneficiaries SET is_active = 1 WHERE user_id = ?`,
            [application.user_id]
        );

<<<<<<< HEAD
        // 4. Validate available program slots without reserving them on approval.
        // Enrollment should be the only action that increments filled slots.
        if (application.program_id) {
            const [progCheck] = await connection.execute(
                `SELECT program_id, slots, filled
                 FROM programs
                 WHERE program_id = ?
                   AND status IN ('active', 'ongoing')`,
                [application.program_id]
            );
            if (!progCheck.length || progCheck[0].filled >= progCheck[0].slots) {
                throw new Error(`Cannot approve: program has no available slots (${progCheck[0]?.filled || 0}/${progCheck[0]?.slots || 0})`);
            }
        } else {
            // Legacy fallback for applications without program_id
            const [progCheck] = await connection.execute(
                `SELECT program_id, slots, filled FROM programs
                 WHERE LOWER(program_name) LIKE 'tupad%'
                   AND status IN ('active', 'ongoing')
                 ORDER BY start_date DESC LIMIT 1`
            );
            if (!progCheck.length || progCheck[0].filled >= progCheck[0].slots) {
                throw new Error(`Cannot approve: TUPAD program has no available slots (${progCheck[0]?.filled || 0}/${progCheck[0]?.slots || 0})`);
            }
        }
=======
        // 7. NOTE: Do NOT consume program slots on approval.
        //    Slots should be consumed ONLY when the admin/staff clicks "Enroll" and an
        //    actual program_enrollees row is created (see beneficiary.services.js).
        //
        //    Therefore, the old slot increment logic that updated programs.filled here was removed.
>>>>>>> 826997eb2a2d518c1746e3b6f423c32c134faaa7


        // 8. Send notification
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
}

// Get TUPAD details by application ID
export async function getTupadDetails(applicationId) {
    const [rows] = await execute(
        'SELECT * FROM tupad_details WHERE application_id = ? LIMIT 1',
        [applicationId]
    );
    return rows[0] || null;
}

// Update TUPAD details by detail_id
export async function updateTupadDetails(detailId, data) {
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
    const [result] = await execute(query, values);
    return { success: true, affectedRows: result.affectedRows };
}