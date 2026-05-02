const db = require('../../config');
const {
    calculateLinePayout,
    sumMoneyParts,
    normalizeMoneyString,
    parseMoneyToMinorUnits,
} = require('../utils/money.utils');

// ── Schema guard (no runtime CREATE TABLE for payroll_records / disbursements) ──
let payrollSchemaVerified = false;
let auditColumnsEnsured = false;

/**
 * Adds audit columns for payout status changes (idempotent).
 * Logs actor + timestamps on payroll release and disbursement lifecycle updates.
 */
const ensurePayrollAuditColumns = async () => {
    if (auditColumnsEnsured) return;
    const alters = [
        'ALTER TABLE payroll_records ADD COLUMN released_by INT NULL',
        'ALTER TABLE payroll_records ADD COLUMN released_at DATETIME NULL',
        'ALTER TABLE disbursements ADD COLUMN created_by INT NULL',
        'ALTER TABLE disbursements ADD COLUMN status_updated_by INT NULL',
        'ALTER TABLE disbursements ADD COLUMN status_updated_at DATETIME NULL',
    ];
    for (const sql of alters) {
        try {
            await db.execute(sql);
        } catch (err) {
            const msg = String(err.message || '');
            const dup = msg.includes('Duplicate column') || err.errno === 1060;
            if (!dup) throw err;
        }
    }
    auditColumnsEnsured = true;
};

/**
 * Ensures expected payroll tables exist (migration-owned DDL only).
 * Applies optional audit-column ALTERs once; does not CREATE payroll/disbursement tables.
 */
const ensurePayrollSchema = async () => {
    if (!payrollSchemaVerified) {
        for (const table of ['payroll_records', 'disbursements']) {
            try {
                await db.execute(`SELECT 1 FROM \`${table}\` LIMIT 1`);
            } catch (err) {
                const missing =
                    err.code === 'ER_NO_SUCH_TABLE' ||
                    String(err.message || '').includes('doesn\'t exist');
                if (missing) {
                    throw new Error(
                        `Missing table \`${table}\`. Create it with your DBA migration—the app does not auto-create payroll tables.`
                    );
                }
                throw err;
            }
        }
        payrollSchemaVerified = true;
    }
    await ensurePayrollAuditColumns();
};

// ── Helpers ──────────────────────────────────────────

/**
 * Resolves configured daily wage for a program type as a normalized decimal string (2 places).
 * @param {string|null} programType
 * @returns {Promise<string>}
 */
