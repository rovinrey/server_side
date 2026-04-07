const db = require('../../db');
const ExcelJS = require('exceljs');
const tupadService = require('../services/tupad.services');
const dilpService = require('../services/dilp.services');
const spesService = require('../services/spes.services');
const gipService = require('../services/gip.services');
const jobseekerService = require('../services/jobseeker.services');
const beneficiaryService = require('../services/beneficiary.services');

// tupad application endpoint
exports.applyToTupad = async (req, res) => {
    try {
        const data = req.body;
        if (!data.user_id && req.user?.id) {
            data.user_id = req.user.id;
        }
        if (!data.user_id) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        const result = await tupadService.applyTupad(data);
        res.status(201).json({ message: 'TUPAD application submitted', application_id: result.application_id });
    } catch (error) {
        console.error('TUPAD submission error:', error.message || error);
        res.status(500).json({ message: error.message || 'Error saving TUPAD application' });
    }
};

// Apply to SPES program
exports.applyToSpes = async (req, res) => {
    try {
        const data = req.body;
        if (!data.user_id && req.user?.id) {
            data.user_id = req.user.id;
        }
        if (!data.user_id) {
            return res.status(400).json({ message: 'User ID is required for SPES application' });
        }

        const result = await spesService.applyToSpes(data);
        res.status(201).json({ message: "SPES Application Success!", id: result.insertId });
        
    } catch (error) {
        console.error("SPES Application Error:", error.message);
        res.status(500).json({ message: "Error submitting SPES application", error: error.message });
    }
};

// Get SPES details by application ID
exports.getSpesDetails = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const details = await spesService.getSpesDetails(applicationId);
        if (!details) {
            return res.status(404).json({ message: "SPES details not found" });
        }
        res.status(200).json(details);
    } catch (error) {
        console.error("Error fetching SPES details:", error.message);
        res.status(500).json({ message: "Error fetching SPES details", error: error.message });
    }
};

// Update SPES details
exports.updateSpesDetails = async (req, res) => {
    try {
        const { detailId } = req.params;
        const result = await spesService.updateSpesDetails(detailId, req.body);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "SPES details not found" });
        }
        res.status(200).json({ message: "SPES details updated successfully!" });
    } catch (error) {
        console.error("Error updating SPES details:", error.message);
        res.status(500).json({ message: "Error updating SPES details", error: error.message });
    }
};

