import { execute, getConnection, query as _query } from "../../config.js";

export async function getAllBeneficiaries() {
  const query = `
    SELECT
      a.application_id AS id,
      a.application_id,
      a.user_id,
      b.beneficiary_id,
      b.first_name,
      b.middle_name,
      b.last_name,
      CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name) AS full_name,
      COALESCE(b.contact_number, u.phone) AS contact_number,
      COALESCE(b.address, sd.present_address, NULL) AS address,
      a.program_type,
      NULL AS program_id,
      NULL AS program_name,
      'Approved' AS status,
      a.approval_date,
      a.applied_at
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN users u ON u.user_id = a.user_id
    LEFT JOIN spes_details sd ON sd.application_id = a.application_id
    WHERE a.status = 'Approved'
    ORDER BY COALESCE(a.approval_date, a.updated_at, a.applied_at) DESC
  `;

  const [rows] = await execute(query);
  return [rows];
}

export async function getApprovedCount() {
  const query = `
    SELECT COUNT(*) AS count
    FROM applications
    WHERE status = 'Approved'
  `;

  const [rows] = await execute(query);
  return Number(rows[0]?.count || 0);
}

export async function getBeneficiaryApplicationDetails(applicationId) {
  const baseQuery = `
    SELECT
      a.application_id,
      a.user_id,
      a.program_type,
      a.status,
      a.rejection_reason,
      a.applied_at,
      a.approval_date,
      a.updated_at,
      u.email,
      u.phone,
      b.beneficiary_id,
      b.first_name,
      b.middle_name,
      b.last_name,
      b.birth_date,
      b.gender,
      b.contact_number,
      b.address
    FROM applications a
    LEFT JOIN users u ON u.user_id = a.user_id
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    WHERE a.application_id = ?
    LIMIT 1
  `;

  const [baseRows] = await execute(baseQuery, [applicationId]);
  if (!baseRows.length) {
    return null;
  }

  const application = baseRows[0];

  const details = {
    tupad: null,
    spes: null,
    dilp: null,
    gip: null,
    jobseeker: null
  };

  if (application.program_type === 'tupad') {
    const [tupadRows] = await execute(
      'SELECT * FROM tupad_details WHERE application_id = ? LIMIT 1',
      [applicationId]
    );
    details.tupad = tupadRows[0] || null;
  }

  if (application.program_type === 'spes') {
    const [spesRows] = await execute(
      'SELECT * FROM spes_details WHERE application_id = ? LIMIT 1',
      [applicationId]
    );
    details.spes = spesRows[0] || null;
  }

  return {
    application,
    details
  };
}

// Get all applications across programs (for admin dashboard)
export async function getAllApplications() {
  const query = `
    SELECT
      a.application_id AS id,
      a.application_id,
      a.user_id,
      a.program_type,
      b.first_name,
      b.middle_name,
      b.last_name,
      COALESCE(b.contact_number, u.phone) AS contact_number,
      COALESCE(b.address, sd.present_address, NULL) AS address,
      a.status,
      a.rejection_reason,
      a.applied_at
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN spes_details sd ON sd.application_id = a.application_id
    LEFT JOIN users u ON a.user_id = u.user_id
    ORDER BY a.applied_at DESC
    LIMIT 200
  `;
  const [rows] = await execute(query);
  return [rows];
}

export async function getRecentApplications(limit = 10, userId = null) {
  const params = [];
  let whereClause = "WHERE a.status = 'Pending'";
  if (userId) {
    whereClause += ' AND a.user_id = ?';
    params.push(userId);
  }

  const query = `
    SELECT
      a.application_id AS id,
      a.application_id,
      a.user_id,
      b.first_name,
      b.middle_name,
      b.last_name,
      a.program_type,
      COALESCE(b.contact_number, u.phone) AS contact_number,
      COALESCE(b.address, sd.present_address, NULL) AS address,
      a.status,
      a.applied_at
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN spes_details sd ON sd.application_id = a.application_id
    LEFT JOIN users u ON a.user_id = u.user_id
    ${whereClause}
    ORDER BY a.applied_at DESC
    LIMIT ?
  `;
  params.push(limit);

  const [rows] = await execute(query, params);
  return [rows];
}

// get all pending applications (for admin approval queue)
export async function getPendingApplications(programType = null) {
  const params = [];
  let whereClause = "WHERE a.status = 'Pending'";

  if (programType) {
    whereClause += ' AND a.program_type = ?';
    params.push(programType);
  }

  const query = `
    SELECT
      a.application_id AS id,
      a.application_id,
      a.user_id,
      b.first_name,
      b.middle_name,
      b.last_name,
      a.program_type,
      COALESCE(b.contact_number, u.phone) AS contact_number,
      COALESCE(b.address, sd.present_address, NULL) AS address,
      a.status,
      a.applied_at
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN spes_details sd ON sd.application_id = a.application_id
    LEFT JOIN users u ON a.user_id = u.user_id
    ${whereClause}
    ORDER BY a.applied_at DESC
  `;
  const [rows] = await execute(query, params);
  return [rows];
}

// get applications by status (for admin/staff management view).
// For Approved: by default excludes rows already actively enrolled (enrollment queue).
// Admins can pass includeEnrolledApproved to list every approved application.
export async function getApplicationsByStatus(status, programType = null, options = {}) {
  const { includeEnrolledApproved = false } = options;
  const params = [status];
  let whereConditions = ['a.status = ?'];

  if (programType) {
    whereConditions.push('a.program_type = ?');
    params.push(programType);
  }

  if (status === 'Approved' && !includeEnrolledApproved) {
    whereConditions.push(`
      NOT EXISTS (
        SELECT 1 FROM program_enrollees pe 
        WHERE pe.application_id = a.application_id 
        AND pe.current_status = 'Active'
      )
    `);
  }

  const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

  const query = `
    SELECT
      a.application_id AS id,
      a.application_id,
      a.user_id,
      b.first_name,
      b.middle_name,
      b.last_name,
      a.program_type,
      COALESCE(b.contact_number, u.phone) AS contact_number,
      COALESCE(b.address, sd.present_address, NULL) AS address,
      a.status,
      a.rejection_reason,
      a.applied_at,
      CASE WHEN EXISTS (
        SELECT 1 FROM program_enrollees pe
        WHERE pe.application_id = a.application_id
          AND pe.current_status = 'Active'
      ) THEN 1 ELSE 0 END AS is_enrolled
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN spes_details sd ON sd.application_id = a.application_id
    LEFT JOIN users u ON a.user_id = u.user_id
    ${whereClause}
    ORDER BY a.applied_at DESC
  `;
  const [rows] = await execute(query, params);
  return [rows];
}

