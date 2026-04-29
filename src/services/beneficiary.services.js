const db = require("../../config");

exports.getAllBeneficiaries = async () => {
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

  const [rows] = await db.execute(query);
  return [rows];
};

exports.getApprovedCount = async () => {
  const query = `
    SELECT COUNT(*) AS count
    FROM applications
    WHERE status = 'Approved'
  `;

  const [rows] = await db.execute(query);
  return Number(rows[0]?.count || 0);
};

exports.getBeneficiaryApplicationDetails = async (applicationId) => {
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

  const [baseRows] = await db.execute(baseQuery, [applicationId]);
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
    const [tupadRows] = await db.execute(
      'SELECT * FROM tupad_details WHERE application_id = ? LIMIT 1',
      [applicationId]
    );
    details.tupad = tupadRows[0] || null;
  }

  if (application.program_type === 'spes') {
    const [spesRows] = await db.execute(
      'SELECT * FROM spes_details WHERE application_id = ? LIMIT 1',
      [applicationId]
    );
    details.spes = spesRows[0] || null;
  }

  return {
    application,
    details
  };
};

// Get all applications across programs (for admin dashboard)
exports.getAllApplications = async () => {
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
  const [rows] = await db.execute(query);
  return [rows];
};

exports.getRecentApplications = async (limit = 10, userId = null) => {
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

  const [rows] = await db.execute(query, params);
  return [rows];
};

// get all pending applications (for admin approval queue)
exports.getPendingApplications = async (programType = null) => {
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
  const [rows] = await db.execute(query, params);
  return [rows];
};

// get applications by status (for admin management view)
exports.getApplicationsByStatus = async (status, programType = null) => {
  const params = [status];
  let whereClause = 'WHERE a.status = ?';

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
      a.rejection_reason,
      a.applied_at
    FROM applications a
    LEFT JOIN beneficiaries b ON b.user_id = a.user_id
    LEFT JOIN spes_details sd ON sd.application_id = a.application_id
    LEFT JOIN users u ON a.user_id = u.user_id
    ${whereClause}
    ORDER BY a.applied_at DESC
  `;
  const [rows] = await db.execute(query, params);
  return [rows];
};

// approve application of the benficiary
exports.approveApplication = async (id) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch the application to get user_id and program_type
    const [appRows] = await connection.execute(
      `SELECT application_id, user_id, program_type, status
       FROM applications WHERE application_id = ?`,
      [id]
    );
    if (!appRows.length) {
      throw new Error('Application not found');
    }
    const application = appRows[0];
    if (application.status === 'Approved') {
      throw new Error('Application is already approved');
    }

    // 2. Update application status to Approved
    await connection.execute(
      `UPDATE applications
       SET status = 'Approved',
           approval_date = NOW(),
           rejection_reason = NULL
       WHERE application_id = ?`,
      [id]
    );

    // 3. Ensure the beneficiary record is active
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
    // 5. Send approval notification to the beneficiary
    const programLabel = (application.program_type || '').toUpperCase().replace('_', ' ');
    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, ?)`,
      [
        application.user_id,
        'Application Approved',
        `Your ${programLabel} application has been approved. You are now enrolled in the program.`,
        'application'
      ]
    );

    await connection.commit();
    return { applicationId: id, userId: application.user_id, programType: application.program_type };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// reject application of the benficiary
exports.rejectApplication = async (id, reason) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch the application
    const [appRows] = await connection.execute(
      `SELECT application_id, user_id, program_type, program_id, status
       FROM applications WHERE application_id = ?`,
      [id]
    );
    if (!appRows.length) {
      throw new Error('Application not found');
    }
    const application = appRows[0];

    // 2. If previously approved, decrement the program filled count using program_id
    if (application.status === 'Approved') {
      if (application.program_id) {
        await connection.execute(
          `UPDATE programs
           SET filled = GREATEST(filled - 1, 0)
           WHERE program_id = ?`,
          [application.program_id]
        );
      } else {
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
    }

    // 3. Update application status to Rejected
    await connection.execute(
      `UPDATE applications
       SET status = 'Rejected',
           rejection_reason = ?,
           approval_date = NULL
       WHERE application_id = ?`,
      [reason || null, id]
    );

    // 4. Send rejection notification
    const programLabel = (application.program_type || '').toUpperCase().replace('_', ' ');
    const notifMessage = reason
      ? `Your ${programLabel} application has been rejected. Reason: ${reason}`
      : `Your ${programLabel} application has been rejected. Please contact the office for more details.`;
    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, ?)`,
      [application.user_id, 'Application Rejected', notifMessage, 'application']
    );

    await connection.commit();
    return { applicationId: id, userId: application.user_id, programType: application.program_type };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

// get the latest application status for each program of a beneficiary
exports.getUserApplicationStatus = async (userId) => {
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

  const [rows] = await db.execute(query, [userId]);

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
};

// expoert applications for admin management view
exports.getApplicationsForExport = async (programType = null, status = null) => {
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

  const [rows] = await db.execute(query, params);
  return rows;
};

// =============================================
// Daily Wage Settings
// =============================================
exports.getDailyWage = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const [rows] = await db.execute(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'tupad_daily_wage'`
  );
  return rows.length > 0 ? parseFloat(rows[0].setting_value) || 435 : 435;
};