// Create SPES details (for editing when details don't exist yet)
exports.createSpesDetails = async (req, res) => {
    try {
        const query = `
            INSERT INTO spes_details (
                application_id, gsis_beneficiary, place_of_birth, citizenship,
                social_media_account, status, sex, type_of_student, parent_status,
                is_pwd, is_senior_citizen, is_indigenous_people, is_displaced_worker, is_ofw_descendant,
                father_name, father_occupation, father_contact,
                mother_maiden_name, mother_occupation, mother_contact,
                education_level, name_of_school, degree_earned_course, year_level_grade, date_of_attendance,
                present_address, permanent_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            req.body.application_id,
            req.body.gsis_beneficiary || null,
            req.body.place_of_birth || null,
            req.body.citizenship || 'Filipino',
            req.body.social_media_account || null,
            req.body.status,
            req.body.sex,
            req.body.type_of_student,
            req.body.parent_status,
            req.body.is_pwd || false,
            req.body.is_senior_citizen || false,
            req.body.is_indigenous_people || false,
            req.body.is_displaced_worker || false,
            req.body.is_ofw_descendant || false,
            req.body.father_name || null,
            req.body.father_occupation || null,
            req.body.father_contact || null,
            req.body.mother_maiden_name || null,
            req.body.mother_occupation || null,
            req.body.mother_contact || null,
            req.body.education_level,
            req.body.name_of_school || null,
            req.body.degree_earned_course || null,
            req.body.year_level_grade || null,
            req.body.date_of_attendance || null,
            req.body.present_address || null,
            req.body.permanent_address || null
        ];

        const [result] = await db.execute(query, values);
        res.status(201).json({ message: "SPES details created successfully!", detailId: result.insertId });
    } catch (error) {
        console.error("Error creating SPES details:", error.message);
        res.status(500).json({ message: "Error creating SPES details", error: error.message });
    }
};

// Apply to DILP program (using central applications table)
exports.applyToDilp = async (req, res) => {
    try {
        const data = req.body;
        if (!data.user_id && req.user?.id) {
            data.user_id = req.user.id;
        }
        if (!data.user_id) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        const result = await dilpService.applyToDilp(data);
        res.status(201).json({ message: 'DILP application submitted successfully', application_id: result.application_id });
    } catch (error) {
        console.error('DILP submission error:', error.message || error);
        if (error.message.includes('already have a pending')) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || 'Error saving DILP application' });
    }
};

// Apply to GIP program
exports.applyToGip = async (req, res) => {
    try {
        const data = req.body;
        if (!data.user_id && req.user?.id) {
            data.user_id = req.user.id;
        }
        if (!data.user_id) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        const result = await gipService.applyToGip(data);
        res.status(201).json({ message: 'GIP application submitted successfully', application_id: result.application_id });
    } catch (error) {
        console.error('GIP submission error:', error.message || error);
        if (error.message.includes('already have a pending')) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || 'Error saving GIP application' });
    }
};

// Apply to Job Seekers program
exports.applyToJobSeekers = async (req, res) => {
    try {
        const data = req.body;
        if (!data.user_id && req.user?.id) {
            data.user_id = req.user.id;
        }
        if (!data.user_id) {
            return res.status(400).json({ message: 'user_id is required' });
        }

        const result = await jobseekerService.applyToJobSeekers(data);
        res.status(201).json({ message: 'Job Seekers application submitted successfully', application_id: result.application_id });
    } catch (error) {
        console.error('Job Seekers submission error:', error.message || error);
        if (error.message.includes('already have a pending')) {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: error.message || 'Error saving Job Seekers application' });
    }
};

// Get recent applications
exports.getRecentApplications = async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const isPrivileged = req.user?.role === 'admin' || req.user?.role === 'staff';
        const isBeneficiaryRequest = req.user?.role === 'beneficiary';
        const userId = isPrivileged
            ? (req.query.userId || null)
            : (isBeneficiaryRequest ? req.user?.id : null);
        const [applications] = await beneficiaryService.getRecentApplications(limit, userId);
        res.status(200).json(applications);
    } catch (error) {
        console.error("Error fetching recent applications:", error.message);
        res.status(500).json({ message: "Error fetching recent applications", error: error.message });
    }
};

// Get recent DILP applications
exports.getRecentDilpApplications = async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const [applications] = await dilpService.getDilpApplications(limit);
        res.status(200).json(applications);
    } catch (error) {
        console.error("Error fetching DILP applications:", error.message);
        res.status(500).json({ message: "Error fetching DILP applications", error: error.message });
    }
};

// Get DILP application by ID
exports.getDilpApplicationById = async (req, res) => {
    try {
        const { id } = req.params;
        const [application] = await dilpService.getDilpApplicationById(id);
        if (!application || application.length === 0) {
            return res.status(404).json({ message: "DILP application not found" });
        }
        res.status(200).json(application[0]);
    } catch (error) {
        console.error("Error fetching DILP application:", error.message);
        res.status(500).json({ message: "Error fetching DILP application", error: error.message });
    }
};

// Update DILP application status
exports.updateDilpStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }
        
        await dilpService.updateDilpStatus(id, status);
        res.status(200).json({ message: "DILP application status updated successfully" });
    } catch (error) {
        console.error("Error updating DILP application:", error.message);
        res.status(500).json({ message: "Error updating DILP application", error: error.message });
    }
};

// --- Application approval endpoints (beneficiary) ---
// Get all applications from all programs
exports.getAllApplications = async (req, res) => {
    try {
        const [applications] = await beneficiaryService.getAllApplications();
        res.status(200).json(applications);
    } catch (error) {
        console.error("Error fetching all applications:", error.message);
        res.status(500).json({ message: "Error fetching all applications", error: error.message });
    }
};

// fetch all pending applications
exports.getPendingApplications = async (req, res) => {
    try {
        const { programType } = req.query;
        const [applications] = await beneficiaryService.getPendingApplications(programType || null);
        res.status(200).json(applications);
    } catch (error) {
        console.error("Error getting pending apps:", error.message);
        res.status(500).json({ message: "Error fetching pending applications", error: error.message });
    }
};

// fetch apps filtered by status (query ?status=)
exports.getApplicationsByStatus = async (req, res) => {
    try {
        const { status, programType } = req.query;
        if (!status) {
            const [applications] = await beneficiaryService.getAllApplications();
            return res.status(200).json(applications);
        }
        const [applications] = await beneficiaryService.getApplicationsByStatus(status, programType || null);
        res.status(200).json(applications);
    } catch (error) {
        console.error("Error getting applications by status:", error.message);
        res.status(500).json({ message: "Error fetching applications", error: error.message });
    }
};

// approve specific application by id
exports.approveApplication = async (req, res) => {
    try {
        const { id } = req.params;
        await beneficiaryService.approveApplication(id);
        res.status(200).json({ message: "Application approved successfully" });
    } catch (error) {
        console.error("Error approving application:", error.message);
        res.status(500).json({ message: "Error approving application", error: error.message });
    }
};

// reject application with optional reason in body
exports.rejectApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        await beneficiaryService.rejectApplication(id, reason);
        res.status(200).json({ message: "Application rejected successfully" });
    } catch (error) {
        console.error("Error rejecting application:", error.message);
        res.status(500).json({ message: "Error rejecting application", error: error.message });
    }
};

// approved tupad application 
exports.approvedTupadApplication = async (req, res) => {
    try {
        const { id } = req.params;
        await tupadService.approveTupadApplication(id);
        res.status(200).json({ message: "Tupad application approved successfully!" });
    } catch (error) {
        console.error("Error approving Tupad Application", error.message);
        if (error.message === 'Application not found') {
            return res.status(404).json({ message: "TUPAD application not found" });
        }
        res.status(500).json({ message: "Error approving TUPAD application", error: error.message });
    }
};

// Get current beneficiary status summary + submissions history.
exports.getApplicationStatus = async (req, res) => {
    try {
        // Only admin/staff can look up other users; beneficiaries always use their own ID
        const isPrivileged = req.user?.role === 'admin' || req.user?.role === 'staff';
        const userId = isPrivileged
            ? Number(req.query.userId || req.user?.id)
            : Number(req.user?.id);
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        const data = await beneficiaryService.getUserApplicationStatus(userId);
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching application status:', error.message);
        res.status(500).json({ message: 'Error fetching application status', error: error.message });
    }
};

exports.exportApplications = async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Only admin can export applications' });
        }

        const { programType, status } = req.query;
        const normalizedStatus = status ? String(status) : null;

        if (normalizedStatus && !['Pending', 'Approved'].includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Status must be Pending or Approved for export' });
        }

        const rows = await beneficiaryService.getApplicationsForExport(
            programType || null,
            normalizedStatus || null
        );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Applications');

        worksheet.columns = [
            { header: 'Application ID', key: 'id', width: 14 },
            { header: 'User ID', key: 'user_id', width: 10 },
            { header: 'Program Type', key: 'program_type', width: 14 },
            { header: 'First Name', key: 'first_name', width: 18 },
            { header: 'Middle Name', key: 'middle_name', width: 18 },
            { header: 'Last Name', key: 'last_name', width: 18 },
            { header: 'Contact Number', key: 'contact_number', width: 18 },
            { header: 'Address', key: 'address', width: 28 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Rejection Reason', key: 'rejection_reason', width: 24 },
            { header: 'Applied At', key: 'applied_at', width: 20 },
            { header: 'Approval Date', key: 'approval_date', width: 20 }
        ];

        rows.forEach((row) => worksheet.addRow(row));

        const safeProgram = (programType || 'all').toString().replace(/\s+/g, '_');
        const safeStatus = (normalizedStatus || 'all').toString().toLowerCase();
        const filename = `applications_${safeStatus}_${safeProgram}.xlsx`;

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting applications:', error.message);
        res.status(500).json({ message: 'Error exporting applications', error: error.message });
    }
};

exports.getTupadMonthlyReport = async (req, res) => {
    try {
        const month = req.query.month;
        const report = await beneficiaryService.getTupadMonthlyReport(month);
        res.status(200).json(report);
    } catch (error) {
        console.error('Error generating TUPAD monthly report:', error.message);
        res.status(500).json({ message: 'Error generating monthly report', error: error.message });
    }
};

// =============================================
// Daily Wage Settings
// =============================================
exports.getDailyWage = async (req, res) => {
    try {
        const wage = await beneficiaryService.getDailyWage();
        res.status(200).json({ daily_wage: wage });
    } catch (error) {
        console.error('Error fetching daily wage:', error.message);
        res.status(500).json({ message: 'Error fetching daily wage', error: error.message });
    }
};

exports.updateDailyWage = async (req, res) => {
    try {
        const { daily_wage } = req.body;
        if (daily_wage === undefined || daily_wage === null) {
            return res.status(400).json({ message: 'daily_wage is required' });
        }
        const updatedWage = await beneficiaryService.updateDailyWage(daily_wage);
        res.status(200).json({ message: 'Daily wage updated successfully', daily_wage: updatedWage });
    } catch (error) {
        console.error('Error updating daily wage:', error.message);
        res.status(400).json({ message: error.message });
    }
};

// =============================================
// Admin: Get TUPAD details by application ID
// =============================================
exports.getTupadDetails = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const details = await tupadService.getTupadDetails(applicationId);
        if (!details) {
            return res.status(404).json({ message: "TUPAD details not found" });
        }
        res.status(200).json(details);
    } catch (error) {
        console.error("Error fetching TUPAD details:", error.message);
        res.status(500).json({ message: "Error fetching TUPAD details", error: error.message });
    }
};

// Admin: Update TUPAD details
exports.updateTupadDetails = async (req, res) => {
    try {
        const { detailId } = req.params;
        const result = await tupadService.updateTupadDetails(detailId, req.body);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "TUPAD details not found" });
        }
        res.status(200).json({ message: "TUPAD details updated successfully!" });
    } catch (error) {
        console.error("Error updating TUPAD details:", error.message);
        res.status(500).json({ message: "Error updating TUPAD details", error: error.message });
    }
};

// Admin: Update beneficiary personal info (for any program)
exports.updateApplicationBeneficiary = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { first_name, last_name, middle_name, birth_date, gender, civil_status, contact_number, address } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({ message: 'first_name and last_name are required' });
        }

        // Find the beneficiary linked to this application
        const [apps] = await db.execute('SELECT user_id FROM applications WHERE application_id = ?', [applicationId]);
        if (apps.length === 0) {
            return res.status(404).json({ message: 'Application not found' });
        }

        const userId = apps[0].user_id;

        // Update beneficiary record
        const [result] = await db.execute(
            `UPDATE beneficiaries SET
                first_name = ?, middle_name = ?, last_name = ?,
                birth_date = ?, gender = ?, civil_status = ?,
                contact_number = ?, address = ?
             WHERE user_id = ?`,
            [
                first_name,
                middle_name || null,
                last_name,
                birth_date || null,
                gender || null,
                civil_status || null,
                contact_number || null,
                address || null,
                userId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Beneficiary record not found for this application' });
        }

        res.status(200).json({ message: 'Beneficiary info updated successfully' });
    } catch (error) {
        console.error('Error updating beneficiary info:', error.message);
        res.status(500).json({ message: 'Error updating beneficiary info', error: error.message });
    }
};

// =============================================
// Annex D Excel Export (TUPAD format from PESO)
// =============================================
exports.exportAnnexD = async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Only admin can export Annex D' });
        }

        const { programType, status } = req.query;

        // Fetch approved TUPAD beneficiaries with full details
        const params = [];
        const conditions = ["a.status = 'Approved'"];

        if (programType) {
            conditions.push('a.program_type = ?');
            params.push(programType);
        } else {
            conditions.push("a.program_type = 'tupad'");
        }

        const query = `
            SELECT
                b.beneficiary_id,
                b.first_name,
                b.middle_name,
                b.last_name,
                b.extension_name,
                b.birth_date,
                b.gender,
                b.civil_status,
                b.contact_number,
                b.address,
                a.application_id,
                a.program_type,
                a.approval_date,
                a.applied_at,
                td.valid_id_type,
                td.id_number,
                td.occupation,
                td.monthly_income,
                td.work_category,
                td.job_preference,
                td.educational_attainment
            FROM applications a
            LEFT JOIN beneficiaries b ON b.user_id = a.user_id
            LEFT JOIN tupad_details td ON td.application_id = a.application_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY b.last_name ASC, b.first_name ASC
        `;

        const [rows] = await db.execute(query, params);

        // Build Annex D Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PESO Management System';
        workbook.created = new Date();

        const ws = workbook.addWorksheet('Annex D', {
            pageSetup: {
                paperSize: 9, // A4
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }
            }
        });

        // ── Header rows ──
        // Row 1: Title
        ws.mergeCells('A1:N1');
        const titleCell = ws.getCell('A1');
        titleCell.value = 'ANNEX D';
        titleCell.font = { bold: true, size: 14, name: 'Arial' };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 2: Subtitle
        ws.mergeCells('A2:N2');
        const subtitleCell = ws.getCell('A2');
        subtitleCell.value = 'LIST OF TUPAD BENEFICIARIES';
        subtitleCell.font = { bold: true, size: 12, name: 'Arial' };
        subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 3: Program Info
        ws.mergeCells('A3:N3');
        const programCell = ws.getCell('A3');
        programCell.value = 'TUPAD (Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers)';
        programCell.font = { italic: true, size: 10, name: 'Arial' };
        programCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 4: blank spacer
        ws.mergeCells('A4:N4');

        // Row 5: Info fields
        ws.mergeCells('A5:D5');
        ws.getCell('A5').value = 'PESO/LGU: ________________________________________';
        ws.getCell('A5').font = { size: 10, name: 'Arial' };
        ws.mergeCells('E5:H5');
        ws.getCell('E5').value = 'Date: ' + new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
        ws.getCell('E5').font = { size: 10, name: 'Arial' };
        ws.mergeCells('I5:N5');
        ws.getCell('I5').value = 'Project: ________________________________________';
        ws.getCell('I5').font = { size: 10, name: 'Arial' };

        // Row 6: blank spacer
        ws.mergeCells('A6:N6');

        // Row 7: Column headers
        const headerRow = 7;
        const headers = [
            { key: 'no', header: 'No.', width: 6 },
            { key: 'last_name', header: 'LAST NAME', width: 16 },
            { key: 'first_name', header: 'FIRST NAME', width: 16 },
            { key: 'middle_name', header: 'MIDDLE NAME', width: 14 },
            { key: 'extension', header: 'EXT.', width: 6 },
            { key: 'birth_date', header: 'DATE OF BIRTH', width: 14 },
            { key: 'age', header: 'AGE', width: 6 },
            { key: 'gender', header: 'SEX', width: 8 },
            { key: 'civil_status', header: 'CIVIL STATUS', width: 14 },
            { key: 'address', header: 'ADDRESS', width: 28 },
            { key: 'contact_number', header: 'CONTACT NO.', width: 16 },
            { key: 'valid_id', header: 'VALID ID TYPE', width: 16 },
            { key: 'id_number', header: 'ID NUMBER', width: 16 },
            { key: 'occupation', header: 'OCCUPATION', width: 16 },
        ];

        // Set column widths
        headers.forEach((h, i) => {
            ws.getColumn(i + 1).width = h.width;
        });

        // Write header cells
        const headerRowObj = ws.getRow(headerRow);
        headers.forEach((h, i) => {
            const cell = headerRowObj.getCell(i + 1);
            cell.value = h.header;
            cell.font = { bold: true, size: 9, name: 'Arial' };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            cell.border = {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
        headerRowObj.height = 30;

        // ── Data rows ──
        const calculateAge = (birthDate) => {
            if (!birthDate) return '';
            const birth = new Date(birthDate);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        };

        rows.forEach((row, index) => {
            const dataRow = ws.getRow(headerRow + 1 + index);
            const values = [
                index + 1,
                (row.last_name || '').toUpperCase(),
                (row.first_name || '').toUpperCase(),
                (row.middle_name || '').toUpperCase(),
                row.extension_name || '',
                row.birth_date ? new Date(row.birth_date).toLocaleDateString('en-PH') : '',
                calculateAge(row.birth_date),
                row.gender || '',
                row.civil_status || '',
                row.address || '',
                row.contact_number || '',
                row.valid_id_type || '',
                row.id_number || '',
                row.occupation || ''
            ];

            values.forEach((val, i) => {
                const cell = dataRow.getCell(i + 1);
                cell.value = val;
                cell.font = { size: 9, name: 'Arial' };
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.border = {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            dataRow.height = 20;
        });

        // ── Signature section ──
        const sigRow = headerRow + rows.length + 3;

        ws.mergeCells(`A${sigRow}:D${sigRow}`);
        ws.getCell(`A${sigRow}`).value = 'Prepared by:';
        ws.getCell(`A${sigRow}`).font = { size: 10, name: 'Arial' };

        ws.mergeCells(`H${sigRow}:N${sigRow}`);
        ws.getCell(`H${sigRow}`).value = 'Noted by:';
        ws.getCell(`H${sigRow}`).font = { size: 10, name: 'Arial' };

        ws.mergeCells(`A${sigRow + 2}:D${sigRow + 2}`);
        ws.getCell(`A${sigRow + 2}`).value = '______________________________';
        ws.getCell(`A${sigRow + 2}`).alignment = { horizontal: 'center' };

        ws.mergeCells(`A${sigRow + 3}:D${sigRow + 3}`);
        ws.getCell(`A${sigRow + 3}`).value = 'PESO Manager';
        ws.getCell(`A${sigRow + 3}`).font = { size: 9, name: 'Arial', italic: true };
        ws.getCell(`A${sigRow + 3}`).alignment = { horizontal: 'center' };

        ws.mergeCells(`H${sigRow + 2}:N${sigRow + 2}`);
        ws.getCell(`H${sigRow + 2}`).value = '______________________________';
        ws.getCell(`H${sigRow + 2}`).alignment = { horizontal: 'center' };

        ws.mergeCells(`H${sigRow + 3}:N${sigRow + 3}`);
        ws.getCell(`H${sigRow + 3}`).value = 'Municipal Mayor / Authorized Representative';
        ws.getCell(`H${sigRow + 3}`).font = { size: 9, name: 'Arial', italic: true };
        ws.getCell(`H${sigRow + 3}`).alignment = { horizontal: 'center' };

        // ── Respond ──
        const filename = `Annex_D_TUPAD_Beneficiaries_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error exporting Annex D:', error.message);
        res.status(500).json({ message: 'Error exporting Annex D', error: error.message });
    }
};

