const db = require('../../config');

/**
 * PESO Juban, Sorsogon — Comprehensive Report Service
 *
 * Reports required by DOLE / PESO municipal offices:
 *  1. Program Accomplishment Report (all programs)
 *  2. Beneficiary Master List (demographics, per-program)
 *  3. Payroll & Disbursement Summary
 *  4. Attendance Summary / Compliance
 *  5. DILP Project Monitoring
 *  6. Employment Facilitation (Job Seekers)
 *  7. SPES Intern Report
 *  8. GIP Intern Report
 *  9. Quarterly / Annual Consolidated Report
 */

// ── Helpers ──────────────────────────────────────────

const toStartDate = (month) => `${month}-01`;

const getDailyWage = async () => {
    const [rows] = await db.execute(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'tupad_daily_wage'`
    );
    return rows.length > 0 ? parseFloat(rows[0].setting_value) || 435 : 435;
};

/**
 * Parse a quarter string like "2026-Q1" into start/end dates.
 */
const parseQuarter = (quarterStr) => {
    const [year, q] = quarterStr.split('-Q');
    const qNum = parseInt(q, 10);
    const startMonth = (qNum - 1) * 3;
    const startDate = new Date(parseInt(year, 10), startMonth, 1);
    const endDate = new Date(parseInt(year, 10), startMonth + 3, 0); // last day of quarter
    return {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        label: `Q${qNum} ${year}`,
    };
};

// ══════════════════════════════════════════════════════
// 1. PROGRAM ACCOMPLISHMENT REPORT
// ══════════════════════════════════════════════════════

exports.getProgramAccomplishment = async (month = null) => {
    // Overall program stats
    const [programs] = await db.execute(`
        SELECT
            program_id, program_name, location, slots, filled, budget, used,
            status, start_date, end_date
        FROM programs
        ORDER BY program_name
    `);

    // Application counts by program and status
    let appQuery = `
        SELECT
            LOWER(program_type) AS program_type,
            status,
            COUNT(*) AS count
        FROM applications
    `;
    const appParams = [];
    if (month) {
        appQuery += ` WHERE applied_at >= ? AND applied_at < DATE_ADD(LAST_DAY(?), INTERVAL 1 DAY)`;
        appParams.push(toStartDate(month), toStartDate(month));
    }
    appQuery += ` GROUP BY program_type, status ORDER BY program_type, status`;
    const [applicationCounts] = await db.execute(appQuery, appParams);

    // Gender breakdown by program
    let genderQuery = `
        SELECT
            LOWER(a.program_type) AS program_type,
            COALESCE(LOWER(b.gender), 'unknown') AS gender,
            COUNT(*) AS count
        FROM applications a
        LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    `;
    const genderParams = [];
    if (month) {
        genderQuery += ` WHERE a.applied_at >= ? AND a.applied_at < DATE_ADD(LAST_DAY(?), INTERVAL 1 DAY)`;
        genderParams.push(toStartDate(month), toStartDate(month));
    }
    genderQuery += ` GROUP BY program_type, gender ORDER BY program_type, gender`;
    const [genderByProgram] = await db.execute(genderQuery, genderParams);

    // Budget utilization summary
    const budgetSummary = programs.map(p => ({
        program_name: p.program_name,
        budget: parseFloat(p.budget) || 0,
        used: parseFloat(p.used) || 0,
        remaining: (parseFloat(p.budget) || 0) - (parseFloat(p.used) || 0),
        utilization_rate: p.budget > 0
            ? Math.round(((parseFloat(p.used) || 0) / parseFloat(p.budget)) * 10000) / 100
            : 0,
        slots: p.slots || 0,
        filled: p.filled || 0,
        slot_rate: p.slots > 0
            ? Math.round((p.filled / p.slots) * 10000) / 100
            : 0,
        status: p.status,
    }));

    // Totals
    const totalBudget = budgetSummary.reduce((s, p) => s + p.budget, 0);
    const totalUsed = budgetSummary.reduce((s, p) => s + p.used, 0);
    const totalSlots = budgetSummary.reduce((s, p) => s + p.slots, 0);
    const totalFilled = budgetSummary.reduce((s, p) => s + p.filled, 0);

    return {
        period: month || 'All Time',
        programs: budgetSummary,
        applicationCounts,
        genderByProgram,
        totals: {
            budget: totalBudget,
            used: totalUsed,
            remaining: totalBudget - totalUsed,
            utilization_rate: totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 10000) / 100 : 0,
            slots: totalSlots,
            filled: totalFilled,
            slot_rate: totalSlots > 0 ? Math.round((totalFilled / totalSlots) * 10000) / 100 : 0,
            program_count: programs.length,
        },
    };
};

// ══════════════════════════════════════════════════════
// 2. BENEFICIARY MASTER LIST
// ══════════════════════════════════════════════════════
exports.getBeneficiaryMasterList = async (programType = null, status = null) => {
    let query = `
        SELECT 
            a.application_id,
            a.user_id,
            LOWER(a.program_type) AS program_type,
            a.status AS application_status,
            b.first_name,
            b.middle_name,
            b.last_name,
            b.extension_name,
            b.birth_date,
            TIMESTAMPDIFF(YEAR, b.birth_date, CURDATE()) AS age,
            b.gender,
            b.civil_status,
            b.contact_number,
            COALESCE(b.address, '') AS address
        FROM applications a
        LEFT JOIN beneficiaries b ON b.user_id = a.user_id
        WHERE 1=1
    `;
    
    const params = [];

    if (programType) {
        query += ` AND LOWER(a.program_type) = ?`;
        params.push(programType.toLowerCase());
    }
    if (status) {
        query += ` AND a.status = ?`;
        params.push(status);
    }

    query += ` ORDER BY b.last_name, b.first_name LIMIT 100`;

    const [rows] = await db.execute(query, params);

    const maleCount = rows.filter(r => r.gender && r.gender.toLowerCase() === 'male').length;
    const femaleCount = rows.filter(r => r.gender && r.gender.toLowerCase() === 'female').length;
    
    return { 
        beneficiaries: rows, 
        demographics: {
            total: rows.length,
            male: maleCount,
            female: femaleCount
        },
        byProgram: {},
        byAge: { '15-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-59': 0, '60+': 0 },
        byCivilStatus: {}
    };

};

// ══════════════════════════════════════════════════════
// ANNEX K: MONTHLY/COMPLETION ACCOMPLISHMENT REPORT
// ══════════════════════════════════════════════════════

exports.getAnnexKData = async (programId) => {
    const dailyWage = await getDailyWage();
    const totalDays = 10; // Standard TUPAD work cycle
    const totalPayout = totalDays * dailyWage;

    const query = `
        SELECT
            p.program_id,
            p.program_name,
            p.location,
            p.start_date,
            p.end_date,
            p.slots,
            p.filled,
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
                u.user_name
            ) AS beneficiary_name,
            pe.enrollment_date,
            pe.current_status,
            ? AS daily_wage,
            ? AS total_days,
            ? AS total_payout
        FROM programs p
        INNER JOIN program_enrollees pe ON p.program_id = pe.program_id
        INNER JOIN applications a ON pe.application_id = a.application_id
        LEFT JOIN beneficiaries b ON a.user_id = b.user_id
        LEFT JOIN users u ON a.user_id = u.user_id
        WHERE p.program_id = ? AND pe.current_status = 'Active'
        ORDER BY beneficiary_name ASC
    `;

    const [rows] = await db.execute(query, [dailyWage, totalDays, totalPayout, programId]);

    if (rows.length === 0) {
        throw new Error('No active enrollees found for this program');
    }

    const program = {
        program_id: rows[0].program_id,
        program_name: rows[0].program_name,
        location: rows[0].location,
        start_date: rows[0].start_date,
        end_date: rows[0].end_date,
        slots: rows[0].slots,
        filled: rows[0].filled,
        daily_wage: dailyWage,
        total_days: totalDays,
        total_payout: totalPayout,
        beneficiaries: rows.map(row => ({
            name: row.beneficiary_name || 'Unknown',
            enrollment_date: row.enrollment_date,
            status: row.current_status
        }))
    };

    return program;
};

// ══════════════════════════════════════════════════════
// 3. PAYROLL & DISBURSEMENT SUMMARY
// ══════════════════════════════════════════════════════

exports.getPayrollSummary = async (month) => {
    const startDate = toStartDate(month);
    const dailyWage = await getDailyWage();

    // Payroll by program
    const [byProgram] = await db.execute(`
        SELECT
            pr.program_type,
            pr.status,
            COUNT(DISTINCT pr.user_id) AS beneficiary_count,
            SUM(pr.days_worked) AS total_days,
            SUM(pr.total_payout) AS total_payout
        FROM payroll_records pr
        WHERE pr.payroll_month = ?
        GROUP BY pr.program_type, pr.status
        ORDER BY pr.program_type, pr.status
    `, [month]);

    // Payroll details with names
    const [records] = await db.execute(`
        SELECT
            pr.payroll_id,
            pr.user_id,
            pr.program_type,
            pr.days_worked,
            pr.daily_wage,
            pr.total_payout,
            pr.status,
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
                u.user_name
            ) AS full_name,
            b.gender,
            b.address
        FROM payroll_records pr
        LEFT JOIN users u ON u.user_id = pr.user_id
        LEFT JOIN beneficiaries b ON b.user_id = pr.user_id
        WHERE pr.payroll_month = ?
        ORDER BY pr.program_type, full_name
    `, [month]);

    // Disbursements for the month
    const [disbursements] = await db.execute(`
        SELECT
            d.batch_code,
            d.program_type,
            d.total_amount,
            d.recipient_count,
            d.payment_mode,
            d.status,
            d.reference_number,
            d.scheduled_date,
            d.released_date
        FROM disbursements d
        WHERE d.payroll_month = ?
        ORDER BY d.created_at DESC
    `, [month]);

    const totalPayout = records.reduce((s, r) => s + parseFloat(r.total_payout || 0), 0);
    const totalDays = records.reduce((s, r) => s + (r.days_worked || 0), 0);

    return {
        month,
        dailyWage,
        byProgram,
        records,
        disbursements,
        totals: {
            beneficiary_count: records.length,
            total_days: totalDays,
            total_payout: totalPayout,
            disbursement_batches: disbursements.length,
            disbursed_amount: disbursements
                .filter(d => d.status === 'Released')
                .reduce((s, d) => s + parseFloat(d.total_amount || 0), 0),
        },
    };
};

// ══════════════════════════════════════════════════════
// 4. ATTENDANCE SUMMARY / COMPLIANCE REPORT
// ══════════════════════════════════════════════════════

exports.getAttendanceSummary = async (month, programType = null) => {
    const startDate = toStartDate(month);

    let query = `
        SELECT
            ar.user_id,
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
                u.user_name
            ) AS full_name,
            ar.program_type,
            SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) AS present_days,
            SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) AS absent_days,
            SUM(CASE WHEN ar.status = 'Incomplete' THEN 1 ELSE 0 END) AS incomplete_days,
            COUNT(*) AS total_records,
            MIN(ar.attendance_date) AS first_attendance,
            MAX(ar.attendance_date) AS last_attendance
        FROM attendance_records ar
        LEFT JOIN users u ON u.user_id = ar.user_id
        LEFT JOIN beneficiaries b ON b.user_id = ar.user_id
        WHERE ar.attendance_date >= ? AND ar.attendance_date <= LAST_DAY(?)
    `;
    const params = [startDate, startDate];

    if (programType) {
        query += ` AND LOWER(ar.program_type) = ?`;
        params.push(programType.toLowerCase());
    }

    query += ` GROUP BY ar.user_id, full_name, ar.program_type ORDER BY ar.program_type, full_name`;

    const [records] = await db.execute(query, params);

    // Aggregate stats
    const [statusCounts] = await db.execute(`
        SELECT
            COALESCE(LOWER(ar.program_type), 'unknown') AS program_type,
            ar.status,
            COUNT(*) AS count
        FROM attendance_records ar
        WHERE ar.attendance_date >= ? AND ar.attendance_date <= LAST_DAY(?)
        ${programType ? 'AND LOWER(ar.program_type) = ?' : ''}
        GROUP BY ar.program_type, ar.status
        ORDER BY ar.program_type, ar.status
    `, programType ? [startDate, startDate, programType.toLowerCase()] : [startDate, startDate]);

    const totalPresent = records.reduce((s, r) => s + r.present_days, 0);
    const totalAbsent = records.reduce((s, r) => s + r.absent_days, 0);
    const totalRecords = records.reduce((s, r) => s + r.total_records, 0);

    return {
        month,
        programType: programType || 'All',
        records,
        statusCounts,
        totals: {
            beneficiaries: records.length,
            present_days: totalPresent,
            absent_days: totalAbsent,
            total_records: totalRecords,
            compliance_rate: totalRecords > 0
                ? Math.round((totalPresent / totalRecords) * 10000) / 100
                : 0,
        },
    };
};

// ══════════════════════════════════════════════════════
// 5. DILP PROJECT MONITORING REPORT
// ══════════════════════════════════════════════════════

exports.getDilpMonitoringReport = async (month = null) => {
    let query = `
        SELECT
            a.application_id,
            a.user_id,
            a.status AS application_status,
            a.applied_at,
            a.approval_date,
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
                u.user_name
            ) AS proponent_name,
            b.gender,
            b.contact_number,
            b.address,
            d.project_title,
            d.project_type,
            d.category,
            d.proposed_amount,
            d.location AS project_location,
            d.barangay,
            d.municipality,
            d.province,
            d.estimated_monthly_income,
            d.number_of_beneficiaries,
            d.business_experience,
            d.skills_training,
            d.brief_description
        FROM applications a
        LEFT JOIN beneficiaries b ON b.user_id = a.user_id
        LEFT JOIN users u ON u.user_id = a.user_id
        LEFT JOIN dilp_details d ON d.application_id = a.application_id
        WHERE LOWER(a.program_type) = 'dilp'
    `;
    const params = [];

    if (month) {
        query += ` AND a.applied_at >= ? AND a.applied_at < DATE_ADD(LAST_DAY(?), INTERVAL 1 DAY)`;
        params.push(toStartDate(month), toStartDate(month));
    }

    query += ` ORDER BY a.applied_at DESC`;

    const [projects] = await db.execute(query, params);

    // Summary by category
    const byCategory = {};
    const byStatus = {};
    let totalProposedAmount = 0;
    let totalBeneficiaries = 0;

    projects.forEach(p => {
        const cat = p.category || 'Unknown';
        if (!byCategory[cat]) byCategory[cat] = { count: 0, amount: 0 };
        byCategory[cat].count++;
        byCategory[cat].amount += parseFloat(p.proposed_amount || 0);

        const st = p.application_status || 'Unknown';
        if (!byStatus[st]) byStatus[st] = 0;
        byStatus[st]++;

        totalProposedAmount += parseFloat(p.proposed_amount || 0);
        totalBeneficiaries += parseInt(p.number_of_beneficiaries || 0);
    });

    return {
        period: month || 'All Time',
        projects,
        summary: {
            total_projects: projects.length,
            total_proposed_amount: totalProposedAmount,
            total_beneficiaries: totalBeneficiaries,
            byCategory: Object.entries(byCategory).map(([k, v]) => ({ category: k, ...v })),
            byStatus: Object.entries(byStatus).map(([k, v]) => ({ status: k, count: v })),
        },
    };
};

// ══════════════════════════════════════════════════════
// 6. EMPLOYMENT FACILITATION REPORT (Job Seekers)
// ══════════════════════════════════════════════════════

exports.getEmploymentFacilitationReport = async (month = null) => {
    let query = `
        SELECT
            a.application_id,
            a.user_id,
            a.status AS application_status,
            a.applied_at,
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
                u.user_name
            ) AS full_name,
            TIMESTAMPDIFF(YEAR, b.birth_date, CURDATE()) AS age,
            b.gender,
            b.civil_status,
            b.contact_number,
            b.address,
            j.employment_status,
            j.preferred_work_type,
            j.preferred_industry,
            j.years_of_experience,
            j.technical_skills,
            j.certifications,
            j.availability,
            j.expected_salary
        FROM applications a
        LEFT JOIN beneficiaries b ON b.user_id = a.user_id
        LEFT JOIN users u ON u.user_id = a.user_id
        LEFT JOIN jobseeker_details j ON j.application_id = a.application_id
        WHERE LOWER(a.program_type) = 'job_seekers'
    `;
    const params = [];

    if (month) {
        query += ` AND a.applied_at >= ? AND a.applied_at < DATE_ADD(LAST_DAY(?), INTERVAL 1 DAY)`;
        params.push(toStartDate(month), toStartDate(month));
    }

    query += ` ORDER BY a.applied_at DESC`;

    const [seekers] = await db.execute(query, params);

    // Aggregations
    const byWorkType = {};
    const byIndustry = {};
    const byEmploymentStatus = {};
    const byAge = { '15-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-59': 0, '60+': 0 };

    seekers.forEach(s => {
        const wt = s.preferred_work_type || 'Not specified';
        byWorkType[wt] = (byWorkType[wt] || 0) + 1;

        const ind = s.preferred_industry || 'Not specified';
        byIndustry[ind] = (byIndustry[ind] || 0) + 1;

        const es = s.employment_status || 'Not specified';
        byEmploymentStatus[es] = (byEmploymentStatus[es] || 0) + 1;

        const age = s.age;
        if (age !== null && age !== undefined) {
            if (age < 18) byAge['15-17']++;
            else if (age <= 24) byAge['18-24']++;
            else if (age <= 34) byAge['25-34']++;
            else if (age <= 44) byAge['35-44']++;
            else if (age <= 59) byAge['45-59']++;
            else byAge['60+']++;
        }
    });

    const male = seekers.filter(s => s.gender && s.gender.toLowerCase() === 'male').length;
    const female = seekers.filter(s => s.gender && s.gender.toLowerCase() === 'female').length;

    return {
        period: month || 'All Time',
        seekers,
        summary: {
            total_registered: seekers.length,
            male,
            female,
            byAge,
            byWorkType: Object.entries(byWorkType).map(([k, v]) => ({ type: k, count: v })),
            byIndustry: Object.entries(byIndustry).map(([k, v]) => ({ industry: k, count: v })),
            byEmploymentStatus: Object.entries(byEmploymentStatus).map(([k, v]) => ({ status: k, count: v })),
        },
    };
};

// ══════════════════════════════════════════════════════
// 7. SPES INTERN REPORT
// ══════════════════════════════════════════════════════

exports.getSpesReport = async (month = null) => {
    let query = `
        SELECT
            a.application_id,
            a.user_id,
            a.status AS application_status,
            a.applied_at,
            a.approval_date,
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
                u.user_name
            ) AS full_name,
            TIMESTAMPDIFF(YEAR, b.birth_date, CURDATE()) AS age,
            b.gender,
            b.civil_status,
            b.contact_number,
            b.address,
            s.education_level,
            s.name_of_school AS school,
            s.degree_earned_course AS course,
            s.year_level,
            s.type_of_student,
            s.parent_status,
            s.place_of_birth,
            s.citizenship
        FROM applications a
        LEFT JOIN beneficiaries b ON b.user_id = a.user_id
        LEFT JOIN users u ON u.user_id = a.user_id
        LEFT JOIN spes_details s ON s.application_id = a.application_id
        WHERE LOWER(a.program_type) = 'spes'
    `;
    const params = [];

    if (month) {
        query += ` AND a.applied_at >= ? AND a.applied_at < DATE_ADD(LAST_DAY(?), INTERVAL 1 DAY)`;
        params.push(toStartDate(month), toStartDate(month));
    }

    query += ` ORDER BY b.last_name, b.first_name`;

    const [interns] = await db.execute(query, params);

    const male = interns.filter(i => i.gender && i.gender.toLowerCase() === 'male').length;
    const female = interns.filter(i => i.gender && i.gender.toLowerCase() === 'female').length;
    const byEducation = {};
    const byStudentType = {};
    const byStatus = {};

    interns.forEach(i => {
        const ed = i.education_level || 'Not specified';
        byEducation[ed] = (byEducation[ed] || 0) + 1;

        const st = i.type_of_student || 'Not specified';
        byStudentType[st] = (byStudentType[st] || 0) + 1;

        const as_ = i.application_status || 'Unknown';
        byStatus[as_] = (byStatus[as_] || 0) + 1;
    });

    return {
        period: month || 'All Time',
        interns,
        summary: {
            total: interns.length,
            male,
            female,
            byEducation: Object.entries(byEducation).map(([k, v]) => ({ level: k, count: v })),
            byStudentType: Object.entries(byStudentType).map(([k, v]) => ({ type: k, count: v })),
            byStatus: Object.entries(byStatus).map(([k, v]) => ({ status: k, count: v })),
        },
    };
};

// ══════════════════════════════════════════════════════
// 8. GIP INTERN REPORT
// ══════════════════════════════════════════════════════

exports.getGipReport = async (month = null) => {
    let query = `
        SELECT
            a.application_id,
            a.user_id,
            a.status AS application_status,
            a.applied_at,
            a.approval_date,
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
                u.user_name
            ) AS full_name,
            TIMESTAMPDIFF(YEAR, b.birth_date, CURDATE()) AS age,
            b.gender,
            b.civil_status,
            b.contact_number,
            b.address,
            g.school,
            g.course,
            g.year_graduated,
            g.education_level,
            g.employment_status,
            g.skills,
            g.government_id,
            g.emergency_name,
            g.emergency_contact
        FROM applications a
        LEFT JOIN beneficiaries b ON b.user_id = a.user_id
        LEFT JOIN users u ON u.user_id = a.user_id
        LEFT JOIN gip_details g ON g.application_id = a.application_id
        WHERE LOWER(a.program_type) = 'gip'
    `;
    const params = [];

    if (month) {
        query += ` AND a.applied_at >= ? AND a.applied_at < DATE_ADD(LAST_DAY(?), INTERVAL 1 DAY)`;
        params.push(toStartDate(month), toStartDate(month));
    }

    query += ` ORDER BY b.last_name, b.first_name`;

    const [interns] = await db.execute(query, params);

    const male = interns.filter(i => i.gender && i.gender.toLowerCase() === 'male').length;
    const female = interns.filter(i => i.gender && i.gender.toLowerCase() === 'female').length;
    const bySchool = {};
    const byCourse = {};

    interns.forEach(i => {
        const sc = i.school || 'Not specified';
        bySchool[sc] = (bySchool[sc] || 0) + 1;

        const co = i.course || 'Not specified';
        byCourse[co] = (byCourse[co] || 0) + 1;
    });

    return {
        period: month || 'All Time',
        interns,
        summary: {
            total: interns.length,
            male,
            female,
            bySchool: Object.entries(bySchool).map(([k, v]) => ({ school: k, count: v })),
            byCourse: Object.entries(byCourse).map(([k, v]) => ({ course: k, count: v })),
        },
    };
};

// ══════════════════════════════════════════════════════
// 10. ANALYTICS SUMMARY REPORT (NEW)
// ══════════════════════════════════════════════════════

let cachedAnalyticsSchema = null;

async function getAnalyticsSchemaFlags() {
    if (cachedAnalyticsSchema) return cachedAnalyticsSchema;
    const [tables] = await db.execute(`SHOW TABLES LIKE 'barangays'`);
    const [createdCol] = await db.execute(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beneficiaries' AND COLUMN_NAME = 'created_at' LIMIT 1`
    );
    const [barangayIdCol] = await db.execute(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'beneficiaries' AND COLUMN_NAME = 'barangay_id' LIMIT 1`
    );
    cachedAnalyticsSchema = {
        hasBarangaysTable: tables.length > 0,
        hasBeneficiaryCreatedAt: createdCol.length > 0,
        hasBeneficiaryBarangayId: barangayIdCol.length > 0,
    };
    return cachedAnalyticsSchema;
}

function normalizeTimeRange(timeRange) {
    if (timeRange === undefined || timeRange === null || String(timeRange).trim() === '') {
        return 'year';
    }
    const key = String(timeRange).toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    const compact = key.replace(/\s/g, '');
    const map = {
        today: 'today',
        'last week': 'week',
        lastweek: 'week',
        week: 'week',
        month: 'month',
        '6 months': '6months',
        '6months': '6months',
        sixmonths: '6months',
        year: 'year',
    };
    return map[key] || map[compact] || 'year';
}

function normalizeSortOrder(sort) {
    if (!sort || String(sort).trim() === '') return 'asc';
    const s = String(sort).toLowerCase().trim();
    if (s === 'z-a' || s === 'z_a' || s === 'desc' || s === 'descending') return 'desc';
    if (s === 'a-z' || s === 'a_z' || s === 'asc' || s === 'ascending') return 'asc';
    return 'asc';
}

function buildIntervalClause(range, dateExpr) {
    switch (range) {
        case 'today':
            return `AND DATE(${dateExpr}) = CURDATE()`;
        case 'week':
            return `AND ${dateExpr} >= NOW() - INTERVAL 7 DAY`;
        case 'month':
            return `AND ${dateExpr} >= NOW() - INTERVAL 1 MONTH`;
        case '6months':
            return `AND ${dateExpr} >= NOW() - INTERVAL 6 MONTH`;
        case 'year':
            return `AND ${dateExpr} >= NOW() - INTERVAL 1 YEAR`;
        default:
            return '';
    }
}

/**
 * Beneficiary counts by barangay (Male / Female / Total).
 * Joins beneficiaries → applications (program_type); optional barangays; program_enrollees → programs.
 * Date filter uses COALESCE(beneficiary.created_at, application.applied_at) when created_at exists.
 */
exports.getSummaryReport = async ({ program, timeRange, sortOrder }) => {
    const flags = await getAnalyticsSchemaFlags();
    const range = normalizeTimeRange(timeRange);
    const sort = normalizeSortOrder(sortOrder);
    const prog = program && String(program).toLowerCase() !== 'all' ? program : null;

    const dateExpr = flags.hasBeneficiaryCreatedAt
        ? 'COALESCE(b.created_at, a.applied_at)'
        : 'a.applied_at';

    const barangayJoin = flags.hasBarangaysTable
        ? 'LEFT JOIN barangays br ON b.barangay_id = br.barangay_id'
        : '';

    const barangayExpr = flags.hasBarangaysTable
        ? `TRIM(COALESCE(br.name, SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(b.address), ',', 2), ',', -1)))`
        : `TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(TRIM(b.address), ',', 2), ',', -1))`;

    const locationClause = flags.hasBeneficiaryBarangayId
        ? `(b.barangay_id IS NOT NULL OR (b.address IS NOT NULL AND TRIM(b.address) <> ''))`
        : `(b.address IS NOT NULL AND TRIM(b.address) <> '')`;

    const intervalClause = buildIntervalClause(range, dateExpr);
    const programFilter = prog ? 'AND LOWER(a.program_type) = LOWER(?)' : '';
    const programParams = prog ? [prog] : [];

    const orderClause = sort === 'desc' ? 'ORDER BY t.barangay DESC' : 'ORDER BY t.barangay ASC';

    const sql = `
        SELECT
            t.barangay,
            SUM(t.male_flag) AS male_count,
            SUM(t.female_flag) AS female_count,
            COUNT(*) AS total
        FROM (
            SELECT
                ${barangayExpr} AS barangay,
                CASE WHEN b.gender = 'Male' THEN 1 ELSE 0 END AS male_flag,
                CASE WHEN b.gender = 'Female' THEN 1 ELSE 0 END AS female_flag
            FROM beneficiaries b
            INNER JOIN applications a ON b.user_id = a.user_id AND a.status = 'Approved'
            ${barangayJoin}
            LEFT JOIN program_enrollees pe ON pe.application_id = a.application_id
            LEFT JOIN programs p ON p.program_id = pe.program_id
            WHERE ${locationClause}
            ${intervalClause}
            ${programFilter}
        ) t
        WHERE t.barangay IS NOT NULL AND TRIM(t.barangay) <> ''
        GROUP BY t.barangay
        ${orderClause}
    `;

    const [rows] = await db.execute(sql, programParams);
    return processResults(rows, sort);
};

// Helper function to process results and calculate totals
const processResults = (rows, sortOrder) => {
    // Handle empty results
    if (!rows || rows.length === 0) {
        return {
            barangays: [],
            summary: {
                total_male: 0,
                total_female: 0,
                grand_total: 0
            }
        };
    }

    // Clean up barangay names
    const cleanedRows = rows.map(row => ({
        barangay: row.barangay || 'Unknown',
        male: parseInt(row.male_count) || 0,
        female: parseInt(row.female_count) || 0,
        total: parseInt(row.total) || 0
    }));

    // Calculate totals
    const totalMale = cleanedRows.reduce((sum, row) => sum + row.male, 0);
    const totalFemale = cleanedRows.reduce((sum, row) => sum + row.female, 0);
    const grandTotal = cleanedRows.reduce((sum, row) => sum + row.total, 0);

    return {
        barangays: cleanedRows,
        summary: {
            total_male: totalMale,
            total_female: totalFemale,
            grand_total: grandTotal
        }
    };
};

// ══════════════════════════════════════════════════════
// 9. QUARTERLY / ANNUAL CONSOLIDATED REPORT
// ══════════════════════════════════════════════════════

exports.getConsolidatedReport = async (startMonth, endMonth) => {
    const startDate = toStartDate(startMonth);
    const endDate = `${endMonth}-01`;

    // Applications filed in period
    const [applications] = await db.execute(`
        SELECT
            LOWER(a.program_type) AS program_type,
            a.status,
            COUNT(*) AS count,
            SUM(CASE WHEN LOWER(COALESCE(b.gender, '')) = 'male' THEN 1 ELSE 0 END) AS male,
            SUM(CASE WHEN LOWER(COALESCE(b.gender, '')) = 'female' THEN 1 ELSE 0 END) AS female
        FROM applications a
        LEFT JOIN beneficiaries b ON b.user_id = a.user_id
        WHERE a.applied_at >= ? AND a.applied_at < DATE_ADD(LAST_DAY(?), INTERVAL 1 DAY)
        GROUP BY program_type, a.status
        ORDER BY program_type, a.status
    `, [startDate, endDate]);

    // Payroll summary for each month in range
    const [payrollMonthly] = await db.execute(`
        SELECT
            pr.payroll_month,
            pr.program_type,
            COUNT(DISTINCT pr.user_id) AS beneficiary_count,
            SUM(pr.days_worked) AS total_days,
            SUM(pr.total_payout) AS total_payout
        FROM payroll_records pr
        WHERE pr.payroll_month >= ? AND pr.payroll_month <= ?
        GROUP BY pr.payroll_month, pr.program_type
        ORDER BY pr.payroll_month, pr.program_type
    `, [startMonth, endMonth]);

    // Aggregate payroll totals
    const payrollTotals = payrollMonthly.reduce((acc, r) => {
        acc.total_payout += parseFloat(r.total_payout || 0);
        acc.total_days += parseInt(r.total_days || 0);
        acc.total_beneficiaries += parseInt(r.beneficiary_count || 0);
        return acc;
    }, { total_payout: 0, total_days: 0, total_beneficiaries: 0 });

    // Disbursement totals in range
    const [disbursements] = await db.execute(`
        SELECT
            d.status,
            COUNT(*) AS batch_count,
            SUM(d.total_amount) AS total_amount,
            SUM(d.recipient_count) AS total_recipients
        FROM disbursements d
        WHERE d.payroll_month >= ? AND d.payroll_month <= ?
        GROUP BY d.status
    `, [startMonth, endMonth]);

    // Attendance summary for range
    const [attendance] = await db.execute(`
        SELECT
            ar.status,
            COUNT(*) AS count
        FROM attendance_records ar
        WHERE ar.attendance_date >= ? AND ar.attendance_date <= LAST_DAY(?)
        GROUP BY ar.status
    `, [startDate, endDate]);

    // Budget utilization — current snapshot
    const [programBudgets] = await db.execute(`
        SELECT
            program_name,
            budget,
            used,
            slots,
            filled,
            status
        FROM programs
        ORDER BY program_name
    `);

    return {
        period: { startMonth, endMonth },
        applications,
        payrollMonthly,
        payrollTotals,
        disbursements,
        attendance,
        programBudgets: programBudgets.map(p => ({
            ...p,
            budget: parseFloat(p.budget || 0),
            used: parseFloat(p.used || 0),
            remaining: parseFloat(p.budget || 0) - parseFloat(p.used || 0),
            utilization_rate: p.budget > 0
                ? Math.round((parseFloat(p.used || 0) / parseFloat(p.budget)) * 10000) / 100
                : 0,
        })),
    };
};
