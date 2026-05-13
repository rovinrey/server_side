import validators from './common.validators.js';
const { safeTrim, isValidPhone } = validators;

// Exporting constants so they can be reused in your Frontend or Models
export const VALID_WORK_TYPES = [
    'Full-time', 
    'Part-time', 
    'Project-based', 
    'Freelance'
];

export const VALID_EMPLOYMENT_STATUSES = [
    'Unemployed', 
    'Employed', 
    'Self-employed', 
    'Student', 
    'Underemployed'
];

/**
 * Validate Job Seekers application data.
 */
const validateJobSeekers = async (req, res, next) => {
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

        // Identification Check
        const userId = user_id || req.user?.id;
        if (!userId) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        // Name Validation & Sanitization
        const trimmedFirst = safeTrim(first_name);
        const trimmedLast = safeTrim(last_name);

        if (!trimmedFirst || trimmedFirst.length < 2) {
            return res.status(400).json({ message: 'First name is required (min 2 characters)' });
        }

        if (!trimmedLast || trimmedLast.length < 2) {
            return res.status(400).json({ message: 'Last name is required (min 2 characters)' });
        }

        // Contact Validation
        if (contact_number && !isValidPhone(contact_number)) {
            return res.status(400).json({ message: 'Contact number format is invalid' });
        }

        // Enum Validations
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

        // Numeric Validations
        if (years_of_experience !== undefined && years_of_experience !== null && years_of_experience !== '') {
            const yoe = Number(years_of_experience);
            if (isNaN(yoe) || yoe < 0 || yoe > 60) {
                return res.status(400).json({ message: 'Years of experience must be between 0 and 60' });
            }
        }

        if (expected_salary !== undefined && expected_salary !== null && expected_salary !== '') {
            const salary = Number(expected_salary);
            if (isNaN(salary) || salary < 0) {
                return res.status(400).json({ message: 'Expected salary cannot be negative' });
            }
        }

        // Re-assign sanitized values to req.body
        req.body.first_name = trimmedFirst;
        req.body.last_name = trimmedLast;

        next();
    } catch (error) {
        console.error('Validation Error:', error);
        return res.status(500).json({ message: 'Job Seekers validation failed internally' });
    }
};

export default validateJobSeekers;