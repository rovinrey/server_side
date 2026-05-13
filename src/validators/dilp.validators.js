import { safeTrim, safeFloat, safeInt, isValidPhone } from './common.validators.js';

/**
 * Validate DILP application data before hitting the service/DB layer.
 */
export async function validateDilp(req, res, next) {
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

        // Ensure user ID exists (either from body or previous auth middleware)
        const userId = user_id || req.user?.id;
        if (!userId) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        // Proponent Name Validation
        const name = safeTrim(proponent_name);
        if (!name || name.length < 2) {
            return res.status(400).json({ message: 'Proponent name is required (min 2 characters)' });
        }

        // Project Title Validation
        const title = safeTrim(project_title);
        if (!title || title.length < 2) {
            return res.status(400).json({ message: 'Project title is required (min 2 characters)' });
        }

        // Proposed Amount Validation
        const amount = safeFloat(proposed_amount);
        if (amount === null || amount <= 0) {
            return res.status(400).json({ message: 'Proposed amount must be a positive number' });
        }
        if (amount > 10000000) {
            return res.status(400).json({ message: 'Proposed amount exceeds maximum allowed (10,000,000)' });
        }

        // Contact Number Validation
        const phone = safeTrim(mobile_number || contact_number);
        if (!phone || !isValidPhone(phone)) {
            return res.status(400).json({ message: 'A valid contact/mobile number is required' });
        }

        // Number of Beneficiaries Validation
        const numBeneficiaries = safeInt(number_of_beneficiaries);
        if (numBeneficiaries !== null && (numBeneficiaries < 0 || numBeneficiaries > 10000)) {
            return res.status(400).json({ message: 'Number of beneficiaries must be between 0 and 10,000' });
        }

        // Estimated Monthly Income Validation
        const income = safeFloat(estimated_monthly_income);
        if (income !== null && income < 0) {
            return res.status(400).json({ message: 'Estimated monthly income cannot be negative' });
        }

        // If everything passes, move to the controller
        next();
    } catch (error) {
        console.error("❌ DILP Validation Error:", error);
        return res.status(500).json({ message: error.message || 'DILP validation failed' });
    }
}