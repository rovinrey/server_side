import { generatePayroll, getPayroll, approvePayroll, releasePayroll, getPayrollAnalytics, createDisbursement, getDisbursements, updateDisbursementStatus, getBeneficiaryPayouts, setDailyWage, getAllDailyWages } from '../services/payroll.services.js';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isValidMonth(value) {
    return MONTH_PATTERN.test(String(value || ''));
}

/** @returns {number|null} Numeric user id or null after sending 401. */
function assertPayrollActor(req, res) {
    const adminId = req.user?.id;
    const uid = Number(adminId);
    if (!adminId || !Number.isFinite(uid) || uid <= 0) {
        res.status(401).json({ message: 'Authentication required for payroll actions' });
        return null;
    }
    return uid;
}

function isPayrollClientMessage(message) {
    return /required|invalid|must be|audit trail|format/i.test(String(message || ''));
}

export async function handleGeneratePayroll(req, res) {
    try {
        const { month } = req.body || {};
        if (month != null && month !== '' && !isValidMonth(month)) {
            return res.status(400).json({ message: 'month must be YYYY-MM when provided' });
        }
        if (assertPayrollActor(req, res) === null) return;
        const result = await generatePayroll(month);
        res.status(200).json({ message: 'Payroll generated successfully', ...result });
    } catch (error) {
        console.error('Error generating payroll:', error.message);
        const code = isPayrollClientMessage(error.message) ? 400 : 500;
        res.status(code).json({ message: error.message || 'Error generating payroll' });
    }
}

export async function handleGetPayroll(req, res) {
    try {
        const { month, program } = req.query;
        if (month != null && month !== '' && !isValidMonth(month)) {
            return res.status(400).json({ message: 'month query must be YYYY-MM' });
        }
        const data = await getPayroll(month, program || null);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching payroll:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching payroll' });
    }
}

export async function handleApprovePayroll(req, res) {
    try {
        const { month, program } = req.body || {};
        if (!isValidMonth(month)) {
            return res.status(400).json({ message: 'month (YYYY-MM) is required' });
        }
        const actorId = assertPayrollActor(req, res);
        if (actorId === null) return;

        const result = await approvePayroll(month, program || null, actorId);
        res.status(200).json({ message: 'Payroll approved', ...result });
    } catch (error) {
        console.error('Error approving payroll:', error.message);
        const code = isPayrollClientMessage(error.message) ? 400 : 500;
        res.status(code).json({ message: error.message || 'Error approving payroll' });
    }
}

export async function handleReleasePayroll(req, res) {
    try {
        const { month, program } = req.body || {};
        if (!isValidMonth(month)) {
            return res.status(400).json({ message: 'month (YYYY-MM) is required' });
        }
        const actorId = assertPayrollActor(req, res);
        if (actorId === null) return;

        const result = await releasePayroll(month, program || null, actorId);
        res.status(200).json({ message: 'Payroll released', ...result });
    } catch (error) {
        console.error('Error releasing payroll:', error.message);
        const code = isPayrollClientMessage(error.message) ? 400 : 500;
        res.status(code).json({ message: error.message || 'Error releasing payroll' });
    }
}

export async function handleGetAnalytics(req, res) {
    try {
        const { month } = req.query;
        if (month != null && month !== '' && !isValidMonth(month)) {
            return res.status(400).json({ message: 'month query must be YYYY-MM' });
        }
        const data = await getPayrollAnalytics(month || null);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching analytics:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching analytics' });
    }
}

export async function handleCreateDisbursement(req, res) {
    try {
        const actorId = assertPayrollActor(req, res);
        if (actorId === null) return;

        const result = await createDisbursement(req.body || {}, actorId);
        res.status(201).json({ message: 'Disbursement created', ...result });
    } catch (error) {
        console.error('Error creating disbursement:', error.message);
        const code = isPayrollClientMessage(error.message) ? 400 : 500;
        res.status(code).json({ message: error.message || 'Error creating disbursement' });
    }
}

export async function handleGetDisbursements(req, res) {
    try {
        const { month } = req.query;
        if (month != null && month !== '' && !isValidMonth(month)) {
            return res.status(400).json({ message: 'month query must be YYYY-MM' });
        }
        const rows = await getDisbursements(month || null);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching disbursements:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching disbursements' });
    }
}

export async function handleUpdateDisbursementStatus(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: 'Invalid disbursement id' });
        }
        const { status, reference_number } = req.body || {};
        const actorId = assertPayrollActor(req, res);
        if (actorId === null) return;

        const result = await updateDisbursementStatus(
            id, status, actorId, reference_number || null
        );
        res.status(200).json({ message: 'Disbursement updated', ...result });
    } catch (error) {
        console.error('Error updating disbursement:', error.message);
        const code = isPayrollClientMessage(error.message) ? 400 : 500;
        res.status(code).json({ message: error.message || 'Error updating disbursement' });
    }
}

export async function handleGetBeneficiaryPayouts(req, res) {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return res.status(400).json({ message: 'User ID required' });
        }
        const data = await getBeneficiaryPayouts(userId);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching beneficiary payouts:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching payouts' });
    }
}

export async function handleSetDailyWage(req, res) {
    try {
        const { program_type, wage } = req.body || {};
        if (wage === undefined || wage === null || wage === '') {
            return res.status(400).json({ message: 'Daily wage is required' });
        }
        if (program_type != null && program_type !== '') {
            const pt = String(program_type).trim();
            if (pt.length > 48) {
                return res.status(400).json({ message: 'program_type is too long' });
            }
        }
        if (assertPayrollActor(req, res) === null) return;

        const result = await setDailyWage(program_type || null, wage);
        res.status(200).json({ message: 'Daily wage updated', ...result });
    } catch (error) {
        console.error('Error setting daily wage:', error.message);
        const code = isPayrollClientMessage(error.message) ? 400 : 500;
        res.status(code).json({ message: error.message || 'Error setting daily wage' });
    }
}

export async function handleGetAllDailyWages(req, res) {
    try {
        const wages = await getAllDailyWages();
        res.status(200).json(wages);
    } catch (error) {
        console.error('Error fetching daily wages:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching daily wages' });
    }
}
