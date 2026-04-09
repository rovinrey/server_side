const db = require('../../db');

// ── Table bootstrap ──────────────────────────────────
let tablesEnsured = false;

const ensureTables = async () => {
    if (tablesEnsured) return;

    await db.execute(`
        CREATE TABLE IF NOT EXISTS payroll_records (
            payroll_id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            program_type VARCHAR(30) NOT NULL,
            payroll_month VARCHAR(7) NOT NULL,
            days_worked INT NOT NULL DEFAULT 0,
            daily_wage DECIMAL(10,2) NOT NULL DEFAULT 435.00,
            total_payout DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            status ENUM('Pending','Approved','Released') DEFAULT 'Pending',
            approved_by INT NULL,
            approved_at DATETIME NULL,
            remarks VARCHAR(500) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_user_program_month (user_id, program_type, payroll_month),
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS disbursements (
            disbursement_id INT PRIMARY KEY AUTO_INCREMENT,
            batch_code VARCHAR(30) NOT NULL UNIQUE,
            program_type VARCHAR(30) NOT NULL,
            payroll_month VARCHAR(7) NOT NULL,
            total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
            recipient_count INT NOT NULL DEFAULT 0,
            payment_mode ENUM('GCash','Cash','Bank Transfer') NOT NULL DEFAULT 'Cash',
            status ENUM('Scheduled','Processing','Released','Failed') DEFAULT 'Scheduled',
            reference_number VARCHAR(100) NULL,
            scheduled_date DATE NULL,
            released_date DATE NULL,
            released_by INT NULL,
            notes VARCHAR(500) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    tablesEnsured = true;
};

// ── Helpers ──────────────────────────────────────────

const getDailyWage = async () => {
    const [rows] = await db.execute(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'tupad_daily_wage'`
    );
    return rows.length > 0 ? parseFloat(rows[0].setting_value) || 435 : 435;
};

const sanitiseMonth = (monthInput) => {
    const re = /^\d{4}-(0[1-9]|1[0-2])$/;
    return re.test(String(monthInput || ''))
        ? String(monthInput)
        : new Date().toISOString().slice(0, 7);
};

// ── Generate payroll for ALL programs for a given month ─────────

exports.generatePayroll = async (monthInput) => {
    await ensureTables();
    const selectedMonth = sanitiseMonth(monthInput);
    const startDate = `${selectedMonth}-01`;
    const DAILY_WAGE = await getDailyWage();

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
        GROUP BY ar.user_id, a.program_type, full_name
        ORDER BY a.program_type, full_name
        `,
        [startDate, startDate, startDate]
    );

    // Upsert payroll_records
    for (const row of rows) {
        const totalPayout = Number(row.days_worked) * DAILY_WAGE;
        await db.execute(
            `INSERT INTO payroll_records (user_id, program_type, payroll_month, days_worked, daily_wage, total_payout)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                days_worked = VALUES(days_worked),
                daily_wage = VALUES(daily_wage),
                total_payout = VALUES(total_payout),
                updated_at = NOW()`,
            [row.user_id, row.program_type, selectedMonth, row.days_worked, DAILY_WAGE, totalPayout]
        );
    }

    return { generated: rows.length, month: selectedMonth, dailyWage: DAILY_WAGE };
};

// ── Get payroll for a specific month, optionally filtered by program ─

exports.getPayroll = async (monthInput, programType = null) => {
    await ensureTables();
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

    const totals = rows.reduce(
        (acc, r) => {
            acc.days_worked += Number(r.days_worked || 0);
            acc.total_payout += Number(r.total_payout || 0);
            return acc;
        },
        { days_worked: 0, total_payout: 0 }
    );

    // per-program breakdown
    const byProgram = {};
    for (const r of rows) {
        const key = r.program_type || 'unknown';
        if (!byProgram[key]) {
            byProgram[key] = { count: 0, days_worked: 0, total_payout: 0 };
        }
        byProgram[key].count += 1;
        byProgram[key].days_worked += Number(r.days_worked || 0);
        byProgram[key].total_payout += Number(r.total_payout || 0);
    }

    return {
        month: selectedMonth,
        dailyWage: rows.length > 0 ? Number(rows[0].daily_wage) : await getDailyWage(),
        records: rows,
        totals,
        byProgram,
    };
};

// ── Approve payroll for a month ─────────────────────

exports.approvePayroll = async (monthInput, programType, adminUserId) => {
    await ensureTables();
    const selectedMonth = sanitiseMonth(monthInput);

    let query = `
        UPDATE payroll_records
        SET status = 'Approved', approved_by = ?, approved_at = NOW()
        WHERE payroll_month = ? AND status = 'Pending'
    `;
    const params = [adminUserId, selectedMonth];

    if (programType) {
        query += ` AND LOWER(program_type) = LOWER(?)`;
        params.push(programType);
    }

    const [result] = await db.execute(query, params);
    return { updated: result.affectedRows };
};

// ── Mark payroll as released ────────────────────────

exports.releasePayroll = async (monthInput, programType, adminUserId) => {
    await ensureTables();
    const selectedMonth = sanitiseMonth(monthInput);

    let query = `
        UPDATE payroll_records
        SET status = 'Released'
        WHERE payroll_month = ? AND status = 'Approved'
    `;
    const params = [selectedMonth];

    if (programType) {
        query += ` AND LOWER(program_type) = LOWER(?)`;
        params.push(programType);
    }

    const [result] = await db.execute(query, params);
    return { updated: result.affectedRows };
};

// ── Disbursement CRUD ────────────────────────────────

exports.createDisbursement = async (data) => {
    await ensureTables();
    const {
        program_type, payroll_month, total_amount, recipient_count,
        payment_mode, scheduled_date, notes
    } = data;

    // Auto-generate a unique batch code
    const prefix = (payment_mode || 'Cash') === 'GCash' ? 'GC' : (payment_mode === 'Bank Transfer' ? 'BT' : 'CH');
    const year = new Date().getFullYear();
    const rand = Math.floor(Math.random() * 900) + 100;
    const batchCode = `${prefix}-${year}-${rand}`;

    const [result] = await db.execute(
        `INSERT INTO disbursements
            (batch_code, program_type, payroll_month, total_amount, recipient_count, payment_mode, scheduled_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchCode, program_type, payroll_month, total_amount || 0, recipient_count || 0,
         payment_mode || 'Cash', scheduled_date || null, notes || null]
    );

    return { disbursement_id: result.insertId, batch_code: batchCode };
};

exports.getDisbursements = async (monthInput = null) => {
    await ensureTables();
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
    await ensureTables();
    const validStatuses = ['Scheduled', 'Processing', 'Released', 'Failed'];
    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    let query = `UPDATE disbursements SET status = ?`;
    const params = [status];

    if (status === 'Released') {
        query += `, released_date = CURDATE(), released_by = ?`;
        params.push(adminUserId);
    }

    if (referenceNumber) {
        query += `, reference_number = ?`;
        params.push(referenceNumber);
    }

    query += ` WHERE disbursement_id = ?`;
    params.push(disbursementId);

    const [result] = await db.execute(query, params);
    return { updated: result.affectedRows };
};

// ── Analytics ────────────────────────────────────────

exports.getPayrollAnalytics = async (monthInput = null) => {
    await ensureTables();

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
    await ensureTables();

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

    const totals = rows.reduce(
        (acc, r) => {
            acc.total_payout += Number(r.total_payout || 0);
            acc.total_days += Number(r.days_worked || 0);
            return acc;
        },
        { total_payout: 0, total_days: 0 }
    );

    return { records: rows, totals };
};
