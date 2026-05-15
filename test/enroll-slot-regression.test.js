const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const configPath = path.resolve(__dirname, '../config.js');

test('enrollBeneficiary increments program filled count only once', async () => {
  const executedSql = [];
  let filledCount = 2; // Initial filled count

  const fakeConnection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: async () => {},
    execute: async (sql, params) => {
      executedSql.push({ sql: String(sql), params });

      if (sql.toString().startsWith('SELECT application_id, user_id, status')) {
        return [[{
          application_id: 123,
          user_id: 42,
          status: 'Approved',
          program_type: 'tupad',
        }]];
      }

      if (sql.toString().includes('SELECT pe.enrollee_id') && sql.toString().includes('current_status = \'Active\'')) {
        return [[]]; // No active enrollments
      }

      if (sql.toString().includes('SELECT pe.enrollment_date') && sql.toString().includes('tupad')) {
        return [[]]; // No TUPAD history
      }

      if (sql.toString().startsWith('SELECT program_id, slots, filled')) {
        return [[{ program_id: 77, slots: 10, filled: filledCount }]];
      }

      if (sql.toString().includes('SELECT enrollee_id') && sql.toString().includes('WHERE application_id = ? AND program_id = ?')) {
        return [[]]; // Not already enrolled
      }

      if (sql.toString().startsWith('INSERT INTO program_enrollees')) {
        // Simulate trigger incrementing filled
        filledCount += 1;
        return [{ insertId: 999 }];
      }

      if (sql.toString().startsWith('UPDATE programs SET filled = filled + 1')) {
        // This should NOT be executed after our fix
        filledCount += 1;
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unexpected SQL executed: ${sql}`);
    },
  };

  const originalConfigCache = require.cache[configPath];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    exports: {
      getConnection: async () => fakeConnection,
    },
  };

  try {
    const beneficiaryService = require('../src/services/beneficiary.services');
    const result = await beneficiaryService.enrollBeneficiary(123, 77);

    // Check that enrollment succeeded
    assert.equal(result.enrolleeId, 999);
    assert.equal(result.applicationId, 123);
    assert.equal(result.programId, 77);

    // Check that filled was incremented only once (by trigger, not manual update)
    assert.equal(filledCount, 3); // Started at 2, incremented once to 3

    // Check that no manual UPDATE was executed
    const manualUpdates = executedSql.filter(sql =>
      sql.sql.startsWith('UPDATE programs SET filled = filled + 1')
    );
    assert.equal(manualUpdates.length, 0, 'Manual filled increment should not occur');

    // Check that INSERT was executed
    const inserts = executedSql.filter(sql =>
      sql.sql.startsWith('INSERT INTO program_enrollees')
    );
    assert.equal(inserts.length, 1);

  } finally {
    require.cache[configPath] = originalConfigCache;
  }
});