// approve application of the benficiary
export async function approveApplication(id) {
  const applicationId = parseInt(id, 10);
  if (Number.isNaN(applicationId) || applicationId < 1) {
    throw new Error('Invalid application ID');
  }

  const connection = await getConnection();
  let userId;
  let programType;

  try {
    await connection.beginTransaction();

    // 1. Fetch the application to get user_id and program_type
    const [appRows] = await connection.execute(
      `SELECT application_id, user_id, program_type, status
       FROM applications WHERE application_id = ?`,
      [applicationId]
    );
    if (!appRows.length) {
      throw new Error('Application not found');
    }
    const application = appRows[0];
    const statusNorm = String(application.status || '').trim().toLowerCase();
    if (statusNorm === 'approved') {
      throw new Error('Application is already approved');
    }

    // 2. Update application status to Approved (tolerate DB without approval_date)
    let header;
    try {
      const [h] = await connection.execute(
        `UPDATE applications
         SET status = 'Approved',
             approval_date = NOW(),
             rejection_reason = NULL
         WHERE application_id = ?`,
        [applicationId]
      );
      header = h;
    } catch (updErr) {
      const msg = String(updErr.sqlMessage || updErr.message || '');
      if (updErr.errno === 1054 && msg.includes('approval_date')) {
        const [h] = await connection.execute(
          `UPDATE applications
           SET status = 'Approved',
               rejection_reason = NULL
           WHERE application_id = ?`,
          [applicationId]
        );
        header = h;
      } else {
        throw updErr;
      }
    }
    if (!header || header.affectedRows < 1) {
      throw new Error('Application could not be updated');
    }

    // 3. Ensure the beneficiary record is active (must not fail the whole approval)
    try {
      const [benefRows] = await connection.execute(
        `SELECT beneficiary_id FROM beneficiaries WHERE user_id = ?`,
        [application.user_id]
      );
      if (benefRows.length) {
        await connection.execute(
          `UPDATE beneficiaries SET is_active = 1 WHERE user_id = ?`,
          [application.user_id]
        );
      }
    } catch (benErr) {
      console.warn(
        'approveApplication: beneficiary activation skipped:',
        benErr.sqlMessage || benErr.message
      );
    }

    userId = application.user_id;
    programType = application.program_type;

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  // Outside transaction: notification failures must not undo approval
  const programLabel = (programType || '').toUpperCase().replace('_', ' ');
  try {
    await execute(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        'Application Approved',
        `Your ${programLabel} application has been approved. PESO staff will assign you to a program batch—watch for further updates.`,
        'general',
      ]
    );
  } catch (notifErr) {
    console.error('Approval notification insert failed:', notifErr.message);
  }

  return { applicationId, userId, programType };
}

