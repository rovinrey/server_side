const payrollService = require('../services/payroll.services');

exports.generatePayroll = async (req, res) => {
    try {
        const { month } = req.body;
        const result = await payrollService.generatePayroll(month);
        res.status(200).json({ message: 'Payroll generated successfully', ...result });
    } catch (error) {
        console.error('Error generating payroll:', error.message);
        res.status(500).json({ message: error.message || 'Error generating payroll' });
    }
};

exports.getPayroll = async (req, res) => {
    try {
        const { month, program } = req.query;
        const data = await payrollService.getPayroll(month, program || null);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching payroll:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching payroll' });
    }
};

exports.approvePayroll = async (req, res) => {
    try {
        const { month, program } = req.body;
        const adminId = req.user?.id;
        const result = await payrollService.approvePayroll(month, program || null, adminId);
        res.status(200).json({ message: 'Payroll approved', ...result });
    } catch (error) {
        console.error('Error approving payroll:', error.message);
        res.status(500).json({ message: error.message || 'Error approving payroll' });
    }
};

exports.releasePayroll = async (req, res) => {
    try {
        const { month, program } = req.body;
        const adminId = req.user?.id;
        const result = await payrollService.releasePayroll(month, program || null, adminId);
        res.status(200).json({ message: 'Payroll released', ...result });
    } catch (error) {
        console.error('Error releasing payroll:', error.message);
        res.status(500).json({ message: error.message || 'Error releasing payroll' });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const { month } = req.query;
        const data = await payrollService.getPayrollAnalytics(month || null);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching analytics:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching analytics' });
    }
};

exports.createDisbursement = async (req, res) => {
    try {
        const result = await payrollService.createDisbursement(req.body);
        res.status(201).json({ message: 'Disbursement created', ...result });
    } catch (error) {
        console.error('Error creating disbursement:', error.message);
        res.status(500).json({ message: error.message || 'Error creating disbursement' });
    }
};

exports.getDisbursements = async (req, res) => {
    try {
        const { month } = req.query;
        const rows = await payrollService.getDisbursements(month || null);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching disbursements:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching disbursements' });
    }
};

exports.updateDisbursementStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reference_number } = req.body;
        const adminId = req.user?.id;
        const result = await payrollService.updateDisbursementStatus(
            Number(id), status, adminId, reference_number || null
        );
        res.status(200).json({ message: 'Disbursement updated', ...result });
    } catch (error) {
        console.error('Error updating disbursement:', error.message);
        res.status(400).json({ message: error.message || 'Error updating disbursement' });
    }
};

exports.getBeneficiaryPayouts = async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!userId) {
            return res.status(400).json({ message: 'User ID required' });
        }
        const data = await payrollService.getBeneficiaryPayouts(userId);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching beneficiary payouts:', error.message);
        res.status(500).json({ message: error.message || 'Error fetching payouts' });
    }
};
