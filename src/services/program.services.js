const db = require('../../config');

// create new program
exports.createProgram = async (program) => {
  const { name, location, slots, budget, status } = program;
  const query = `
    INSERT INTO programs (program_name, location, slots, budget, status, filled, used)
    VALUES (?, ?, ?, ?, ?, 0, 0)
  `;
  const [result] = await db.execute(query, [name, location, slots, budget, status]);
  return result;
};

exports.getAllPrograms = async () => {
  const query = 'SELECT * FROM programs ORDER BY program_id DESC';
  const [rows] = await db.execute(query);
  return rows;
};

exports.getProgramsWithBeneficiaries = async () => {
  const query = `
    SELECT 
        p.program_id,
        p.program_name,
        p.location,
        p.slots,
        p.filled,
        p.budget,
        p.used,
        p.status,
        COUNT(CASE WHEN a.status = 'Approved' THEN 1 END) as approved_count
    FROM programs p
    LEFT JOIN applications a ON p.program_name = a.program_type
    GROUP BY p.program_id, p.program_name, p.location, p.slots, p.filled, p.budget, p.used, p.status
    ORDER BY p.program_id DESC
  `;
  const [rows] = await db.execute(query);
  return rows;
};

exports.getProgramById = async (program_id) => {
  const query = 'SELECT * FROM programs WHERE program_id = ?';
  const [rows] = await db.execute(query, [program_id]);
  return rows;
};

exports.updateProgram = async (program_id, updated) => {
  const { name, location, slots, budget, status } = updated;
  const query = `
    UPDATE programs 
    SET program_name = ?, location = ?, slots = ?, budget = ?, status = ?
    WHERE program_id = ?
  `;
  const [result] = await db.execute(query, [name, location, slots, budget, status, program_id]);
  return result;
};

exports.deleteProgram = async (program_id) => {
  const query = 'DELETE FROM programs WHERE program_id = ?';
  const [result] = await db.execute(query, [program_id]);
  return result;
};