const db = require('../../config');

const calculateAge = (birthDateValue) => {
    const birthDate = new Date(birthDateValue);
    if (Number.isNaN(birthDate.getTime())) {
        return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age -= 1;
    }

    return age;
};

const addMonths = (date, months) => {
    const copied = new Date(date);
    copied.setMonth(copied.getMonth() + months);
    return copied;
};

// validators/tupadValidator.js
exports.validateTupad = async (req, res, next) => {
    try {
        const {
            user_id,
            first_name,
            last_name,
            date_of_birth,
            valid_id_type,
            id_number,
            contact_number
        } = req.body;

        if (!first_name || !last_name || !date_of_birth) {
            return res.status(400).json({
                message: 'Name and birth date are required'
            });
        }

        if (!valid_id_type || !id_number) {
            return res.status(400).json({
                message: 'Valid ID is required'
            });
        }

        const age = calculateAge(date_of_birth);
        if (age === null) {
            return res.status(400).json({ message: 'Date of birth must be a valid date' });
        }

        if (age < 18) {
            return res.status(400).json({
                message: 'Applicant must be at least 18 years old to apply for TUPAD'
            });
        }

        if (!contact_number || String(contact_number).trim() === '') {
            return res.status(400).json({
                message: 'Contact number is required for family eligibility validation'
            });
        }

        const normalizedUserId = Number(user_id || req.user?.id || 0);
        if (!normalizedUserId) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        // One TUPAD applicant per family: contact number is used as the household key.
        const [familyRows] = await db.execute(
            `SELECT a.application_id
             FROM beneficiaries b
             INNER JOIN applications a ON a.user_id = b.user_id
             WHERE a.program_type = 'tupad'
               AND b.contact_number = ?
               AND b.user_id <> ?
             LIMIT 1`,
            [String(contact_number).trim(), normalizedUserId]
        );

        if (familyRows.length > 0) {
            return res.status(400).json({
                message: 'Only one member per family can apply to TUPAD'
            });
        }

        // Reapplication cooldown: must wait 6 months from latest TUPAD application.
        const [latestApplicationRows] = await db.execute(
            `SELECT applied_at
             FROM applications
             WHERE user_id = ? AND program_type = 'tupad'
             ORDER BY applied_at DESC
             LIMIT 1`,
            [normalizedUserId]
        );

        if (latestApplicationRows.length > 0) {
            const lastAppliedAt = new Date(latestApplicationRows[0].applied_at);
            const allowedDate = addMonths(lastAppliedAt, 6);
            const now = new Date();

            if (now < allowedDate) {
                return res.status(400).json({
                    message: 'You can reapply for TUPAD only after 6 months from your last application'
                });
            }
        }

        next();
    } catch (error) {
        return res.status(500).json({
            message: error.message || 'Failed to validate TUPAD application'
        });
    }
};