exports.updateDailyWage = async (newWage) => {
  const wage = parseFloat(newWage);
  if (isNaN(wage) || wage <= 0) {
    throw new Error('Daily wage must be a positive number');
  }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await db.execute(
    `INSERT INTO system_settings (setting_key, setting_value) VALUES ('tupad_daily_wage', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [String(wage)]
  );
  return wage;
};

exports.getTupadMonthlyReport = async (monthInput) => {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  const selectedMonth = monthRegex.test(String(monthInput || ''))
    ? String(monthInput)
    : new Date().toISOString().slice(0, 7);

  const startDate = `${selectedMonth}-01`;
  const [year, month] = selectedMonth.split('-').map(Number);
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
  const endDateExpr = 'LAST_DAY(?)';

  // Read daily wage from system_settings (fallback to 435)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const [wageRows] = await db.execute(
    `SELECT setting_value FROM system_settings WHERE setting_key = 'tupad_daily_wage'`
  );
  const DAILY_WAGE = wageRows.length > 0 ? parseFloat(wageRows[0].setting_value) || 435 : 435;

  await db.execute(`
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

  const [applicantGenderRows] = await db.execute(
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

  const [placementsRows] = await db.execute(
    `
      SELECT COUNT(*) AS placements_assisted
      FROM applications a
      WHERE LOWER(a.program_type) = 'tupad'
        AND a.status = 'Approved'
        AND COALESCE(a.approval_date, a.updated_at, a.applied_at) <= ${endDateExpr}
    `,
    [startDate]
  );

  const [beneficiaryProfileRows] = await db.execute(
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

  const [payrollRows] = await db.execute(
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
};

// =============================================
// Admin CRUD operations for beneficiary management
// =============================================

/**
 * Admin adds a beneficiary directly (no user account required).
 * Inserts into beneficiaries table and creates an Approved application record.
 */
exports.adminAddBeneficiary = async (data) => {
  const {
    first_name, middle_name, last_name, extension_name,
    birth_date, gender, civil_status, contact_number, address,
    program_type, program_details
  } = data;

  const connection = await db.getConnection();
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
};

/**
 * Admin updates beneficiary data.
 */
exports.adminUpdateBeneficiary = async (beneficiaryId, data) => {
  const {
    first_name, middle_name, last_name, extension_name,
    birth_date, gender, civil_status, contact_number, address
  } = data;

  const [result] = await db.execute(
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
};

/**
 * Admin updates the program assignment for a beneficiary.
 * Updates the existing application's program_type.
 */
exports.adminUpdateBeneficiaryProgram = async (applicationId, programType) => {
  const [result] = await db.execute(
    `UPDATE applications SET program_type = ? WHERE application_id = ?`,
    [programType, applicationId]
  );
  return result;
};

/**
 * Admin deletes a beneficiary and their associated application records.
 */
exports.adminDeleteBeneficiary = async (beneficiaryId) => {
  const connection = await db.getConnection();
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
};

/**
 * Get a single beneficiary by ID (for edit form).
 */
exports.getBeneficiaryById = async (beneficiaryId) => {
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
  const [rows] = await db.execute(query, [beneficiaryId]);
  return rows[0] || null;
};

/**
 * Get all beneficiaries with full details for admin management.
 */
exports.getAllBeneficiariesForAdmin = async () => {
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
  const [rows] = await db.execute(query);
  return rows;
};

// ── Duplicate Detection ──────────────────────────────

/**
 * Detect potential duplicate applications.
 * Criteria:
 *  1. Same user_id applying to the same program_type more than once
 *  2. Different user_ids but matching beneficiary (first_name + last_name + birth_date)
 *     applying to the same program
 */
exports.detectDuplicates = async () => {
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

  const [sameUser] = await db.execute(sameUserQuery);
  const [samePerson] = await db.execute(samePersonQuery);

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
};

/**
 * Get all applications that have been manually marked as duplicate.
 */
exports.getMarkedDuplicates = async () => {
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
  const [rows] = await db.execute(query);
  return rows;
};

/**
 * Mark an application as duplicate.
 */
exports.markAsDuplicate = async (applicationId, notes) => {
  const query = `
    UPDATE applications
    SET is_duplicate = 1, duplicate_notes = ?
    WHERE application_id = ?
  `;
  const [result] = await db.execute(query, [notes || null, applicationId]);
  return result;
};

/**
 * Unmark an application (clear duplicate flag).
 */
exports.unmarkDuplicate = async (applicationId) => {
  const query = `
    UPDATE applications
    SET is_duplicate = 0, duplicate_notes = NULL
    WHERE application_id = ?
  `;
  const [result] = await db.execute(query, [applicationId]);
  return result;
};

/**
 * Resolve a duplicate by rejecting it.
 */
exports.resolveDuplicate = async (applicationId, action) => {
  if (action === 'reject') {
    const query = `
      UPDATE applications
      SET status = 'Rejected', rejection_reason = 'Duplicate application', is_duplicate = 1
      WHERE application_id = ?
    `;
    const [result] = await db.execute(query, [applicationId]);
    return result;
  }
  // 'keep' action — just unmark it
  return exports.unmarkDuplicate(applicationId);
};

// ── Enrollment Management ──────────────────────────
/**
 * Enroll an approved beneficiary into a specific program instance
 */
// ── ENROLL BENEFICIARY ─────────────────────────────
exports.enrollBeneficiary = async (applicationId, programId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get application (includes user_id + program_type)
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
    // RULE 1: Only 1 ACTIVE program per user
    // ─────────────────────────────────────────────
    const [activeEnrollments] = await connection.execute(
      `SELECT pe.enrollee_id
       FROM program_enrollees pe
       JOIN applications a ON pe.application_id = a.application_id
       WHERE a.user_id = ?
       AND pe.current_status = 'Active'`,
      [userId]
    );

    if (activeEnrollments.length > 0) {
      throw new Error('Beneficiary already enrolled in an active program');
    }

    // ─────────────────────────────────────────────
    // RULE 2: TUPAD 6-MONTH COOLDOWN
    // ─────────────────────────────────────────────
    if (programType === 'tupad') {
      const [tupadHistory] = await connection.execute(
        `SELECT pe.enrollment_date
         FROM program_enrollees pe
         JOIN applications a ON pe.application_id = a.application_id
         WHERE a.user_id = ?
         AND a.program_type = 'tupad'
         ORDER BY pe.enrollment_date DESC
         LIMIT 1`,
        [userId]
      );

      if (tupadHistory.length > 0) {
        const lastDate = new Date(tupadHistory[0].enrollment_date);
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
    // 2. Check program exists
    // ─────────────────────────────────────────────
    const [progRows] = await connection.execute(
      `SELECT program_id, slots, filled 
       FROM programs 
       WHERE program_id = ? 
       FOR UPDATE`,
      [programId]
    );

    if (!progRows.length) {
      throw new Error('Program not found');
    }

    const { slots, filled } = progRows[0];

    if (filled >= slots) {
      throw new Error('Program has no available slots');
    }

    // ─────────────────────────────────────────────
    // 3. Prevent duplicate enrollment in same program
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

    // ─────────────────────────────────────────────
    // 4. Insert enrollment
    // ─────────────────────────────────────────────
    const [result] = await connection.execute(
      `INSERT INTO program_enrollees 
       (program_id, application_id, enrollment_date, current_status)
       VALUES (?, ?, NOW(), 'Active')`,
      [programId, applicationId]
    );

    // ─────────────────────────────────────────────
    // 5. Update slots
    // ─────────────────────────────────────────────
    await connection.execute(
      `UPDATE programs 
       SET filled = filled + 1 
       WHERE program_id = ?`,
      [programId]
    );

    await connection.commit();

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
};