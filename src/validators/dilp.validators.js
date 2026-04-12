const { safeTrim, safeFloat, safeInt, isValidPhone } = require('./common.validators');

/**
 * Validate DILP application data before hitting the service/DB layer.
 */
exports.validateDilp = async (req, res, next) => {
    try {
        const {
            user_id,
            proponent_name,
            project_title,
            proposed_amount,
            mobile_number,
            contact_number,
            number_of_beneficiaries,
            estimated_monthly_income,
        } = req.body;

        const userId = user_id || req.user?.id;
        if (!userId) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        const name = safeTrim(proponent_name);
        if (!name || name.length < 2) {
            return res.status(400).json({ message: 'Proponent name is required (min 2 characters)' });
        }

        const title = safeTrim(project_title);
        if (!title || title.length < 2) {
            return res.status(400).json({ message: 'Project title is required (min 2 characters)' });
        }

        const amount = safeFloat(proposed_amount);
        if (amount === null || amount <= 0) {
            return res.status(400).json({ message: 'Proposed amount must be a positive number' });
        }
        if (amount > 10000000) {
            return res.status(400).json({ message: 'Proposed amount exceeds maximum allowed (10,000,000)' });
        }

        const phone = safeTrim(mobile_number || contact_number);
        if (!phone || !isValidPhone(phone)) {
            return res.status(400).json({ message: 'A valid contact/mobile number is required' });
        }

        const numBeneficiaries = safeInt(number_of_beneficiaries);
        if (numBeneficiaries !== null && (numBeneficiaries < 0 || numBeneficiaries > 10000)) {
            return res.status(400).json({ message: 'Number of beneficiaries must be between 0 and 10,000' });
        }

        const income = safeFloat(estimated_monthly_income);
        if (income !== null && income < 0) {
            return res.status(400).json({ message: 'Estimated monthly income cannot be negative' });
        }

        next();
    } catch (error) {
        return res.status(500).json({ message: error.message || 'DILP validation failed' });
    }
};