// =============================================
// Admin: Update Excel data inline (read, edit, re-export without MS Excel)
// =============================================
exports.updateExcelData = async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Only admin can update Excel data' });
        }

        const { updates } = req.body;
        // updates = [{ application_id, field, table, detail_id, value }]
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ message: 'No updates provided' });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            for (const update of updates) {
                const { application_id, field, table, detail_id, value } = update;

                // Whitelist allowed tables and fields to prevent injection
                const allowedTables = {
                    beneficiaries: [
                        'first_name', 'middle_name', 'last_name', 'extension_name',
                        'birth_date', 'gender', 'civil_status', 'contact_number', 'address'
                    ],
                    tupad_details: [
                        'valid_id_type', 'id_number', 'occupation', 'monthly_income',
                        'civil_status', 'work_category', 'job_preference', 'educational_attainment'
                    ],
                    spes_details: [
                        'place_of_birth', 'citizenship', 'social_media_account', 'civil_status',
                        'sex', 'type_of_student', 'parent_status', 'father_name', 'father_occupation',
                        'father_contact', 'mother_maiden_name', 'mother_occupation', 'mother_contact',
                        'education_level', 'name_of_school', 'degree_earned_course', 'year_level',
                        'present_address', 'permanent_address'
                    ]
                };

                if (!allowedTables[table] || !allowedTables[table].includes(field)) {
                    throw new Error(`Invalid table/field: ${table}.${field}`);
                }

                if (table === 'beneficiaries') {
                    // Get user_id from application
                    const [apps] = await connection.execute(
                        'SELECT user_id FROM applications WHERE application_id = ?',
                        [application_id]
                    );
                    if (apps.length === 0) continue;

                    await connection.execute(
                        `UPDATE beneficiaries SET \`${field}\` = ? WHERE user_id = ?`,
                        [value, apps[0].user_id]
                    );
                } else {
                    const idColumn = detail_id ? 'detail_id' : 'application_id';
                    const idValue = detail_id || application_id;
                    await connection.execute(
                        `UPDATE \`${table}\` SET \`${field}\` = ? WHERE \`${idColumn}\` = ?`,
                        [value, idValue]
                    );
                }
            }

            await connection.commit();
            res.status(200).json({ message: `${updates.length} field(s) updated successfully` });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating Excel data:', error.message);
        res.status(500).json({ message: error.message });
    }
};

