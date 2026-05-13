import {
    getAllBeneficiaries,
    getApprovedCount,
    getBeneficiaryApplicationDetails,
    getAllBeneficiariesForAdmin,
    getBeneficiaryById,
    adminAddBeneficiary as adminAddBeneficiaryService,
    adminUpdateBeneficiary,
    adminUpdateBeneficiaryProgram,
    adminDeleteBeneficiary as adminDeleteBeneficiaryService,

    enrollBeneficiary as enrollBeneficiaryService,
    getEnrollmentStatus as getEnrollmentStatusService,
    getProgramEnrollees as getProgramEnrolleesService,
    updateEnrollmentStatus as updateEnrollmentStatusService,
    getOrCreateBeneficiaryProfile,
    updateBeneficiaryProfile,
    checkDuplicateBeneficiary,
    getBeneficiaryProgramHistory,
    getEmploymentHistoryByUserId as getEmploymentHistoryByUserIdService,
} from '../services/beneficiary.services.js';

import ExcelJS from 'exceljs';

const { Workbook } = ExcelJS;

import {
    VALID_PROGRAMS,
    VALID_GENDERS,
    VALID_CIVIL_STATUSES,
    isValidPastDate,
    isValidPhone,
} from '../validators/common.validators.js';

// ========================================
// Helper Validator
// ========================================

function validateBeneficiary(data, isUpdate = false) {
    const {
        first_name,
        last_name,
        birth_date,
        gender,
        civil_status,
        address,
        contact_number,
        program_type,
    } = data;

    if (
        !first_name ||
        !last_name ||
        !birth_date ||
        !gender ||
        !civil_status ||
        !address
    ) {
        return 'Required fields: first_name, last_name, birth_date, gender, civil_status, address';
    }

    const firstName = first_name.trim();
    const lastName = last_name.trim();

    if (firstName.length < 2 || lastName.length < 2) {
        return 'First name and last name must be at least 2 characters';
    }

    if (!isValidPastDate(birth_date)) {
        return 'Birth date must be a valid date in the past';
    }

    if (!VALID_GENDERS.includes(gender)) {
        return `Gender must be one of: ${VALID_GENDERS.join(', ')}`;
    }

    if (!VALID_CIVIL_STATUSES.includes(civil_status)) {
        return `Civil status must be one of: ${VALID_CIVIL_STATUSES.join(', ')}`;
    }

    if (contact_number && !isValidPhone(contact_number)) {
        return 'Invalid contact number format';
    }

    if (program_type && !VALID_PROGRAMS.includes(program_type)) {
        return `Invalid program_type. Must be one of: ${VALID_PROGRAMS.join(', ')}`;
    }

    return null;
}

// ========================================
// Fetch all beneficiaries
// ========================================

