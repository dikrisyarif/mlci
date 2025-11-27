import { openDatabaseAsync } from 'expo-sqlite';
import { DB_CONFIG, wait } from './config';
import { logDbOperation, DB_MONITOR } from './monitor';
import { migrateDatabase } from './migration';

// ---------------------------------------------------------------------------
// GLOBAL STATE
// ---------------------------------------------------------------------------
let db = null;
let operationQueue = Promise.resolve();

// ---------------------------------------------------------------------------
// EXTEND ASYNC HELPERS IF NEEDED
// ---------------------------------------------------------------------------
const extendDatabaseWithAsync = (dbInstance) => {
  if (!dbInstance) return dbInstance;

  const hasExecAsync = typeof dbInstance.execAsync === "function";
  const hasRunAsync = typeof dbInstance.runAsync === "function";
  const hasGetAllAsync = typeof dbInstance.getAllAsync === "function";
  const hasGetFirstAsync = typeof dbInstance.getFirstAsync === "function";

  if (hasExecAsync && hasRunAsync && hasGetAllAsync && hasGetFirstAsync) {
    return dbInstance;
  }

  try {
    if (!hasExecAsync && typeof dbInstance.exec === "function") {
      dbInstance.execAsync = (sql, params = []) =>
        new Promise((resolve, reject) => {
          dbInstance.exec(sql, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
    }

    if (!hasRunAsync && typeof dbInstance.run === "function") {
      dbInstance.runAsync = (sql, params = []) =>
        new Promise((resolve, reject) => {
          dbInstance.run(sql, params, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
    }

    if (!hasGetAllAsync && typeof dbInstance.all === "function") {
      dbInstance.getAllAsync = (sql, params = []) =>
        new Promise((resolve, reject) => {
          dbInstance.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
    }

    if (!hasGetFirstAsync && typeof dbInstance.get === "function") {
      dbInstance.getFirstAsync = (sql, params = []) =>
        new Promise((resolve, reject) => {
          dbInstance.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
    }
  } catch (err) {
    console.warn("[DB][extend] Failed to add async wrappers:", err);
  }

  return dbInstance;
};

// ---------------------------------------------------------------------------
// INIT DB (WAL mode, single instance)
// ---------------------------------------------------------------------------
export const initDb = async () => {
  try {
    if (!db || db._closed) {
      db = await openDatabaseAsync(DB_CONFIG.name);
      db = extendDatabaseWithAsync(db);

      await db.execAsync("SELECT 1");

      try {
        await db.execAsync("PRAGMA journal_mode = WAL;");
        await db.execAsync("PRAGMA synchronous = NORMAL;");
      } catch (_) {}

      // Run migrations to ensure all tables exist
      try {
        await migrateDatabase(db, 0, DB_CONFIG.version);
      } catch (mErr) {
        console.warn('[DB][migration] Migration warning:', mErr?.message || mErr);
      }

      logDbOperation("init-db", "completed");
    }

    return db;
  } catch (e) {
    logDbOperation("init-db", "failed", { error: e });
    throw e;
  }
};

// ---------------------------------------------------------------------------
// GET DB INSTANCE
// ---------------------------------------------------------------------------
export const getDb = async () => {
  if (!db || db._closed) {
    return initDb();
  }
  return db;
};

// ---------------------------------------------------------------------------
// SAFE RETRY FOR LOCKED DB
// ---------------------------------------------------------------------------
const safeRetry = async (fn, description) => {
  let attempt = 0;

  while (attempt < DB_CONFIG.retries.max) {
    try {
      return await fn();
    } catch (error) {
      const msg = String(error?.message || "");

      if (msg.includes("database is locked")) {
        const delay = 150 + attempt * 150;
        logDbOperation(description, "retry-lock", { attempt, delay });
        await wait(delay);
        attempt++;
        continue;
      }

      throw error;
    }
  }

  throw new Error(`DB locked after ${DB_CONFIG.retries.max} attempts`);
};

// ---------------------------------------------------------------------------
// QUEUE OPERATION — SERIAL, RETURNS LOCAL PROMISE (FIXED)
// ---------------------------------------------------------------------------
export const queueOperation = (operation, description = "operation") => {
  const opId = `${description}-${Date.now()}`;

  let localResolve, localReject;
  const promiseReturn = new Promise((res, rej) => {
    localResolve = res;
    localReject = rej;
  });

  operationQueue = operationQueue
    .catch(() => {})
    .then(async () => {
      logDbOperation(opId, "starting");
      return safeRetry(operation, description);
    })
    .then((result) => {
      logDbOperation(opId, "success");
      localResolve(result);
    })
    .catch((err) => {
      logDbOperation(opId, "failed", { error: err });
      localReject(err);
    })
    .finally(() => {
      DB_MONITOR.operations.delete(opId);
    });

  return promiseReturn;
};