// reject application of the benficiary
export async function rejectApplication(id, reason) {
  const applicationId = parseInt(id, 10);
  if (Number.isNaN(applicationId) || applicationId < 1) {
    throw new Error('Invalid application ID');
  }

  const connection = await getConnection();
  let userId;
  let programType;
  let programLabel;
  let notifMessage;

  try {
    await connection.beginTransaction();

    // 1. Fetch the application (omit program_id — not present on all schemas)
    const [appRows] = await connection.execute(
      `SELECT application_id, user_id, program_type, status
       FROM applications WHERE application_id = ?`,
      [applicationId]
    );
    if (!appRows.length) {
      throw new Error('Application not found');
    }
    const application = appRows[0];

    // 2. If previously approved, decrement filled count (best-effort match by program type)
    if (application.status === 'Approved') {
      await connection.execute(
        `UPDATE programs
         SET filled = GREATEST(filled - 1, 0)
         WHERE LOWER(program_name) LIKE CONCAT(LOWER(?), '%')
           AND status IN ('active', 'ongoing')
         ORDER BY start_date DESC
         LIMIT 1`,
        [application.program_type]
      );
    }

    // 3. Update application status to Rejected
    await connection.execute(
      `UPDATE applications
       SET status = 'Rejected',
           rejection_reason = ?,
           approval_date = NULL
       WHERE application_id = ?`,
      [reason || null, applicationId]
    );

    userId = application.user_id;
    programType = application.program_type;
    programLabel = (programType || '').toUpperCase().replace('_', ' ');
    notifMessage = reason
      ? `Your ${programLabel} application has been rejected. Reason: ${reason}`
      : `Your ${programLabel} application has been rejected. Please contact the office for more details.`;

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  try {
    await execute(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, ?)`,
      [userId, 'Application Rejected', notifMessage, 'general']
    );
  } catch (notifErr) {
    console.error('Rejection notification insert failed:', notifErr.message);
  }

  return { applicationId, userId, programType };
}

// get the latest application status for each program of a beneficiary
export async function getUserApplicationStatus(userId) {
  const query = `
    SELECT
      a.application_id,
      a.program_type,
      NULL AS program_id,
      NULL AS program_name,
      a.status,
      a.rejection_reason,
      a.applied_at,
      a.updated_at
    FROM applications a
    WHERE a.user_id = ?
    ORDER BY a.applied_at DESC
  `;

  const [rows] = await execute(query, [userId]);

  const supportedPrograms = ['tupad', 'spes', 'dilp', 'gip', 'job_seekers'];
  const summary = supportedPrograms.reduce((acc, program) => {
    acc[program] = null;
    return acc;
  }, {});

  // Keep latest status per program based on descending applied_at.
  for (const row of rows) {
    if (summary[row.program_type] === null) {
      summary[row.program_type] = row.status;
    }
  }

  return {
    summary,
    submissions: rows
  };
}

// expoert applications for admin management view
export async function getApplicationsForExport(programType = null, status = null) {
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (programType) {
    conditions.push('a.program_type = ?');
    params.push(programType);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      a.application_id AS id,
      a.user_id,
      a.program_type,
      b.first_name,
      b.middle_name,
      b.last_name,
      COALESCE(b.contact_number, u.phone) AS contact_number,
      COALESCE(b.address, sd.present_address, NULL) AS address,
      a.status,
      a.rejection_reason,
      a.applied_at,
      a.approval_date
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN spes_details sd ON sd.application_id = a.application_id
    LEFT JOIN users u ON a.user_id = u.user_id
    ${whereClause}
    ORDER BY a.applied_at DESC
  `;

  const [rows] = await execute(query, params);
  return rows;
}

// =============================================
// Daily Wage Settings
// =============================================
export async function getDailyWage() {
  await execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await execute(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'tupad_daily_wage'`
  );
  return rows.length > 0 ? parseFloat(rows[0].setting_value) || 435 : 435;
}

export async function updateDailyWage(newWage) {
  const wage = parseFloat(newWage);
  if (isNaN(wage) || wage <= 0) {
    throw new Error('Daily wage must be a positive number');
  }
  await execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await execute(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES ('tupad_daily_wage', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [String(wage)]
  );
  return wage;
}

export async function getTupadMonthlyReport(monthInput) {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  const selectedMonth = monthRegex.test(String(monthInput || '')) 
    ? String(monthInput)
    : new Date().toISOString().slice(0, 7);

  const startDate = `${selectedMonth}-01`;
  const [year, month] = selectedMonth.split('-').map(Number);
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
  const endDateExpr = 'LAST_DAY(?)';

  // Read daily wage from system_settings (fallback to 435)
  await execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const [wageRows] = await execute(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'tupad_daily_wage'`
  );
  const DAILY_WAGE = wageRows.length > 0 ? parseFloat(wageRows[0].setting_value) || 435 : 435;

  await execute(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      attendance_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      program_type VARCHAR(30) NULL,
      attendance_date DATE NOT NULL,
      time_in DATETIME NULL,
      time_out DATETIME NULL,
      status ENUM('Present', 'Incomplete') DEFAULT 'Incomplete',
      remarks VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_day (user_id, attendance_date),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  const [applicantGenderRows] = await execute(
    `
      SELECT
        SUM(
          CASE
            WHEN LOWER(COALESCE(b.gender, '')) = 'male' THEN 1
            ELSE 0
          END
        ) AS male,
        SUM(
          CASE
            WHEN LOWER(COALESCE(b.gender, '')) = 'female' THEN 1
            ELSE 0
          END
        ) AS female,
        COUNT(*) AS total
      FROM applications a
      LEFT JOIN beneficiaries b ON b.user_id = a.user_id
      WHERE LOWER(a.program_type) = 'tupad'
        AND a.applied_at >= ?
        AND a.applied_at < DATE_ADD(LAST_DAY(?), INTERVAL 1 DAY)
    `,
    [startDate, startDate]
  );

  const [placementsRows] = await execute(
    `
      SELECT COUNT(*) AS placements_assisted
      FROM applications a
      WHERE LOWER(a.program_type) = 'tupad'
        AND a.status = 'Approved'
        AND COALESCE(a.approval_date, a.updated_at, a.applied_at) <= ${endDateExpr}
    `,
    [startDate]
  );

  const [beneficiaryProfileRows] = await execute(
    `
      SELECT
        a.application_id,
        a.user_id,
        CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name) AS full_name,
        COALESCE(b.address, sd.present_address, '') AS address,
        b.birth_date,
        b.gender
      FROM applications a
      LEFT JOIN beneficiaries b ON b.user_id = a.user_id
      LEFT JOIN spes_details sd ON sd.application_id = a.application_id
      WHERE LOWER(a.program_type) = 'tupad'
        AND a.status = 'Approved'
        AND COALESCE(a.approval_date, a.updated_at, a.applied_at) <= ${endDateExpr}
      ORDER BY full_name ASC
    `,
    [startDate]
  );

  const [payrollRows] = await execute(
    `
      SELECT
        ar.user_id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
          u.user_name
        ) AS full_name,
        COUNT(*) AS days_worked,
        ? AS daily_wage,
        COUNT(*) * ? AS total_payout
      FROM attendance_records ar
      LEFT JOIN users u ON u.user_id = ar.user_id
      LEFT JOIN beneficiaries b ON b.user_id = ar.user_id
      WHERE ar.status = 'Present'
        AND ar.attendance_date >= ?
        AND ar.attendance_date <= LAST_DAY(?)
        AND EXISTS (
          SELECT 1
          FROM applications a
          WHERE a.user_id = ar.user_id
            AND LOWER(a.program_type) = 'tupad'
            AND a.status = 'Approved'
            AND COALESCE(a.approval_date, a.updated_at, a.applied_at) <= LAST_DAY(?)
        )
      GROUP BY ar.user_id, full_name
      ORDER BY full_name ASC
    `,
    [DAILY_WAGE, DAILY_WAGE, startDate, startDate, startDate]
  );

  const payrollTotals = payrollRows.reduce(
    (acc, row) => {
      acc.days_worked += Number(row.days_worked || 0);
      acc.total_payout += Number(row.total_payout || 0);
      return acc;
    },
    { days_worked: 0, total_payout: 0 }
  );

  const gender = applicantGenderRows[0] || {};
  const male = Number(gender.male || 0);
  const female = Number(gender.female || 0);
  const totalApplicants = Number(gender.total || male + female);

  return {
    period: {
      month: selectedMonth,
      startDate,
      endDate
    },
    sprs: {
      applicantsRegistered: {
        male,
        female,
        total: totalApplicants
      },
      placementsAssisted: Number(placementsRows[0]?.placements_assisted || 0)
    },
    beneficiaryProfile: beneficiaryProfileRows,
    attendancePayrollSummary: payrollRows,
    totals: payrollTotals,
    dailyWage: DAILY_WAGE
  };
}

// =============================================
// Payout Profile Management
// =============================================

/**
 * Add payout-related fields to beneficiaries table
 * and manage payout readiness
 */
export async function ensurePayoutFields() {
    await execute(`
        ALTER TABLE beneficiaries 
        ADD COLUMN IF NOT EXISTS gcash_number VARCHAR(20) NULL,
        ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50) NULL,
        ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS payout_ready TINYINT(1) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS payout_verified_at DATETIME NULL
    `);
}

/**
 * Update beneficiary payout profile (GCash or Bank details)
 */
export async function updatePayoutProfile(userId, payoutData) {
    const { gcash_number, bank_name, bank_account_number, bank_account_name, payout_mode } = payoutData;
    
    // Validate payout mode
    if (payout_mode && !['gcash', 'bank'].includes(payout_mode)) {
        throw new Error('Invalid payout mode. Must be "gcash" or "bank"');
    }

    // Validate GCash number format if provided
    if (gcash_number) {
        const gcashRegex = /^09\d{9}$/;
        if (!gcashRegex.test(gcash_number)) {
            throw new Error('GCash number must be in format: 09XXXXXXXXX (11 digits starting with 09)');
        }
    }

    // Validate bank details if provided
    if (bank_name && !bank_account_number) {
        throw new Error('Bank account number is required when bank name is provided');
    }
    if (bank_account_number && !bank_name) {
        throw new Error('Bank name is required when bank account number is provided');
    }

    const payout_ready = (gcash_number || (bank_name && bank_account_number)) ? 1 : 0;
    const payout_verified_at = payout_ready ? new Date() : null;

    const [result] = await execute(
        `UPDATE beneficiaries 
         SET gcash_number = ?, 
             bank_name = ?, 
             bank_account_number = ?, 
             bank_account_name = ?,
             payout_ready = ?,
             payout_verified_at = ?
         WHERE user_id = ?`,
        [
            gcash_number || null,
            bank_name || null,
            bank_account_number || null,
            bank_account_name || null,
            payout_ready,
            payout_verified_at,
            userId
        ]
    );

    return result;
}

/**
 * Get beneficiary payout profile
 */
export async function getPayoutProfile(userId) {
    await ensurePayoutFields();
    
    const query = `
        SELECT 
            b.beneficiary_id,
            b.user_id,
            b.first_name,
            b.middle_name,
            b.last_name,
            b.gcash_number,
            b.bank_name,
            b.bank_account_number,
            b.bank_account_name,
            b.payout_ready,
            b.payout_verified_at,
            CASE 
                WHEN b.gcash_number IS NOT NULL THEN 'gcash'
                WHEN b.bank_name IS NOT NULL THEN 'bank'
                ELSE NULL
            END AS payout_mode
        FROM beneficiaries b
        WHERE b.user_id = ?
    `;
    
    const [rows] = await execute(query, [userId]);
    return rows[0] || null;
}

/**
 * Get beneficiaries ready for payout (payout_ready = 1)
 */
export async function getPayoutReadyBeneficiaries(programType = null) {
    await ensurePayoutFields();
    
    let query = `
        SELECT 
            b.beneficiary_id,
            b.user_id,
            b.first_name,
            b.middle_name,
            b.last_name,
            COALESCE(b.gcash_number, '') AS gcash_number,
            COALESCE(b.bank_name, '') AS bank_name,
            COALESCE(b.bank_account_number, '') AS bank_account_number,
            b.payout_ready,
            a.program_type,
            a.status AS application_status
        FROM beneficiaries b
        LEFT JOIN applications a ON a.user_id = b.user_id AND a.status = 'Approved'
        WHERE b.payout_ready = 1
    `;
    
    const params = [];
    if (programType) {
        query += ` AND LOWER(a.program_type) = ?`;
        params.push(programType.toLowerCase());
    }
    
    query += ` ORDER BY b.last_name, b.first_name`;
    
    const [rows] = await execute(query, params);
    return rows;
}

// =============================================
// Admin CRUD operations for beneficiary management
// =============================================

/**
 * Admin adds a beneficiary directly (no user account required).
 * Inserts into beneficiaries table and creates an Approved application record.
 */
export async function adminAddBeneficiary(data) {
  const {
    first_name, middle_name, last_name, extension_name,
    birth_date, gender, civil_status, contact_number, address,
    program_type, program_details
  } = data;

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Insert beneficiary record
    const [beneficiaryResult] = await connection.execute(
      `INSERT INTO beneficiaries
        (user_id, first_name, middle_name, last_name, extension_name,
         birth_date, gender, civil_status, contact_number, address, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        data.user_id || null,
        first_name,
        middle_name || null,
        last_name,
        extension_name || null,
        birth_date,
        gender,
        civil_status,
        contact_number || null,
        address
      ]
    );

    const beneficiaryId = beneficiaryResult.insertId;

    // Create an approved application record so the beneficiary shows up in the system
    let applicationId = null;
    if (program_type) {
      const [appResult] = await connection.execute(
        `INSERT INTO applications
          (user_id, status, program_type, approval_date)
         VALUES (?, 'Approved', ?, NOW())`,
        [data.user_id || null, program_type]
      );
      applicationId = appResult.insertId;

      // Insert program-specific details if provided
      if (program_details && applicationId) {
        const pd = program_details;

        if (program_type === 'tupad') {
          await connection.execute(
            `INSERT INTO tupad_details
              (application_id, valid_id_type, id_number, occupation, monthly_income, civil_status, work_category, job_preference, educational_attainment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              applicationId,
              pd.valid_id_type || null,
              pd.id_number || null,
              pd.occupation || null,
              pd.monthly_income || null,
              pd.civil_status || civil_status || null,
              pd.work_category || null,
              pd.job_preference || null,
              pd.educational_attainment || null
            ]
          );
        } else if (program_type === 'spes') {
          await connection.execute(
            `INSERT INTO spes_details
              (application_id, place_of_birth, citizenship, social_media_account, civil_status, sex,
               type_of_student, parent_status, father_name, father_occupation, father_contact,
               mother_maiden_name, mother_occupation, mother_contact, education_level,
               name_of_school, degree_earned_course, year_level, present_address, permanent_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              applicationId,
              pd.place_of_birth || null,
              pd.citizenship || 'Filipino',
              pd.social_media_account || null,
              pd.civil_status || civil_status || 'Single',
              pd.sex || gender || 'Male',
              pd.type_of_student || 'Student',
              pd.parent_status || 'Living together',
              pd.father_name || null,
              pd.father_occupation || null,
              pd.father_contact || null,
              pd.mother_maiden_name || null,
              pd.mother_occupation || null,
              pd.mother_contact || null,
              pd.education_level || 'Secondary',
              pd.name_of_school || null,
              pd.degree_earned_course || null,
              pd.year_level || null,
              pd.present_address || address,
              pd.permanent_address || address
            ]
          );
        } else if (program_type === 'dilp') {
          await connection.execute(
            `INSERT INTO dilp_applications
              (proponent_name, sex, civil_status, date_of_birth, email,
               project_title, project_type, category, proposed_amount,
               location, barangay, city, province, contact_person, contact_number,
               business_experience, estimated_monthly_income, number_of_beneficiaries,
               skills_training, valid_id_number, brief_description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              pd.proponent_name || `${first_name} ${last_name}`,
              pd.sex || gender || null,
              pd.civil_status || civil_status || null,
              pd.date_of_birth || birth_date || null,
              pd.email || null,
              pd.project_title || '',
              pd.project_type || 'Individual',
              pd.category || 'Formation',
              pd.proposed_amount || 0,
              pd.location || null,
              pd.barangay || null,
              pd.city || null,
              pd.province || null,
              pd.contact_person || null,
              pd.contact_number || contact_number || '',
              pd.business_experience || null,
              pd.estimated_monthly_income || 0,
              pd.number_of_beneficiaries || 0,
              pd.skills_training || null,
              pd.valid_id_number || null,
              pd.brief_description || null
            ]
          );
        }
      }
    }

    await connection.commit();
    return { beneficiaryId, applicationId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// =============================================
// Beneficiary Profiling
// =============================================

/**
 * Get or create a beneficiary profile for the logged-in user.
 * Used so beneficiaries can view/edit their own profiling data.
 */
export async function getOrCreateBeneficiaryProfile(userId) {
    const [rows] = await _query(
        'SELECT * FROM beneficiaries WHERE user_id = ?',
        [userId]
    );

    if (rows.length > 0) {
        return rows[0];
    }

    // Auto-create from users table + most recent approved application
    const [userRows] = await _query(
        'SELECT user_name, email, phone FROM users WHERE user_id = ?',
        [userId]
    );

    if (userRows.length === 0) {
        throw new Error('User not found');
    }

    const user = userRows[0];
    // Parse first/last name from user_name (format: "FirstName LastName")
    const nameParts = (user.user_name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const [result] = await _query(
        `INSERT INTO beneficiaries (user_id, first_name, last_name, contact_number, address, is_active)
         VALUES (?, ?, ?, ?, '', 1)`,
        [userId, firstName, lastName, user.phone]
    );

    const [newRows] = await _query(
        'SELECT * FROM beneficiaries WHERE beneficiary_id = ?',
        [result.insertId]
    );

    return newRows[0];
}

/**
 * Update a beneficiary's profiling data
 */
export async function updateBeneficiaryProfile(userId, data) {
    const {
        first_name, middle_name, last_name, extension_name,
        birth_date, gender, civil_status, contact_number, address
    } = data;

    const fields = [];
    const values = [];

    if (first_name !== undefined)    { fields.push('first_name = ?');       values.push(first_name); }
    if (middle_name !== undefined)  { fields.push('middle_name = ?');      values.push(middle_name); }
    if (last_name !== undefined)     { fields.push('last_name = ?');        values.push(last_name); }
    if (extension_name !== undefined){ fields.push('extension_name = ?');    values.push(extension_name); }
    if (birth_date !== undefined)    { fields.push('birth_date = ?');       values.push(birth_date); }
    if (gender !== undefined)       { fields.push('gender = ?');          values.push(gender); }
    if (civil_status !== undefined) { fields.push('civil_status = ?');    values.push(civil_status); }
    if (contact_number !== undefined){ fields.push('contact_number = ?');  values.push(contact_number); }
    if (address !== undefined)      { fields.push('address = ?');         values.push(address); }

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    values.push(userId);

    const [result] = await _query(
        `UPDATE beneficiaries SET ${fields.join(', ')} WHERE user_id = ?`,
        values
    );

    return result.affectedRows > 0;
}

/**
 * Check for potential duplicate beneficiaries.
 * Checks by exact name + birth_date match OR same user_id already has a profile.
 */
export async function checkDuplicateBeneficiary(userId, birthDate) {
    // First check if this user already has a beneficiary record
    const [existingByUser] = await _query(
        'SELECT beneficiary_id FROM beneficiaries WHERE user_id = ?',
        [userId]
    );

    if (existingByUser.length > 0) {
        return {
            is_duplicate: false,
            reason: 'already_registered',
            beneficiary_id: existingByUser[0].beneficiary_id
        };
    }

    // Parse first/last from users table
    const [userRows] = await _query(
        'SELECT user_name FROM users WHERE user_id = ?',
        [userId]
    );

    if (userRows.length === 0) {
        throw new Error('User not found');
    }

    const nameParts = (userRows[0].user_name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Check for same name + birth_date in system (different user)
    const [duplicateCheck] = await _query(
        `SELECT beneficiary_id, first_name, last_name, birth_date
         FROM beneficiaries
         WHERE first_name = ? AND last_name = ? AND birth_date = ? AND user_id != ?
         LIMIT 1`,
        [firstName, lastName, birthDate, userId]
    );

    if (duplicateCheck.length > 0) {
        return {
            is_duplicate: true,
            reason: 'name_and_birthdate_match',
            matched_beneficiary_id: duplicateCheck[0].beneficiary_id
        };
    }

    return { is_duplicate: false, reason: null, beneficiary_id: null };
}

/**
 * Get a beneficiary's full program history across all programs.
 * Returns each program they've applied to/enrolled in, with status.
 */
export async function getBeneficiaryProgramHistory(userId) {
    const [applications] = await _query(
        `SELECT
            a.application_id,
            a.program_type,
            a.status,
            a.applied_at,
            a.approval_date,
            a.rejection_reason,
            pe.enrollee_id,
            pe.current_status AS enrollee_status,
            pe.enrollment_date,
            pe.completion_date,
            p.program_name,
            p.location,
            p.start_date,
            p.end_date
         FROM applications a
         LEFT JOIN program_enrollees pe ON pe.application_id = a.application_id
         LEFT JOIN programs p ON p.program_id = pe.program_id
         WHERE a.user_id = ?
         ORDER BY a.applied_at DESC`,
        [userId]
    );

    return applications;
}

/**
 * Employment history (derived from application detail tables).
 * This is intentionally read-only and computed from what the beneficiary already submitted.
 *
 * Returns newest → oldest entries.
 */
export async function getEmploymentHistoryByUserId(userId) {
  const [rows] = await execute(
    `
    SELECT
      a.application_id,
      a.program_type,
      a.status AS application_status,
      a.applied_at,

      -- TUPAD employment-ish fields
      td.occupation AS tupad_occupation,
      td.monthly_income AS tupad_monthly_income,

      -- GIP employment-ish fields
      gd.employment_status AS gip_employment_status,
      gd.school AS gip_school,
      gd.course AS gip_course,
      gd.year_graduated AS gip_year_graduated,
      gd.education_level AS gip_education_level,
      gd.skills AS gip_skills,

      -- Job seeker employment-ish fields
      jd.employment_status AS jobseeker_employment_status,
      jd.preferred_work_type,
      jd.preferred_industry,
      jd.years_of_experience,
      jd.technical_skills,
      jd.expected_salary,
      jd.availability
    FROM applications a
    LEFT JOIN tupad_details td ON td.application_id = a.application_id
    LEFT JOIN gip_details gd ON gd.application_id = a.application_id
    LEFT JOIN jobseeker_details jd ON jd.application_id = a.application_id
    WHERE a.user_id = ?
    ORDER BY a.applied_at DESC
    `,
    [userId]
  );

  return rows.map((r) => {
    const employment_status =
      r.jobseeker_employment_status ||
      r.gip_employment_status ||
      null;

    return {
      application_id: r.application_id,
      program_type: r.program_type,
      application_status: r.application_status,
      applied_at: r.applied_at,

      employment_status,

      tupad: r.program_type === 'tupad' ? {
        occupation: r.tupad_occupation || null,
        monthly_income: r.tupad_monthly_income ?? null,
      } : null,

      gip: r.program_type === 'gip' ? {
        employment_status: r.gip_employment_status || null,
        school: r.gip_school || null,
        course: r.gip_course || null,
        year_graduated: r.gip_year_graduated || null,
        education_level: r.gip_education_level || null,
        skills: r.gip_skills || null,
      } : null,

      job_seekers: r.program_type === 'job_seekers' ? {
        employment_status: r.jobseeker_employment_status || null,
        preferred_work_type: r.preferred_work_type || null,
        preferred_industry: r.preferred_industry || null,
        years_of_experience: r.years_of_experience || null,
        technical_skills: r.technical_skills || null,
        expected_salary: r.expected_salary || null,
        availability: r.availability || null,
      } : null,
    };
  });
}

/**
 * Admin updates beneficiary data.
 */
export async function adminUpdateBeneficiary(beneficiaryId, data) {
  const {
    first_name, middle_name, last_name, extension_name,
    birth_date, gender, civil_status, contact_number, address
  } = data;

  const [result] = await execute(
    `UPDATE beneficiaries
     SET first_name = ?, middle_name = ?, last_name = ?, extension_name = ?,
         birth_date = ?, gender = ?, civil_status = ?, contact_number = ?, address = ?
     WHERE beneficiary_id = ?`,
    [
      first_name,
      middle_name || null,
      last_name,
      extension_name || null,
      birth_date,
      gender,
      civil_status,
      contact_number || null,
      address,
      beneficiaryId
    ]
  );

  return result;
}

/**
 * Admin updates the program assignment for a beneficiary.
 * Updates the existing application's program_type.
 */
export async function adminUpdateBeneficiaryProgram(applicationId, programType) {
  const [result] = await execute(
    `UPDATE applications SET program_type = ? WHERE application_id = ?`,
    [programType, applicationId]
  );
  return result;
}

/**
 * Admin deletes a beneficiary and their associated application records.
 */
export async function adminDeleteBeneficiary(beneficiaryId) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Get user_id for this beneficiary to clean up applications
    const [rows] = await connection.execute(
      `SELECT user_id FROM beneficiaries WHERE beneficiary_id = ?`,
      [beneficiaryId]
    );

    if (rows.length === 0) {
      throw new Error('Beneficiary not found');
    }

    // Delete attendance records for this beneficiary
    await connection.execute(
      `DELETE FROM attendance WHERE beneficiary_id = ?`,
      [beneficiaryId]
    );

    // Delete the beneficiary record
    await connection.execute(
      `DELETE FROM beneficiaries WHERE beneficiary_id = ?`,
      [beneficiaryId]
    );

    await connection.commit();
    return { deleted: true };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Get a single beneficiary by ID (for edit form).
 */
export async function getBeneficiaryById(beneficiaryId) {
  const query = `
    SELECT
      b.beneficiary_id,
      b.user_id,
      b.first_name,
      b.middle_name,
      b.last_name,
      b.extension_name,
      b.birth_date,
      b.gender,
      b.civil_status,
      b.contact_number,
      b.address,
      b.is_active,
      a.application_id,
      a.program_type,
      a.status AS application_status,
      a.approval_date
    FROM beneficiaries b
    LEFT JOIN applications a ON a.user_id = b.user_id AND a.status = 'Approved'
    WHERE b.beneficiary_id = ?
    LIMIT 1
  `;
  const [rows] = await execute(query, [beneficiaryId]);
  return rows[0] || null;
}

/**
 * Get all beneficiaries with full details for admin management.
 */
export async function getAllBeneficiariesForAdmin() {
  const query = `
    SELECT
      b.beneficiary_id,
      b.user_id,
      b.first_name,
      b.middle_name,
      b.last_name,
      b.extension_name,
      b.birth_date,
      b.gender,
      b.civil_status,
      b.contact_number,
      b.address,
      b.is_active,
      a.application_id,
      a.program_type,
      a.status AS application_status,
      a.approval_date,
      a.applied_at
    FROM beneficiaries b
    LEFT JOIN applications a ON a.user_id = b.user_id AND a.status = 'Approved'
    LEFT JOIN users u ON u.user_id = b.user_id
    ORDER BY b.beneficiary_id DESC
  `;
  const [rows] = await execute(query);
  return rows;
}

// ── Duplicate Detection ──────────────────────────────

/**
 * Detect potential duplicate applications.
 * Criteria:
 *  1. Same user_id applying to the same program_type more than once
 *  2. Different user_ids but matching beneficiary (first_name + last_name + birth_date)
 *     applying to the same program
 */
export async function detectDuplicates() {
  // Group 1: Same user applying to the same program more than once
  const sameUserQuery = `
    SELECT
      a.application_id,
      a.user_id,
      a.program_type,
      a.status,
      a.is_duplicate,
      a.duplicate_notes,
      a.applied_at,
      b.first_name,
      b.middle_name,
      b.last_name,
      b.birth_date,
      b.contact_number,
      b.address,
      u.email,
      'same_user_program' AS duplicate_type
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN users u ON u.user_id = a.user_id
    WHERE a.user_id IN (
      SELECT user_id FROM applications
      GROUP BY user_id, program_type
      HAVING COUNT(*) > 1
    )
    ORDER BY a.user_id, a.program_type, a.applied_at
  `;

  // Group 2: Different users with matching name + birth_date applying to same program
  const samePersonQuery = `
    SELECT
      a.application_id,
      a.user_id,
      a.program_type,
      a.status,
      a.is_duplicate,
      a.duplicate_notes,
      a.applied_at,
      b.first_name,
      b.middle_name,
      b.last_name,
      b.birth_date,
      b.contact_number,
      b.address,
      u.email,
      'same_person_different_account' AS duplicate_type
    FROM applications a
    INNER JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN users u ON u.user_id = a.user_id
    WHERE EXISTS (
      SELECT 1 FROM applications a2
      INNER JOIN beneficiaries b2 ON b2.user_id = a2.user_id
      WHERE LOWER(b2.first_name) = LOWER(b.first_name)
        AND LOWER(b2.last_name) = LOWER(b.last_name)
        AND b2.birth_date = b.birth_date
        AND a2.user_id != a.user_id
        AND a2.program_type = a.program_type
    )
    ORDER BY b.last_name, b.first_name, a.program_type, a.applied_at
  `;

  const [sameUser] = await execute(sameUserQuery);
  const [samePerson] = await execute(samePersonQuery);

  // Merge and deduplicate by application_id
  const seen = new Set();
  const all = [];
  for (const row of [...sameUser, ...samePerson]) {
    if (!seen.has(row.application_id)) {
      seen.add(row.application_id);
      all.push(row);
    }
  }
  return all;
}

/**
 * Get all applications that have been manually marked as duplicate.
 */
export async function getMarkedDuplicates() {
  const query = `
    SELECT
      a.application_id,
      a.user_id,
      a.program_type,
      a.status,
      a.is_duplicate,
      a.duplicate_notes,
      a.applied_at,
      b.first_name,
      b.middle_name,
      b.last_name,
      b.birth_date,
      b.contact_number,
      b.address,
      u.email
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN users u ON u.user_id = a.user_id
    WHERE a.is_duplicate = 1
    ORDER BY a.applied_at DESC
  `;
  const [rows] = await execute(query);
  return rows;
}

/**
 * Mark an application as duplicate.
 */
export async function markAsDuplicate(applicationId, notes) {
  const query = `
    UPDATE applications
    SET is_duplicate = 1, duplicate_notes = ?
    WHERE application_id = ?
  `;
  const [result] = await execute(query, [notes || null, applicationId]);
  return result;
}

/**
 * Unmark an application (clear duplicate flag).
 */
export async function unmarkDuplicate(applicationId) {
  const query = `
    UPDATE applications
    SET is_duplicate = 0, duplicate_notes = NULL
    WHERE application_id = ?
  `;
  const [result] = await execute(query, [applicationId]);
  return result;
}

/**
 * Resolve a duplicate by rejecting it.
 */
export async function resolveDuplicate(applicationId, action) {
  if (action === 'reject') {
    const query = `
      UPDATE applications
      SET status = 'Rejected', rejection_reason = 'Duplicate application', is_duplicate = 1
      WHERE application_id = ?
    `;
    const [result] = await execute(query, [applicationId]);
    return result;
  }
  // 'keep' action — just unmark it
  return unmarkDuplicate(applicationId);
}

// ── Enrollment Management ──────────────────────────
/**
 * Enroll an approved beneficiary into a specific program instance
 */
// ── ENROLL BENEFICIARY ─────────────────────────────
export async function enrollBeneficiary(applicationId, programId) {
  const connection = await getConnection();

  try {
<<<<<<< HEAD
=======
    // #region agent log (entry)
    fetch('http://127.0.0.1:7500/ingest/a56af0b5-bb5d-4246-ae1b-60ffc6fa82e8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f3a7d7' },
      body: JSON.stringify({
        sessionId: 'f3a7d7',
        runId: 'approval-slot-debug',
        hypothesisId: 'H2',
        location: 'beneficiary.services.js:enrollBeneficiary:entry',
        message: 'enrollBeneficiary called',
        data: { applicationId: Number(applicationId) || null, programId: Number(programId) || null },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

>>>>>>> 826997eb2a2d518c1746e3b6f423c32c134faaa7
    await connection.beginTransaction();

    // 1. Lock and retrieve application (includes user_id, program_type, status)
    const [appRows] = await connection.execute(
      `SELECT application_id, user_id, status, program_type 
       FROM applications 
       WHERE application_id = ? 
       FOR UPDATE`,
      [applicationId]
    );

    if (!appRows.length) {
      throw new Error('Application not found');
    }

    const application = appRows[0];
    if (application.status !== 'Approved') {
      throw new Error('Application must be approved to enroll');
    }

    const userId = application.user_id;
    const programType = application.program_type;

    // ─────────────────────────────────────────────
    // RULE 1: Only one ACTIVE program per user
    // ─────────────────────────────────────────────
    const [activeEnrollments] = await connection.execute(
      `SELECT pe.enrollee_id
       FROM program_enrollees pe
       JOIN applications a ON pe.application_id = a.application_id
       WHERE a.user_id = ? AND pe.current_status = 'Active'`,
      [userId]
    );

    if (activeEnrollments.length > 0) {
      throw new Error('Beneficiary already enrolled in an active program');
    }

    // ─────────────────────────────────────────────
    // RULE 2: TUPAD cooldown (6 months from *completion* or last enrollment)
    // ─────────────────────────────────────────────
    if (programType === 'tupad') {
      // Prefer the end date when the previous TUPAD became Inactive/Completed.
      // If end_date is not stored, fall back to enrollment_date (less accurate).
      const [history] = await connection.execute(
        `SELECT 
           COALESCE(pe.end_date, pe.enrollment_date) AS reference_date
         FROM program_enrollees pe
         JOIN applications a ON pe.application_id = a.application_id
         WHERE a.user_id = ? 
           AND a.program_type = 'tupad'
           AND pe.current_status IN ('Inactive', 'Completed')
         ORDER BY COALESCE(pe.end_date, pe.enrollment_date) DESC
         LIMIT 1`,
        [userId]
      );

      if (history.length > 0) {
        const lastDate = new Date(history[0].reference_date);
        const now = new Date();

        const diffMonths =
          (now.getFullYear() - lastDate.getFullYear()) * 12 +
          (now.getMonth() - lastDate.getMonth());

        if (diffMonths < 6) {
          throw new Error(
            `TUPAD cooldown active. Please wait ${6 - diffMonths} more month(s)`
          );
        }
      }
    }

    // ─────────────────────────────────────────────
    // 2. Check program exists & validate type match
    // ─────────────────────────────────────────────
    const [progRows] = await connection.execute(
      `SELECT program_id, slots, filled, program_type
       FROM programs 
       WHERE program_id = ?`,
      [programId]
    );

    if (!progRows.length) {
      throw new Error('Program not found');
    }

<<<<<<< HEAD
    const { slots, filled } = progRows[0];
=======
    const { slots, filled, program_type: progType } = progRows[0];
>>>>>>> 826997eb2a2d518c1746e3b6f423c32c134faaa7

    // Guard against invalid slot configuration
    if (slots === null || slots <= 0) {
      throw new Error('Invalid program slot configuration');
    }

    // Prevent enrolling a TUPAD application into a 4Ps program (or vice versa)
    if (progType !== programType) {
      throw new Error('Program type does not match application type');
    }

    // ─────────────────────────────────────────────
    // 3. Prevent duplicate enrollment for this application
    // ─────────────────────────────────────────────
    const [existing] = await connection.execute(
      `SELECT enrollee_id 
       FROM program_enrollees 
       WHERE application_id = ? AND program_id = ?`,
      [applicationId, programId]
    );

    if (existing.length > 0) {
      throw new Error('Already enrolled in this program');
    }

    // Optional: ensure the same application is not used for *any* other enrollment
    const [anyEnrollment] = await connection.execute(
      `SELECT enrollee_id 
       FROM program_enrollees 
       WHERE application_id = ?`,
      [applicationId]
    );
    if (anyEnrollment.length > 0) {
      throw new Error('Application already used for an enrollment');
    }

    // ─────────────────────────────────────────────
    // 4. Insert enrollment record
    // ─────────────────────────────────────────────
    const [result] = await connection.execute(
      `INSERT INTO program_enrollees 
       (program_id, application_id, enrollment_date, current_status)
       VALUES (?, ?, NOW(), 'Active')`,
      [programId, applicationId]
    );

<<<<<<< HEAD
=======
    // ─────────────────────────────────────────────
    // 5. Atomically increment filled counter (race‑condition safe)
    // ─────────────────────────────────────────────
    const [updateResult] = await connection.execute(
      `UPDATE programs 
       SET filled = filled + 1 
       WHERE program_id = ? AND filled < slots`,
      [programId]
    );

    if (updateResult.affectedRows === 0) {
      // This can happen if slots were filled between the earlier check and the update.
      // Rollback the already-inserted enrollee record.
      throw new Error('Program has no available slots');
    }

>>>>>>> 826997eb2a2d518c1746e3b6f423c32c134faaa7
    await connection.commit();

    // #region agent log (success)
    fetch('http://127.0.0.1:7500/ingest/a56af0b5-bb5d-4246-ae1b-60ffc6fa82e8', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f3a7d7' },
      body: JSON.stringify({
        sessionId: 'f3a7d7',
        runId: 'approval-slot-debug',
        hypothesisId: 'H5',
        location: 'beneficiary.services.js:enrollBeneficiary:success',
        message: 'Enrollment successful',
        data: { enrolleeId: result.insertId, applicationId, programId },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    return {
      enrolleeId: result.insertId,
      applicationId,
      programId
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
/**
 * Get all enrollees for a specific program
 * Used by: beneficiaryController.getProgramEnrollees
 */
export async function getProgramEnrollees(programId) {
  const query = `
    SELECT 
      pe.enrollee_id,
      pe.application_id,
      a.user_id,
      pe.program_id,
      pe.enrollment_date,
      pe.current_status,
      b.first_name,
      b.middle_name,
      b.last_name,
      b.extension_name,
      COALESCE(b.contact_number, u.phone) AS contact_number,
      u.email,
      b.address,
      b.gender,
      b.civil_status,
      b.birth_date,
      p.program_name
    FROM program_enrollees pe
    INNER JOIN applications a ON pe.application_id = a.application_id
    INNER JOIN beneficiaries b ON a.user_id = b.user_id
    INNER JOIN users u ON a.user_id = u.user_id
    INNER JOIN programs p ON pe.program_id = p.program_id
    WHERE pe.program_id = ?
    ORDER BY pe.enrollment_date DESC
  `;
  const [rows] = await execute(query, [programId]);
  return rows;
}

/**
 * Get enrollment status for a specific application
 */
export async function getEnrollmentStatus(applicationId) {
  const query = `
    SELECT 
      pe.enrollee_id,
      pe.application_id,
      pe.program_id,
      pe.enrollment_date,
      pe.current_status
    FROM program_enrollees pe
    WHERE pe.application_id = ?
    ORDER BY pe.enrollment_date DESC
    LIMIT 1
  `;
  
  const [rows] = await execute(query, [applicationId]);
  return rows[0] || null;
}

/**
 * Update enrollment status
 */
export async function updateEnrollmentStatus(enrolleeId, status) {
  const validStatuses = ['Active', 'Completed', 'Dropped', 'Suspended'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status. Must be one of: Active, Completed, Dropped, Suspended');
  }

  const [existing] = await execute(
    'SELECT enrollee_id FROM program_enrollees WHERE enrollee_id = ?',
    [enrolleeId]
  );

  if (!existing.length) {
    throw new Error('Enrollment record not found');
  }

  const [result] = await execute(
    'UPDATE program_enrollees SET current_status = ?, updated_at = NOW() WHERE enrollee_id = ?',
    [status, enrolleeId]
  );

  return result;
}

