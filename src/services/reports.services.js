const db = require('../../db');

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
            a.applied_at,
            a.approval_date,
            b.first_name,
            b.middle_name,
            b.last_name,
            b.extension_name,
            b.birth_date,
            TIMESTAMPDIFF(YEAR, b.birth_date, CURDATE()) AS age,
            b.gender,
            b.civil_status,
            b.contact_number,
            b.address,
            b.is_active
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

    query += ` ORDER BY a.program_type, b.last_name, b.first_name`;

    const [rows] = await db.execute(query, params);

    // Demographics summary
    const demographics = {
        total: rows.length,
        male: rows.filter(r => r.gender && r.gender.toLowerCase() === 'male').length,
        female: rows.filter(r => r.gender && r.gender.toLowerCase() === 'female').length,
        byProgram: {},
        byAge: { '15-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-59': 0, '60+': 0 },
        byCivilStatus: {},
    };

    rows.forEach(r => {
        // By program
        const pt = r.program_type || 'unknown';
        if (!demographics.byProgram[pt]) demographics.byProgram[pt] = { total: 0, male: 0, female: 0 };
        demographics.byProgram[pt].total++;
        if (r.gender && r.gender.toLowerCase() === 'male') demographics.byProgram[pt].male++;
        if (r.gender && r.gender.toLowerCase() === 'female') demographics.byProgram[pt].female++;

        // By age bracket
        const age = r.age;
        if (age !== null && age !== undefined) {
            if (age < 18) demographics.byAge['15-17']++;
            else if (age <= 24) demographics.byAge['18-24']++;
            else if (age <= 34) demographics.byAge['25-34']++;
            else if (age <= 44) demographics.byAge['35-44']++;
            else if (age <= 59) demographics.byAge['45-59']++;
            else demographics.byAge['60+']++;
        }

        // By civil status
        const cs = (r.civil_status || 'Unknown').trim();
        demographics.byCivilStatus[cs] = (demographics.byCivilStatus[cs] || 0) + 1;
    });

    return { beneficiaries: rows, demographics };
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