// ── Duplicate Detection Endpoints ────────────────────

/**
 * GET /api/forms/duplicates/detect
 * Auto-detect potential duplicates based on matching criteria.
 */
exports.detectDuplicates = async (req, res) => {
    try {
        const duplicates = await beneficiaryService.detectDuplicates();
        res.status(200).json({ duplicates, count: duplicates.length });
    } catch (error) {
        console.error('Error detecting duplicates:', error.message);
        res.status(500).json({ message: 'Failed to detect duplicates' });
    }
};

/**
 * GET /api/forms/duplicates/marked
 * Get all manually-marked duplicate applications.
 */
exports.getMarkedDuplicates = async (req, res) => {
    try {
        const duplicates = await beneficiaryService.getMarkedDuplicates();
        res.status(200).json({ duplicates, count: duplicates.length });
    } catch (error) {
        console.error('Error fetching marked duplicates:', error.message);
        res.status(500).json({ message: 'Failed to fetch marked duplicates' });
    }
};

/**
 * PUT /api/forms/duplicates/:applicationId/mark
 * Mark an application as duplicate with optional notes.
 */
exports.markDuplicate = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { notes } = req.body;
        await beneficiaryService.markAsDuplicate(applicationId, notes);
        res.status(200).json({ message: 'Application marked as duplicate' });
    } catch (error) {
        console.error('Error marking duplicate:', error.message);
        res.status(500).json({ message: 'Failed to mark as duplicate' });
    }
};

