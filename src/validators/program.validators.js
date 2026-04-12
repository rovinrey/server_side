const { safeTrim, safeInt, safeFloat } = require('./common.validators');

const VALID_STATUSES = ['ongoing', 'active', 'pending', 'completed', 'cancelled'];

/**
 * Validate program create/update data.
 * Ensures budget, slots, dates are sane before writing to DB.
 */
exports.validateProgram = (req, res, next) => {
    const { name, location, slots, budget, status, start_date, end_date } = req.body;

    if (!safeTrim(name) || safeTrim(name).length < 2) {
        return res.status(400).json({ message: 'Program name is required (min 2 characters)' });
    }

    if (!safeTrim(location)) {
        return res.status(400).json({ message: 'Location is required' });
    }

    const slotsVal = safeInt(slots);
    if (slotsVal === null || slotsVal < 1) {
        return res.status(400).json({ message: 'Slots must be a positive integer' });
    }
    if (slotsVal > 50000) {
        return res.status(400).json({ message: 'Slots cannot exceed 50,000' });
    }

    const budgetVal = safeFloat(budget);
    if (budgetVal === null || budgetVal <= 0) {
        return res.status(400).json({ message: 'Budget must be a positive number' });
    }
    if (budgetVal > 1000000000) {
        return res.status(400).json({ message: 'Budget cannot exceed 1,000,000,000' });
    }

    if (status && !VALID_STATUSES.includes(String(status).toLowerCase())) {
        return res.status(400).json({
            message: `Status must be one of: ${VALID_STATUSES.join(', ')}`
        });
    }

    // Validate dates if provided
    if (start_date) {
        const sd = new Date(start_date);
        if (isNaN(sd.getTime())) {
            return res.status(400).json({ message: 'Start date must be a valid date' });
        }
    }

    if (end_date) {
        const ed = new Date(end_date);
        if (isNaN(ed.getTime())) {
            return res.status(400).json({ message: 'End date must be a valid date' });
        }
    }

    if (start_date && end_date) {
        if (new Date(end_date) < new Date(start_date)) {
            return res.status(400).json({ message: 'End date cannot be before start date' });
        }
    }

    next();
};

/**
 * Validate budget update — ensures `used` never exceeds new budget.
 * Attach to PUT /:program_id when budget changes.
 */
exports.validateBudgetUpdate = async (req, res, next) => {
    const db = require('../../db');
    const { program_id } = req.params;
    const { budget } = req.body;

    const budgetVal = safeFloat(budget);
    if (budgetVal === null || budgetVal <= 0) {
        return next(); // let the main validator catch it
    }

    try {
        const [rows] = await db.execute(
            'SELECT used FROM programs WHERE program_id = ?',
            [program_id]
        );
        if (rows.length > 0) {
            const currentUsed = parseFloat(rows[0].used) || 0;
            if (budgetVal < currentUsed) {
                return res.status(400).json({
                    message: `Budget (₱${budgetVal.toLocaleString()}) cannot be less than already used amount (₱${currentUsed.toLocaleString()})`
                });
            }
        }
    } catch (err) {
        // Non-blocking — let downstream handle it
        console.error('Budget validation query error:', err.message);
    }

    next();
};
