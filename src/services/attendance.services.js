const db = require('../../db');

let tableEnsured = false;

const ensureAttendanceTable = async () => {
  if (tableEnsured) {
    return;
  }

  const createTableQuery = `
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
  `;

  await db.execute(createTableQuery);
  tableEnsured = true;
};

const getLatestProgram = async (userId) => {
  const query = `
    SELECT program_type
    FROM applications
    WHERE user_id = ?
    ORDER BY COALESCE(approval_date, updated_at, applied_at) DESC
    LIMIT 1
  `;

  const [rows] = await db.execute(query, [userId]);
  return rows[0] || null;
};

exports.getAttendanceRecords = async (userId) => {
  await ensureAttendanceTable();

  const query = `
    SELECT
      attendance_id,
      attendance_date,
      time_in,
      time_out,
      status,
      remarks,
      program_type
    FROM attendance_records
    WHERE user_id = ?
    ORDER BY attendance_date DESC
    LIMIT 30
  `;

  const [rows] = await db.execute(query, [userId]);
  return rows;
};

exports.getTodayAttendance = async (userId) => {
  await ensureAttendanceTable();

  const latestProgram = await getLatestProgram(userId);

  const query = `
    SELECT attendance_id, attendance_date, time_in, time_out, status, remarks, program_type
    FROM attendance_records
    WHERE user_id = ? AND attendance_date = CURDATE()
    LIMIT 1
  `;

  const [rows] = await db.execute(query, [userId]);
  return {
    attendance: rows[0] || null,
    programType: latestProgram ? latestProgram.program_type : null
  };
};

exports.timeIn = async (userId) => {
  await ensureAttendanceTable();

  const latestProgram = await getLatestProgram(userId);
  const programType = latestProgram ? latestProgram.program_type : null;

  const [existingRows] = await db.execute(
    'SELECT attendance_id, time_in, time_out FROM attendance_records WHERE user_id = ? AND attendance_date = CURDATE() LIMIT 1',
    [userId]
  );

  if (existingRows.length > 0 && existingRows[0].time_in) {
    const error = new Error('You have already timed in today.');
    error.statusCode = 409;
    throw error;
  }

  if (existingRows.length === 0) {
    const insertQuery = `
      INSERT INTO attendance_records (user_id, program_type, attendance_date, time_in, status, remarks)
      VALUES (?, ?, CURDATE(), NOW(), 'Incomplete', 'Timed in')
    `;

    await db.execute(insertQuery, [userId, programType]);
  } else {
    const updateQuery = `
      UPDATE attendance_records
      SET time_in = NOW(), status = 'Incomplete', remarks = 'Timed in', program_type = ?
      WHERE attendance_id = ?
    `;

    await db.execute(updateQuery, [programType, existingRows[0].attendance_id]);
  }

  return await exports.getTodayAttendance(userId);
};

exports.timeOut = async (userId) => {
  await ensureAttendanceTable();

  const latestProgram = await getLatestProgram(userId);
  const programType = latestProgram ? latestProgram.program_type : null;

  const [rows] = await db.execute(
    'SELECT attendance_id, time_in, time_out FROM attendance_records WHERE user_id = ? AND attendance_date = CURDATE() LIMIT 1',
    [userId]
  );

  if (rows.length === 0 || !rows[0].time_in) {
    const error = new Error('You must time in before timing out.');
    error.statusCode = 400;
    throw error;
  }

  if (rows[0].time_out) {
    const error = new Error('You have already timed out today.');
    error.statusCode = 409;
    throw error;
  }

  const query = `
    UPDATE attendance_records
    SET time_out = NOW(), status = 'Present', remarks = 'Completed attendance', program_type = ?
    WHERE attendance_id = ?
  `;

  await db.execute(query, [programType, rows[0].attendance_id]);

  return await exports.getTodayAttendance(userId);
};

exports.getMonitoringRecords = async (limit = 200) => {
  await ensureAttendanceTable();

  const safeLimit = Number(limit) > 0 ? Number(limit) : 200;
  const query = `
    SELECT
      ar.attendance_id,
      ar.user_id,
      ar.program_type,
      ar.attendance_date,
      ar.time_in,
      ar.time_out,
      ar.status,
      ar.remarks,
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.middle_name, b.last_name)), ''),
        u.user_name
      ) AS beneficiary_name
    FROM attendance_records ar
    LEFT JOIN users u ON u.user_id = ar.user_id
    LEFT JOIN beneficiaries b ON b.user_id = ar.user_id
    ORDER BY ar.attendance_date DESC, ar.attendance_id DESC
    LIMIT ?
  `;

  const [rows] = await db.execute(query, [safeLimit]);
  return rows;
};