export async function getAllBeneficiariesHandler(req, res) {
    try {
        const rows = await getAllBeneficiaries();
        return res.json(rows);
    } catch (err) {
        console.error('FETCH ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

// ========================================
// Count approved beneficiaries
// ========================================

export async function getCount(req, res) {
    try {
        const count = await getApprovedCount();

        return res.json({ count });
    } catch (err) {
        console.error('COUNT ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

// ========================================
// Export beneficiaries
// ========================================

export async function exportBeneficiaries(req, res) {
    try {
        const rows = await getAllBeneficiaries();

        const workbook = new Workbook();
        const worksheet = workbook.addWorksheet('Beneficiaries');

        if (rows.length > 0) {
            worksheet.columns = Object.keys(rows[0]).map((key) => ({
                header: key,
                key,
            }));

            rows.forEach((row) => worksheet.addRow(row));
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            'attachment; filename=beneficiaries.xlsx'
        );

        await workbook.xlsx.write(res);

        return res.end();
    } catch (err) {
        console.error('EXPORT ERROR:', err);

        return res.status(500).json({
            message: 'Failed to create export file',
        });
    }
}

// ========================================
// Get beneficiary application details
// ========================================

export async function getBeneficiaryApplicationDetailsController(req, res) {
    try {
        const applicationId = Number(req.params.applicationId);

        if (!applicationId) {
            return res.status(400).json({
                message: 'applicationId is required',
            });
        }

        const details =
            await getBeneficiaryApplicationDetails(applicationId);

        if (!details) {
            return res.status(404).json({
                message: 'Beneficiary application not found',
            });
        }

        return res.json(details);
    } catch (err) {
        console.error('DETAIL FETCH ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

// ========================================
// Admin CRUD
// ========================================

export async function getAllForAdmin(req, res) {
    try {
        const rows = await getAllBeneficiariesForAdmin();

        return res.json(rows);
    } catch (err) {
        console.error('ADMIN FETCH ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function getBeneficiaryByIdHandler(req, res) {
    try {
        const beneficiaryId = Number(req.params.beneficiaryId);

        if (!beneficiaryId) {
            return res.status(400).json({
                message: 'beneficiaryId is required',
            });
        }

        const beneficiary = await getBeneficiaryById(beneficiaryId);

        if (!beneficiary) {
            return res.status(404).json({
                message: 'Beneficiary not found',
            });
        }

        return res.json(beneficiary);
    } catch (err) {
        console.error('GET BY ID ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function adminAddBeneficiary(req, res) {
    try {
        const validationError = validateBeneficiary(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError,
            });
        }

        const result = await adminAddBeneficiaryService(req.body);


        return res.status(201).json({
            message: 'Beneficiary added successfully',
            beneficiaryId: result.beneficiaryId,
            applicationId: result.applicationId,
        });
    } catch (err) {
        console.error('ADD BENEFICIARY ERROR:', err);

        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message:
                    'A beneficiary with the same name and birth date already exists.',
            });
        }

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

/*
export async function adminUpdateBeneficiary(req, res) {
    try {
        const beneficiaryId = Number(req.params.beneficiaryId);

        if (!beneficiaryId) {
            return res.status(400).json({
                message: 'beneficiaryId is required',
            });
        }

        const validationError = validateBeneficiary(req.body, true);

        if (validationError) {
            return res.status(400).json({
                message: validationError,
            });
        }

        const result = await adminUpdateBeneficiary(
            beneficiaryId,
            req.body
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Beneficiary not found',
            });
        }

        if (req.body.program_type && req.body.application_id) {
            await adminUpdateBeneficiaryProgram(
                req.body.application_id,
                req.body.program_type
            );
        }

        return res.json({
            message: 'Beneficiary updated successfully',
        });
    } catch (err) {
        console.error('UPDATE BENEFICIARY ERROR:', err);

        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message:
                    'A beneficiary with the same name and birth date already exists.',
            });
        }

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function adminDeleteBeneficiaryHandler(req, res) {
    try {
        const beneficiaryId = Number(req.params.beneficiaryId);

        if (!beneficiaryId) {
            return res.status(400).json({
                message: 'beneficiaryId is required',
            });
        }

        await adminDeleteBeneficiaryService(beneficiaryId);

        return res.json({
            message: 'Beneficiary deleted successfully',
        });
    } catch (err) {
        console.error('DELETE BENEFICIARY ERROR:', err);

        if (err.message === 'Beneficiary not found') {
            return res.status(404).json({
                message: 'Beneficiary not found',
            });
        }

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}
*/
// ========================================
// Enrollment
// ========================================

export async function enrollBeneficiary(req, res) {
    try {
        const { applicationId, programId } = req.body;


        if (!applicationId || !programId) {
            return res.status(400).json({
                message: 'applicationId and programId are required',
            });
        }

        const result = await enrollBeneficiaryService(
            applicationId,
            programId
        );

        return res.status(201).json({
            message: 'Beneficiary enrolled successfully',
            enrolleeId: result.enrolleeId,
            applicationId: result.applicationId,
            programId: result.programId,
        });
    } catch (err) {
        console.error('ENROLLMENT ERROR:', err);

        if (
            err.message.includes('must be approved') ||
            err.message.includes('no available slots')
        ) {
            return res.status(400).json({
                message: err.message,
            });
        }

        if (err.message.includes('already enrolled')) {
            return res.status(409).json({
                message: err.message,
            });
        }

        if (
            err.message === 'Program not found' ||
            err.message === 'Application not found'
        ) {
            return res.status(404).json({
                message: err.message,
            });
        }

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function getEnrollmentStatusHandler(req, res) {
    try {
        const { applicationId } = req.params;

        if (!applicationId) {
            return res.status(400).json({
                message: 'applicationId is required',
            });
        }

        const enrollment =
            await getEnrollmentStatusService(applicationId);

        if (!enrollment) {
            return res.status(404).json({
                message: 'No enrollment found for this application',
            });
        }

        return res.json(enrollment);
    } catch (err) {
        console.error('GET ENROLLMENT ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function getProgramEnrolleesHandler(req, res) {
    try {
        const { programId } = req.params;

        if (!programId) {
            return res.status(400).json({
                message: 'programId is required',
            });
        }

        const enrollees =
            await getProgramEnrolleesService(programId);

        return res.json(enrollees);
    } catch (err) {
        console.error('GET PROGRAM ENROLLEES ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function updateEnrollmentStatusHandler(req, res) {
    try {
        const { enrolleeId } = req.params;
        const { status } = req.body;

        if (!enrolleeId || !status) {
            return res.status(400).json({
                message: 'enrolleeId and status are required',
            });
        }

        const result = await updateEnrollmentStatusService(
            enrolleeId,
            status
        );

        return res.json({
            message: `Enrollment status updated to ${status}`,
            result,
        });
    } catch (err) {
        console.error('UPDATE ENROLLMENT STATUS ERROR:', err);

        if (err.message.includes('Invalid status')) {
            return res.status(400).json({
                message: err.message,
            });
        }

        if (err.message === 'Enrollment record not found') {
            return res.status(404).json({
                message: err.message,
            });
        }

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

// ========================================
// Beneficiary Profile
// ========================================

export async function getMyProfile(req, res) {
    try {
        const userId = req.user.id;

        const profile =
            await getOrCreateBeneficiaryProfile(userId);

        return res.json(profile);
    } catch (err) {
        console.error('GET PROFILE ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function updateMyProfile(req, res) {
    try {
        const userId = req.user.id;

        const updated = await updateBeneficiaryProfile(
            userId,
            req.body
        );

        if (!updated) {
            return res.status(404).json({
                message: 'Beneficiary profile not found',
            });
        }

        return res.json({
            message: 'Profile updated successfully',
        });
    } catch (err) {
        console.error('UPDATE PROFILE ERROR:', err);

        if (err.message === 'No fields to update') {
            return res.status(400).json({
                message: err.message,
            });
        }

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function checkDuplicate(req, res) {
    try {
        const userId = req.user.id;
        const { birth_date } = req.body;

        if (!birth_date) {
            return res.status(400).json({
                message: 'birth_date is required',
            });
        }

        const result = await checkDuplicateBeneficiary(
            userId,
            birth_date
        );

        return res.json(result);
    } catch (err) {
        console.error('CHECK DUPLICATE ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

export async function getMyProgramHistory(req, res) {
    try {
        const userId = req.user.id;

        const history =
            await getBeneficiaryProgramHistory(userId);

        return res.json({ history });
    } catch (err) {
        console.error('GET PROGRAM HISTORY ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

// ========================================
// Employment History
// ========================================

export async function getEmploymentHistoryByUserIdHandler(
    req,
    res
) {
    try {
        const userId = Number(req.params.userId);

        if (!userId || userId < 1) {
            return res.status(400).json({
                message: 'userId must be a positive integer',
            });
        }

        const history =
            await getEmploymentHistoryByUserIdService(userId);

        return res.json({ history });
    } catch (err) {
        console.error('GET EMPLOYMENT HISTORY ERROR:', err);

        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}