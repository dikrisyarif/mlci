import { initDb, getDb as getDbInstance, queueOperation } from './operations';
import { logDbOperation } from './monitor';

export const initDatabase = async () => {
  return await initDb();
};

// ---------------------------------------------------------------------------
// getDb — always returns the same initialized DB instance
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
// executeWithLog — queued query executor (NO nested transaction!)
// ---------------------------------------------------------------------------
export const executeWithLog = async (
  operation,
  sql,
  params = [],
  useTransaction = false,
  bypassQueue = false
) => {
  const runner = async () => {
    const db = await getDb();
    logDbOperation(operation, 'started', { sql, params });

    let result = null;
    if (useTransaction) {
      await db.execAsync('BEGIN TRANSACTION;');
      try {
        result = await db[operation](sql, params);
        await db.execAsync('COMMIT;');
      } catch (err) {
        await db.execAsync('ROLLBACK;');
        logDbOperation(operation, 'failed', { error: err.message });
        throw err;
      }
    } else {
      if (typeof db[operation] !== 'function') {
        throw new Error(`DB method '${operation}' not found`);
      }
      result = await db[operation](sql, params);
    }

    logDbOperation(operation, 'completed');
    return result;
  };

  // 🔥 Jika bypassQueue = true → jalankan langsung tanpa antre
  if (bypassQueue) {
    return runner();
  }

  // Default: lewat queueOperation
  return queueOperation(runner, `queue:${operation}:${sql}`);
};

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------
export const runQuery = (sql, params = []) =>
  executeWithLog('getAllAsync', sql, params);

export const runCommand = (sql, params = []) =>
  executeWithLog('runAsync', sql, params);

export const runGetFirst = (sql, params = []) =>
  executeWithLog('getFirstAsync', sql, params);

