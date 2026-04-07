const beneficiaryService = require('../services/beneficiary.services');
const ExcelJS = require('exceljs');

// fetch all beneficiaries
exports.getAllBeneficiaries = async (req, res) => {
    try {
        const [rows] = await beneficiaryService.getAllBeneficiaries();
        res.json(rows);
    } catch (err) {
        console.error("FETCH ERROR:", err.message);
        res.status(500).json({ message: err.message });
    }
};

// return count of approved beneficiaries (for dashboard)
exports.getCount = async (req, res) => {
    try {
        const count = await beneficiaryService.getApprovedCount();
        res.json({ count });
    } catch (err) {
        console.error("COUNT ERROR:", err.message);
        res.status(500).json({ message: err.message });
    }
};

// export beneficiaries to excel
exports.exportBeneficiaries = async (req, res) => {
    try {
        const [rows] = await beneficiaryService.getAllBeneficiaries();
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Beneficiaries');

        if (rows.length > 0) {
            worksheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
            rows.forEach((row) => worksheet.addRow(row));
        }

        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=beneficiaries.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('EXPORT ERROR:', err.message);
        res.status(500).json({ message: 'Failed to create export file.' });
    }
};

exports.getBeneficiaryApplicationDetails = async (req, res) => {
    try {
        const applicationId = Number(req.params.applicationId);
        if (!applicationId) {
            return res.status(400).json({ message: 'applicationId is required' });
        }

        const details = await beneficiaryService.getBeneficiaryApplicationDetails(applicationId);
        if (!details) {
            return res.status(404).json({ message: 'Beneficiary application not found' });
        }

        res.json(details);
    } catch (err) {
        console.error('DETAIL FETCH ERROR:', err.message);
        res.status(500).json({ message: err.message });
    }
};

// =============================================
// Admin CRUD endpoints
// =============================================

// Get all beneficiaries with full data for admin management
exports.getAllForAdmin = async (req, res) => {
    try {
        const rows = await beneficiaryService.getAllBeneficiariesForAdmin();
        res.json(rows);
    } catch (err) {
        console.error("ADMIN FETCH ERROR:", err.message);
        res.status(500).json({ message: err.message });
    }
};

// Get single beneficiary by ID
exports.getById = async (req, res) => {
    try {
        const beneficiaryId = Number(req.params.beneficiaryId);
        if (!beneficiaryId) {
            return res.status(400).json({ message: 'beneficiaryId is required' });
        }

        const beneficiary = await beneficiaryService.getBeneficiaryById(beneficiaryId);
        if (!beneficiary) {
            return res.status(404).json({ message: 'Beneficiary not found' });
        }

        res.json(beneficiary);
    } catch (err) {
        console.error('GET BY ID ERROR:', err.message);
        res.status(500).json({ message: err.message });
    }
};

// Admin adds a new beneficiary
exports.addBeneficiary = async (req, res) => {
    try {
        const {
            first_name, last_name, birth_date, gender, civil_status, address, program_type
        } = req.body;

        // Validate required fields
        if (!first_name || !last_name || !birth_date || !gender || !civil_status || !address) {
            return res.status(400).json({
                message: 'Required fields: first_name, last_name, birth_date, gender, civil_status, address'
            });
        }

        const validPrograms = ['tupad', 'spes', 'gip', 'dilp', 'job_seekers'];
        if (program_type && !validPrograms.includes(program_type)) {
            return res.status(400).json({ message: 'Invalid program_type' });
        }

        const result = await beneficiaryService.adminAddBeneficiary(req.body);
        res.status(201).json({
            message: 'Beneficiary added successfully',
            beneficiaryId: result.beneficiaryId,
            applicationId: result.applicationId
        });
    } catch (err) {
        console.error('ADD BENEFICIARY ERROR:', err.message);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A beneficiary with the same name and birth date already exists.' });
        }
        res.status(500).json({ message: err.message });
    }
};

// Admin updates a beneficiary
exports.updateBeneficiary = async (req, res) => {
    try {
        const beneficiaryId = Number(req.params.beneficiaryId);
        if (!beneficiaryId) {
            return res.status(400).json({ message: 'beneficiaryId is required' });
        }

        const {
            first_name, last_name, birth_date, gender, civil_status, address
        } = req.body;

        if (!first_name || !last_name || !birth_date || !gender || !civil_status || !address) {
            return res.status(400).json({
                message: 'Required fields: first_name, last_name, birth_date, gender, civil_status, address'
            });
        }

        const result = await beneficiaryService.adminUpdateBeneficiary(beneficiaryId, req.body);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Beneficiary not found' });
        }

        // If program_type is provided, update the application as well
        if (req.body.program_type && req.body.application_id) {
            await beneficiaryService.adminUpdateBeneficiaryProgram(
                req.body.application_id,
                req.body.program_type
            );
        }

        res.json({ message: 'Beneficiary updated successfully' });
    } catch (err) {
        console.error('UPDATE BENEFICIARY ERROR:', err.message);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A beneficiary with the same name and birth date already exists.' });
        }
        res.status(500).json({ message: err.message });
    }
};

// Admin deletes a beneficiary
exports.deleteBeneficiary = async (req, res) => {
    try {
        const beneficiaryId = Number(req.params.beneficiaryId);
        if (!beneficiaryId) {
            return res.status(400).json({ message: 'beneficiaryId is required' });
        }

        await beneficiaryService.adminDeleteBeneficiary(beneficiaryId);
        res.json({ message: 'Beneficiary deleted successfully' });
    } catch (err) {
        console.error('DELETE BENEFICIARY ERROR:', err.message);
        if (err.message === 'Beneficiary not found') {
            return res.status(404).json({ message: 'Beneficiary not found' });
        }
        res.status(500).json({ message: err.message });
    }
};