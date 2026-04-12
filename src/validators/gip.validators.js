const { safeTrim, isValidPastDate, calculateAge } = require('./common.validators');

/**
 * Validate GIP (Government Internship Program) application data.
 */
exports.validateGip = async (req, res, next) => {
    try {
        const {
            user_id,
            first_name,
            last_name,
            birth_date,
            school,
            course,
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

        if (birth_date) {
            if (!isValidPastDate(birth_date)) {
                return res.status(400).json({ message: 'Birth date must be a valid date in the past' });
            }
            const age = calculateAge(birth_date);
            if (age !== null && age < 18) {
                return res.status(400).json({ message: 'Applicant must be at least 18 years old' });
            }
            if (age !== null && age > 30) {
                return res.status(400).json({ message: 'GIP is for applicants 30 years old and below' });
            }
        }

        if (!safeTrim(school)) {
            return res.status(400).json({ message: 'School name is required for GIP application' });
        }

        if (!safeTrim(course)) {
            return res.status(400).json({ message: 'Course/Degree is required for GIP application' });
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: error.message || 'GIP validation failed' });
    }
};
