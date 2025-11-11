import { openDatabaseAsync } from 'expo-sqlite';
import { DB_CONFIG, wait } from './config';
import { logDbOperation, DB_MONITOR } from './monitor';

// ---------------------------------------------------------------------------
// GLOBAL STATE
// ---------------------------------------------------------------------------
let db = null;
let operationQueue = Promise.resolve();

// ---------------------------------------------------------------------------
// ADD ASYNC HELPERS TO DB INSTANCE
// ---------------------------------------------------------------------------
const extendDatabaseWithAsync = (db) => {
  if (db.execAsync && db.runAsync && db.getAllAsync && db.getFirstAsync) {
    return db;
  }

  db.execAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      try {
        db.exec(sql, params, (err, result) => {
          err ? reject(err) : resolve(result);
        });
      } catch (e) {
        reject(e);
      }
    });

  db.runAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      try {
        db.run(sql, params, (err) => {
          err ? reject(err) : resolve();
        });
      } catch (e) {
        reject(e);
      }
    });

  db.getAllAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      try {
        db.all(sql, params, (err, rows) => {
          err ? reject(err) : resolve(rows || []);
        });
      } catch (e) {
        reject(e);
      }
    });

  db.getFirstAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      try {
        db.get(sql, params, (err, row) => {
          err ? reject(err) : resolve(row);
        });
      } catch (e) {
        reject(e);
      }
    });

  return db;
};

// ---------------------------------------------------------------------------
// INIT DB — NO SELF-DESTRUCT, SAFE
// ---------------------------------------------------------------------------
export const initDb = async () => {
  try {
    if (!db || db._closed) {
      db = await openDatabaseAsync(DB_CONFIG.name);
      db = extendDatabaseWithAsync(db);

      if (db?._db?.filename) {
        console.log('[DB][initDb] Database path:', db._db.filename);
      }

      await db.execAsync('SELECT 1');

      // Enable WAL mode (optional)
      try {
        await db.execAsync('PRAGMA journal_mode = WAL;');
        await db.execAsync('PRAGMA synchronous = NORMAL;');
      } catch (_) {}

      logDbOperation('init-db', 'completed');
    }

    return db;
  } catch (e) {
    logDbOperation('init-db', 'failed', { error: e });
    throw e;
  }
};

// ---------------------------------------------------------------------------
// RETRY LOCK HANDLER — NO FORCE CLEANUP
// ---------------------------------------------------------------------------
const safeRetry = async (fn, description) => {
  let attempt = 0;

  while (attempt < DB_CONFIG.retries.max) {
    try {
      return await fn();
    } catch (error) {
      const msg = String(error?.message || "");

      // SQLite temp lock → retry after small delay
      if (msg.includes('database is locked')) {
        const delay = 150 + attempt * 150;
        logDbOperation(description, 'retry-lock', { attempt, delay });

        await wait(delay);
        attempt++;
        continue;
      }

      // Other error → throw langsung
      throw error;
    }
  }

  throw new Error(`DB locked after ${DB_CONFIG.retries.max} attempts`);
};

// ---------------------------------------------------------------------------
// GET DB INSTANCE — ALWAYS RETURNS SAME DB
// ---------------------------------------------------------------------------
export const getDb = async () => {
  try {
    if (!db || db._closed) {
      db = await initDb();
    }
    return db;
  } catch (e) {
    logDbOperation('get-db', 'failed', { error: e });
    throw e;
  }
};

// ---------------------------------------------------------------------------
// QUEUE OPERATION — SERIAL EXECUTION, SAFE
// ---------------------------------------------------------------------------
export const queueOperation = async (operation, description) => {
  const opId = `${description}-${Date.now()}`;
  logDbOperation(opId, 'queued');

  // Chain to queue
  operationQueue = operationQueue
    .catch(() => {}) // ignore previous error
    .then(async () => {
      logDbOperation(opId, 'starting');
      return safeRetry(operation, description);
    })
    .then((res) => {
      logDbOperation(opId, 'success');
      return res;
    })
    .catch((err) => {
      logDbOperation(opId, 'failed', { error: err });
      throw err;
    })
    .finally(() => {
      DB_MONITOR.operations.delete(opId);
    });

  return operationQueue;
};

// ---------------------------------------------------------------------------
// EXECUTE SQL — WITH QUEUE + RETRY
// ---------------------------------------------------------------------------
export const executeWithLog = async (
  operation,
  sql,
  params = [],
  useTransaction = false
) => {
  const db = await getDb();

  return queueOperation(async () => {
    logDbOperation(operation, 'started', { sql, params });

    let result;

    // TRANSACTION MODE (optional)
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
  }, `${operation}: ${sql}`);
};