/**
 * PUT /api/forms/duplicates/:applicationId/unmark
 * Remove duplicate flag from an application.
 */
exports.unmarkDuplicate = async (req, res) => {
    try {
        const { applicationId } = req.params;
        await beneficiaryService.unmarkDuplicate(applicationId);
        res.status(200).json({ message: 'Duplicate flag removed' });
    } catch (error) {
        console.error('Error unmarking duplicate:', error.message);
        res.status(500).json({ message: 'Failed to unmark duplicate' });
    }
};

/**
 * PUT /api/forms/duplicates/:applicationId/resolve
 * Resolve a duplicate — either reject or keep the application.
 */
exports.resolveDuplicate = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { action } = req.body; // 'reject' or 'keep'
        if (!['reject', 'keep'].includes(action)) {
            return res.status(400).json({ message: 'Action must be "reject" or "keep"' });
        }
        await beneficiaryService.resolveDuplicate(applicationId, action);
        res.status(200).json({ message: `Application ${action === 'reject' ? 'rejected as duplicate' : 'kept and unmarked'}` });
    } catch (error) {
        console.error('Error resolving duplicate:', error.message);
        res.status(500).json({ message: 'Failed to resolve duplicate' });
    }
};

// ── Duplicate Beneficiaries ──────────────────────────

