const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const configPath = path.resolve(__dirname, '../config.js');

test('approveTupadApplication does not increment program filled count on approval', async () => {
  const executedSql = [];
  const fakeConnection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: async () => {},
    execute: async (sql, params) => {
      executedSql.push({ sql: String(sql), params });

      if (sql.toString().startsWith('SELECT application_id')) {
        return [[{
          application_id: 123,
          user_id: 42,
          status: 'Pending',
          program_type: 'tupad',
          program_id: 77,
        }]];
      }

      if (sql.toString().startsWith('UPDATE applications SET status')) {
        return [{ affectedRows: 1 }];
      }

      if (sql.toString().startsWith('UPDATE beneficiaries SET is_active')) {
        return [{ affectedRows: 1 }];
      }

      if (sql.toString().startsWith('SELECT program_id, slots, filled')) {
        return [[{ program_id: 77, slots: 10, filled: 2 }]];
      }

      if (sql.toString().startsWith('INSERT INTO notifications')) {
        return [{ affectedRows: 1 }];
      }

      throw new Error(`Unexpected SQL executed: ${sql}`);
    },
  };

  const originalConfigCache = require.cache[configPath];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { getConnection: async () => fakeConnection },
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true });

  try {
    delete require.cache[require.resolve('../src/services/tupad.services.js')];
    const tupadService = require('../src/services/tupad.services.js');

    await tupadService.approveTupadApplication(123);

    const filledUpdateExecuted = executedSql.some((item) =>
      item.sql.includes('SET filled = filled + 1') ||
      item.sql.includes('UPDATE programs') && item.sql.includes('filled + 1')
    );

    assert.strictEqual(filledUpdateExecuted, false, 'Approval must not increment filled slots');
    assert.ok(executedSql.some((item) => item.sql.includes('UPDATE beneficiaries SET is_active')),
      'Approval should still activate the beneficiary');
  } finally {
    if (originalConfigCache) {
      require.cache[configPath] = originalConfigCache;
    } else {
      delete require.cache[configPath];
    }
    global.fetch = originalFetch;
  }
});