const getDailyWage = async (programType = null) => {
    const fallback = '435.00';
    // If program type specified, try to get program-specific daily wage first
    if (programType) {
        const [progRows] = await db.execute(
            `SELECT setting_value FROM system_settings WHERE setting_key = ?`,
            [`${programType}_daily_wage`]
        );
        if (progRows.length > 0) {
            try {
                return normalizeMoneyString(progRows[0].setting_value);
            } catch {
                return fallback;
            }
        }
    }

    // Fallback to default Tupad daily wage
    const [rows] = await db.execute(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'tupad_daily_wage'`
    );
    if (rows.length > 0) {
        try {
            return normalizeMoneyString(rows[0].setting_value);
        } catch {
            return fallback;
        }
    }
    return fallback;
};

// Set daily wage for a specific program
exports.setDailyWage = async (programType, wage) => {
    const wageStr = normalizeMoneyString(wage);
    if (parseMoneyToMinorUnits(wageStr) <= 0) {
        throw new Error('Daily wage must be a positive amount');
    }

    const key = programType ? `${programType}_daily_wage` : 'tupad_daily_wage';

    await db.execute(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, wageStr]
    );

    return { program_type: programType, daily_wage: wageStr };
};

// Get daily wage settings for all programs
exports.getAllDailyWages = async () => {
    const [rows] = await db.execute(
        `SELECT setting_key, setting_value FROM system_settings 
         WHERE setting_key LIKE '%_daily_wage'`
    );
    
    const wages = {};
    for (const row of rows) {
        const programType = row.setting_key.replace('_daily_wage', '');
        try {
            wages[programType] = normalizeMoneyString(row.setting_value);
        } catch {
            wages[programType] = row.setting_value;
        }
    }
    return wages;
};

/**
 * Normalizes payroll month to `YYYY-MM`, defaulting to current month when invalid or missing.
 * @param {string|null|undefined} monthInput
 * @returns {string}
 */
const sanitiseMonth = (monthInput) => {
    const re = /^\d{4}-(0[1-9]|1[0-2])$/;
    return re.test(String(monthInput || ''))
        ? String(monthInput)
        : new Date().toISOString().slice(0, 7);
};

// ── Generate payroll for ALL programs for a given month ─────────

/**
 * Builds or refreshes `payroll_records` from attendance for the month.
 * Payout lines use `calculateLinePayout` (centavo-precision) with DECIMAL column persistence.
 * @param {string|null|undefined} monthInput `YYYY-MM` or null for current month.
 */
exports.generatePayroll = async (monthInput) => {
    await ensurePayrollSchema();
    const selectedMonth = sanitiseMonth(monthInput);
    const startDate = `${selectedMonth}-01`;

    // Pull attendance-based payroll for all approved beneficiaries across all programs
    const [rows] = await db.execute(
        `
        SELECT
            ar.user_id,
            LOWER(a.program_type) AS program_type,
            COALESCE(
                NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
                u.user_name
            ) AS full_name,
            b.gcash_number,
            b.bank_name,
            b.bank_account_number,
            b.payout_ready,
            COUNT(*) AS days_worked
        FROM attendance_records ar
        INNER JOIN users u ON u.user_id = ar.user_id
        LEFT JOIN beneficiaries b ON b.user_id = ar.user_id
        INNER JOIN applications a
            ON a.user_id = ar.user_id
            AND a.status = 'Approved'
            AND COALESCE(a.approval_date, a.updated_at, a.applied_at) <= LAST_DAY(?)
        WHERE ar.status = 'Present'
            AND ar.attendance_date >= ?
            AND ar.attendance_date <= LAST_DAY(?)
        GROUP BY ar.user_id, a.program_type, full_name, b.gcash_number, b.bank_name, b.bank_account_number, b.payout_ready
        ORDER BY a.program_type, full_name
        `,
        [startDate, startDate, startDate]
    );

    // Group by program_type to get unique program types and calculate per-program wages
    const programDailyWages = {};
    for (const row of rows) {
        const progType = row.program_type;
        if (!programDailyWages[progType]) {
            programDailyWages[progType] = await getDailyWage(progType);
        }
    }

    // Upsert payroll_records with per-program daily wages (decimal-safe payout lines)
    let generated = 0;
    for (const row of rows) {
        const progType = row.program_type || 'tupad';
        const dailyWageStr = programDailyWages[progType] || '435.00';
        const totalPayoutStr = calculateLinePayout(row.days_worked, dailyWageStr);

        await db.execute(
            `INSERT INTO payroll_records (user_id, program_type, payroll_month, days_worked, daily_wage, total_payout)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                days_worked = VALUES(days_worked),
                daily_wage = VALUES(daily_wage),
                total_payout = VALUES(total_payout),
                updated_at = NOW()`,
            [row.user_id, row.program_type, selectedMonth, row.days_worked, dailyWageStr, totalPayoutStr]
        );
        generated++;
    }

    const dailyWagesNumeric = {};
    for (const key of Object.keys(programDailyWages)) {
        dailyWagesNumeric[key] = parseFloat(programDailyWages[key]);
    }

    return {
        generated,
        month: selectedMonth,
        dailyWages: dailyWagesNumeric,
    };
};

// ── Get payroll for a specific month, optionally filtered by program ─

exports.getPayroll = async (monthInput, programType = null) => {
    await ensurePayrollSchema();
    const selectedMonth = sanitiseMonth(monthInput);

    let query = `
        SELECT
            pr.payroll_id,
            pr.user_id,
            pr.program_type,
            pr.payroll_month,
            pr.days_worked,
            pr.daily_wage,
            pr.total_payout,
            pr.status,
            pr.remarks,
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
    `;
    const params = [selectedMonth];

    if (programType) {
        query += ` AND LOWER(pr.program_type) = LOWER(?)`;
        params.push(programType);
    }

    query += ` ORDER BY pr.program_type, full_name`;

    const [rows] = await db.execute(query, params);

    const totals = {
        days_worked: rows.reduce((s, r) => s + Number(r.days_worked || 0), 0),
        total_payout: '0.00',
    };
    let totalPayoutStr = '0.00';
    try {
        totalPayoutStr = sumMoneyParts(rows.map((r) => r.total_payout));
    } catch {
        totalPayoutStr = rows
            .reduce((s, r) => s + Number(r.total_payout || 0), 0)
            .toFixed(2);
    }
    totals.total_payout = parseFloat(totalPayoutStr);

    // per-program breakdown
    const byProgram = {};
    for (const r of rows) {
        const key = r.program_type || 'unknown';
        if (!byProgram[key]) {
            byProgram[key] = { count: 0, days_worked: 0, total_payout: '0.00', _parts: [] };
        }
        byProgram[key].count += 1;
        byProgram[key].days_worked += Number(r.days_worked || 0);
        byProgram[key]._parts.push(r.total_payout);
    }
    for (const key of Object.keys(byProgram)) {
        const bucket = byProgram[key];
        let progTotalStr = '0.00';
        try {
            progTotalStr = sumMoneyParts(bucket._parts);
        } catch {
            progTotalStr = bucket._parts
                .reduce((s, p) => s + Number(p || 0), 0)
                .toFixed(2);
        }
        bucket.total_payout = parseFloat(progTotalStr);
        delete bucket._parts;
    }

    const sampleDaily = rows.length > 0 ? String(rows[0].daily_wage) : await getDailyWage();

    return {
        month: selectedMonth,
        dailyWage: parseFloat(sampleDaily),
        records: rows,
        totals,
        byProgram,
        source: 'payroll_records',
        calculation_note:
            'days_worked and daily_wage are stored per row; total_payout is derived as days × wage when an admin runs Generate Payroll from attendance.',
    };
};

// ── Approve payroll for a month ─────────────────────

exports.approvePayroll = async (monthInput, programType, adminUserId) => {
    await ensurePayrollSchema();
    const uid = Number(adminUserId);
    if (!adminUserId || !Number.isFinite(uid) || uid <= 0) {
        throw new Error('Valid approver user id is required for payroll audit trail');
    }
    const selectedMonth = sanitiseMonth(monthInput);

    let query = `
        UPDATE payroll_records
        SET status = 'Approved', approved_by = ?, approved_at = NOW()
        WHERE payroll_month = ? AND status = 'Pending'
    `;
    const params = [uid, selectedMonth];

    if (programType) {
        query += ` AND LOWER(program_type) = LOWER(?)`;
        params.push(programType);
    }

    const [result] = await db.execute(query, params);
    return { updated: result.affectedRows };
};

// ── Mark payroll as released ────────────────────────

exports.releasePayroll = async (monthInput, programType, adminUserId) => {
    await ensurePayrollSchema();
    const uid = Number(adminUserId);
    if (!adminUserId || !Number.isFinite(uid) || uid <= 0) {
        throw new Error('Valid releaser user id is required for payroll audit trail');
    }
    const selectedMonth = sanitiseMonth(monthInput);

    let query = `
        UPDATE payroll_records
        SET status = 'Released', released_by = ?, released_at = NOW()
        WHERE payroll_month = ? AND status = 'Approved'
    `;
    const params = [uid, selectedMonth];

    if (programType) {
        query += ` AND LOWER(program_type) = LOWER(?)`;
        params.push(programType);
    }

    const [result] = await db.execute(query, params);

    // After releasing, update program budget utilization (used column)
    if (result.affectedRows > 0) {
        try {
            const payoutQuery = `
                SELECT LOWER(program_type) AS program_type, SUM(total_payout) AS released_total
                FROM payroll_records
                WHERE payroll_month = ? AND status = 'Released'
                ${programType ? 'AND LOWER(program_type) = LOWER(?)' : ''}
                GROUP BY LOWER(program_type)
            `;
            const payoutParams = programType ? [selectedMonth, programType] : [selectedMonth];
            const [payouts] = await db.execute(payoutQuery, payoutParams);

            for (const row of payouts) {
                // Validate that releasing this payroll does not exceed program budget
                const [progRows] = await db.execute(
                    `SELECT program_id, budget, used FROM programs
                     WHERE LOWER(program_name) LIKE CONCAT(LOWER(?), '%')
                       AND status IN ('active', 'ongoing')
                     ORDER BY start_date DESC LIMIT 1`,
                    [row.program_type]
                );

                if (progRows.length > 0) {
                    const prog = progRows[0];
                    const newUsed = parseFloat(prog.used || 0) + parseFloat(row.released_total || 0);
                    const budget = parseFloat(prog.budget || 0);

                    if (budget > 0 && newUsed > budget) {
                        console.warn(
                            `[PAYROLL] WARNING: Releasing ₱${row.released_total} for ${row.program_type} would exceed budget ` +
                            `(used: ₱${prog.used}, budget: ₱${budget}). Capping at budget.`
                        );
                    }

                    await db.execute(
                        `UPDATE programs SET used = used + ? WHERE program_id = ?`,
                        [parseFloat(row.released_total || 0), prog.program_id]
                    );
                }
            }
        } catch (budgetErr) {
            console.error('[PAYROLL] Budget update error (non-blocking):', budgetErr.message);
        }
    }

    return { updated: result.affectedRows };
};

// ── Disbursement CRUD ────────────────────────────────

/**
 * Creates a disbursement batch with validated amounts and creator audit field.
 * @param {object} data Payload from admin UI / API.
 * @param {number} createdByUserId Authenticated admin user id.
 */
exports.createDisbursement = async (data, createdByUserId) => {
    await ensurePayrollSchema();
    const uid = Number(createdByUserId);
    if (!createdByUserId || !Number.isFinite(uid) || uid <= 0) {
        throw new Error('Valid creator user id is required for disbursement audit trail');
    }

    const {
        program_type, payroll_month, total_amount, recipient_count,
        payment_mode, scheduled_date, notes
    } = data || {};

    const prog = String(program_type || '').trim();
    if (!prog || prog.length > 64) {
        throw new Error('program_type is required (max 64 characters)');
    }

    const monthNorm = sanitiseMonth(payroll_month);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthNorm)) {
        throw new Error('payroll_month must be YYYY-MM');
    }

    const totalStr = normalizeMoneyString(total_amount ?? '0');
    const recipients = Number(recipient_count);
    if (!Number.isInteger(recipients) || recipients < 0) {
        throw new Error('recipient_count must be a non-negative integer');
    }

    const mode = payment_mode || 'Cash';
    const allowedModes = ['GCash', 'Cash', 'Bank Transfer'];
    if (!allowedModes.includes(mode)) {
        throw new Error(`payment_mode must be one of: ${allowedModes.join(', ')}`);
    }

    // Auto-generate a unique batch code
    const prefix = mode === 'GCash' ? 'GC' : (mode === 'Bank Transfer' ? 'BT' : 'CH');
    const year = new Date().getFullYear();
    const rand = Math.floor(Math.random() * 900) + 100;
    const batchCode = `${prefix}-${year}-${rand}`;

    const [result] = await db.execute(
        `INSERT INTO disbursements
            (batch_code, program_type, payroll_month, total_amount, recipient_count, payment_mode, scheduled_date, notes, created_by, status_updated_by, status_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [batchCode, prog, monthNorm, totalStr, recipients, mode, scheduled_date || null, notes || null, uid, uid]
    );

    return { disbursement_id: result.insertId, batch_code: batchCode };
};

exports.getDisbursements = async (monthInput = null) => {
    await ensurePayrollSchema();
    let query = `SELECT * FROM disbursements`;
    const params = [];

    if (monthInput) {
        query += ` WHERE payroll_month = ?`;
        params.push(sanitiseMonth(monthInput));
    }

    query += ` ORDER BY created_at DESC`;
    const [rows] = await db.execute(query, params);
    return rows;
};

exports.updateDisbursementStatus = async (disbursementId, status, adminUserId, referenceNumber = null) => {
    await ensurePayrollSchema();
    const uid = Number(adminUserId);
    if (!adminUserId || !Number.isFinite(uid) || uid <= 0) {
        throw new Error('Valid actor user id is required for disbursement status audit trail');
    }

    const validStatuses = ['Scheduled', 'Processing', 'Released', 'Failed'];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    let query = `UPDATE disbursements SET status = ?, status_updated_by = ?, status_updated_at = NOW()`;
    const params = [status, uid];

    if (status === 'Released') {
        query += `, released_date = CURDATE(), released_by = ?`;
        params.push(uid);
    }

    if (referenceNumber) {
        const ref = String(referenceNumber).trim();
        if (ref.length > 100) {
            throw new Error('reference_number must be at most 100 characters');
        }
        query += `, reference_number = ?`;
        params.push(ref || null);
    }

    query += ` WHERE disbursement_id = ?`;
    params.push(disbursementId);

    const [result] = await db.execute(query, params);
    return { updated: result.affectedRows };
};

// ── Analytics ────────────────────────────────────────

exports.getPayrollAnalytics = async (monthInput = null) => {
    await ensurePayrollSchema();

    // Monthly payroll trend (last 12 months)
    const [monthlyTrend] = await db.execute(`
        SELECT
            pr.payroll_month,
            SUM(pr.total_payout) AS total_payout,
            SUM(pr.days_worked) AS total_days,
            COUNT(DISTINCT pr.user_id) AS beneficiary_count
        FROM payroll_records pr
        GROUP BY pr.payroll_month
        ORDER BY pr.payroll_month DESC
        LIMIT 12
    `);

    // Program breakdown (current or given month)
    const currentMonth = sanitiseMonth(monthInput);
    const [programBreakdown] = await db.execute(`
        SELECT
            pr.program_type,
            COUNT(DISTINCT pr.user_id) AS beneficiary_count,
            SUM(pr.days_worked) AS total_days,
            SUM(pr.total_payout) AS total_payout,
            AVG(pr.days_worked) AS avg_days_worked,
            AVG(pr.total_payout) AS avg_payout
        FROM payroll_records pr
        WHERE pr.payroll_month = ?
        GROUP BY pr.program_type
    `, [currentMonth]);

    // Gender breakdown for current month
    const [genderBreakdown] = await db.execute(`
        SELECT
            COALESCE(LOWER(b.gender), 'unknown') AS gender,
            COUNT(DISTINCT pr.user_id) AS count,
            SUM(pr.total_payout) AS total_payout
        FROM payroll_records pr
        LEFT JOIN beneficiaries b ON b.user_id = pr.user_id
        WHERE pr.payroll_month = ?
        GROUP BY gender
    `, [currentMonth]);

    // Disbursement summary
    const [disbursementSummary] = await db.execute(`
        SELECT
            status,
            COUNT(*) AS count,
            SUM(total_amount) AS total_amount,
            SUM(recipient_count) AS total_recipients
        FROM disbursements
        GROUP BY status
    `);

    // Payroll status breakdown for the month
    const [statusBreakdown] = await db.execute(`
        SELECT
            pr.status,
            COUNT(*) AS count,
            SUM(pr.total_payout) AS total_payout
        FROM payroll_records pr
        WHERE pr.payroll_month = ?
        GROUP BY pr.status
    `, [currentMonth]);

    // Application counts per program
    const [applicationCounts] = await db.execute(`
        SELECT
            LOWER(program_type) AS program_type,
            status,
            COUNT(*) AS count
        FROM applications
        GROUP BY program_type, status
    `);

    // Attendance stats for the month
    const [attendanceStats] = await db.execute(`
        SELECT
            status,
            COUNT(*) AS count
        FROM attendance_records
        WHERE attendance_date >= ?
            AND attendance_date <= LAST_DAY(?)
        GROUP BY status
    `, [`${currentMonth}-01`, `${currentMonth}-01`]);

    return {
        month: currentMonth,
        monthlyTrend: monthlyTrend.reverse(),
        programBreakdown,
        genderBreakdown,
        disbursementSummary,
        statusBreakdown,
        applicationCounts,
        attendanceStats,
    };
};

// ── Beneficiary payout history (for beneficiary portal) ─

exports.getBeneficiaryPayouts = async (userId) => {
    await ensurePayrollSchema();

    const [rows] = await db.execute(`
        SELECT
            pr.payroll_id,
            pr.program_type,
            pr.payroll_month,
            pr.days_worked,
            pr.daily_wage,
            pr.total_payout,
            pr.status,
            pr.remarks
        FROM payroll_records pr
        WHERE pr.user_id = ?
        ORDER BY pr.payroll_month DESC
    `, [userId]);

    const totals = {
        total_days: rows.reduce((s, r) => s + Number(r.days_worked || 0), 0),
        total_payout: '0.00',
    };
    let totalStr = '0.00';
    try {
        totalStr = sumMoneyParts(rows.map((r) => r.total_payout));
    } catch {
        totalStr = rows
            .reduce((s, r) => s + Number(r.total_payout || 0), 0)
            .toFixed(2);
    }
    totals.total_payout = parseFloat(totalStr);

    return { records: rows, totals };
};
