import { initDb, getDb as getDbInstance, queueOperation } from './operations';
import { logDbOperation } from './monitor';

// ---------------------------------------------------------------------------
// getDb — always returns the same initialized DB
// ---------------------------------------------------------------------------
export const getDb = async () => {
  try {
    const db = await getDbInstance();
    return db;
  } catch (e) {
    logDbOperation('getDb', 'failed', { error: e });
    throw e;
  }
};

// ---------------------------------------------------------------------------
// execute SQL helpers — routed via queueOperation
// ---------------------------------------------------------------------------
export const executeWithLog = async (
  operation,
  sql,
  params = [],
  useTransaction = false
) => {
  return queueOperation(
    async () => {
      const db = await getDb();

      logDbOperation(operation, 'started', { sql, params });

      let result;

      if (useTransaction) {
        await db.execAsync('BEGIN;');
        try {
          result = await db[operation](sql, params);
          await db.execAsync('COMMIT;');
        } catch (err) {
          await db.execAsync('ROLLBACK;');
          throw err;
        }
      } else {
        result = await db[operation](sql, params);
      }

      logDbOperation(operation, 'completed');
      return result;
    },
    `${operation}: ${sql}`
  );
};

// ---------------------------------------------------------------------------
// runQuery helper (SELECT returning rows)
// ---------------------------------------------------------------------------
export const runQuery = async (sql, params = []) => {
  return executeWithLog('getAllAsync', sql, params);
};

// ---------------------------------------------------------------------------
// runCommand helper (INSERT / UPDATE / DELETE)
// ---------------------------------------------------------------------------
export const runCommand = async (sql, params = []) => {
  return executeWithLog('runAsync', sql, params);
};

// ---------------------------------------------------------------------------
// runGetFirst helper (SELECT returning one row)
// ---------------------------------------------------------------------------
export const runGetFirst = async (sql, params = []) => {
  return executeWithLog('getFirstAsync', sql, params);
};