exports.detectDuplicateBeneficiaries = async (req, res) => {
    try {
        const duplicates = await beneficiaryService.detectDuplicateBeneficiaries();
        res.status(200).json({ duplicates, count: duplicates.length });
    } catch (error) {
        console.error('Error detecting duplicate beneficiaries:', error.message);
        res.status(500).json({ message: 'Failed to detect duplicate beneficiaries' });
    }
};

exports.deleteBeneficiary = async (req, res) => {
    try {
        const { beneficiaryId } = req.params;
        await beneficiaryService.deleteBeneficiaryById(beneficiaryId);
        res.status(200).json({ message: 'Beneficiary deleted successfully' });
    } catch (error) {
        console.error('Error deleting beneficiary:', error.message);
        res.status(500).json({ message: 'Failed to delete beneficiary' });
    }
};

// ── Duplicate Attendance ─────────────────────────────

exports.detectDuplicateAttendance = async (req, res) => {
    try {
        const duplicates = await beneficiaryService.detectDuplicateAttendance();
        res.status(200).json({ duplicates, count: duplicates.length });
    } catch (error) {
        console.error('Error detecting duplicate attendance:', error.message);
        res.status(500).json({ message: 'Failed to detect duplicate attendance' });
    }
};

exports.deleteAttendanceRecord = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        await beneficiaryService.deleteAttendanceRecord(attendanceId);
        res.status(200).json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
        console.error('Error deleting attendance record:', error.message);
        res.status(500).json({ message: 'Failed to delete attendance record' });
    }
};
