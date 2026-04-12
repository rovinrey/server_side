const { safeTrim, isValidPhone } = require('./common.validators');

const VALID_WORK_TYPES = ['Full-time', 'Part-time', 'Project-based', 'Freelance'];
const VALID_EMPLOYMENT_STATUSES = ['Unemployed', 'Employed', 'Self-employed', 'Student', 'Underemployed'];

/**
 * Validate Job Seekers application data.
 */
exports.validateJobSeekers = async (req, res, next) => {
    try {
        const {
            user_id,
            first_name,
            last_name,
            contact_number,
            employment_status,
            preferred_work_type,
            years_of_experience,
            expected_salary,
        } = req.body;

        const userId = user_id || req.user?.id;
        if (!userId) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        if (!safeTrim(first_name) || safeTrim(first_name).length < 2) {
            return res.status(400).json({ message: 'First name is required (min 2 characters)' });
        }

        if (!safeTrim(last_name) || safeTrim(last_name).length < 2) {
            return res.status(400).json({ message: 'Last name is required (min 2 characters)' });
        }

        if (contact_number && !isValidPhone(contact_number)) {
            return res.status(400).json({ message: 'Contact number format is invalid' });
        }

        if (employment_status && !VALID_EMPLOYMENT_STATUSES.includes(employment_status)) {
            return res.status(400).json({
                message: `Employment status must be one of: ${VALID_EMPLOYMENT_STATUSES.join(', ')}`
            });
        }

        if (preferred_work_type && !VALID_WORK_TYPES.includes(preferred_work_type)) {
            return res.status(400).json({
                message: `Preferred work type must be one of: ${VALID_WORK_TYPES.join(', ')}`
            });
        }

        if (years_of_experience != null) {
            const yoe = parseFloat(years_of_experience);
            if (isNaN(yoe) || yoe < 0 || yoe > 60) {
                return res.status(400).json({ message: 'Years of experience must be between 0 and 60' });
            }
        }

        if (expected_salary != null) {
            const salary = parseFloat(expected_salary);
            if (isNaN(salary) || salary < 0) {
                return res.status(400).json({ message: 'Expected salary cannot be negative' });
            }
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: error.message || 'Job Seekers validation failed' });
    }
};
