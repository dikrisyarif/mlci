import { openDatabaseAsync } from 'expo-sqlite';
import { DB_CONFIG, wait } from './config';
import { logDbOperation, DB_MONITOR } from './monitor';

// Global database instance
let db = null;

// Queue for serializing database operations
let operationQueue = Promise.resolve();

// Add async methods to database
const extendDatabaseWithAsync = (db) => {
  // Return if the database is already extended
  if (db.execAsync && db.runAsync && db.getAllAsync && db.getFirstAsync) {
    return db;
  }

  // Promisify exec
  if (!db.execAsync) {
    db.execAsync = async (sql, params = []) => {
      return new Promise((resolve, reject) => {
        try {
          db.exec(sql, params, (error, resultSet) => {
            if (error) reject(error);
            else resolve(resultSet);
          });
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  // Promisify run
  if (!db.runAsync) {
    db.runAsync = async (sql, params = []) => {
      return new Promise((resolve, reject) => {
        try {
          db.run(sql, params, (error) => {
            if (error) reject(error);
            else resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  // Promisify getAll (all)
  if (!db.getAllAsync) {
    db.getAllAsync = async (sql, params = []) => {
      return new Promise((resolve, reject) => {
        try {
          db.all(sql, params, (error, rows) => {
            if (error) reject(error);
            else resolve(rows || []);
          });
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  // Promisify getFirst (get)
  if (!db.getFirstAsync) {
    db.getFirstAsync = async (sql, params = []) => {
      return new Promise((resolve, reject) => {
        try {
          db.get(sql, params, (error, row) => {
            if (error) reject(error);
            else resolve(row);
          });
        } catch (error) {
          reject(error);
        }
      });
    };
  }

  return db;
};

// Initialize database instance
export const initDb = async () => {
  try {
    if (!db) {
      db = await openDatabaseAsync(DB_CONFIG.name);
      if (!db) {
        throw new Error('Failed to open database');
      }
      db = extendDatabaseWithAsync(db);
      // Verify the database is working
      await db.execAsync('SELECT 1');
      logDbOperation('init-db', 'completed');
    } else if (db._closed) {
      // If database was closed, reopen it
      db = await openDatabaseAsync(DB_CONFIG.name);
      db = extendDatabaseWithAsync(db);
      await db.execAsync('SELECT 1');
      logDbOperation('init-db', 'reopened');
    }
    return db;
  } catch (error) {
    logDbOperation('init-db', 'failed', { error });
    throw error;
  }
};

// Helper to check database health
export const checkDatabaseHealth = async () => {
  try {
    if (!db || db._closed) {
      logDbOperation('health-check', 'failed', { error: new Error('Database not connected') });
      return false;
    }
    
    await db.execAsync('SELECT 1');
    logDbOperation('health-check', 'completed');
    return true;
  } catch (error) {
    logDbOperation('health-check', 'failed', { error });
    return false;
  }
};

// Force cleanup function for locked database
export const forceCleanupDatabase = async () => {
  logDbOperation('force-cleanup', 'started');
  
  try {
    if (db) {
      try {
        await db.closeAsync();
        logDbOperation('force-cleanup', 'closed-connection');
      } catch (error) {
        logDbOperation('force-cleanup', 'close-failed', { error });
      }
    }
    
    db = null;
    await wait(2000);
    
    db = await openDatabaseAsync(DB_CONFIG.name);
    db = extendDatabaseWithAsync(db);
    await db.execAsync('SELECT 1');
    
    logDbOperation('force-cleanup', 'completed');
    return true;
  } catch (error) {
    logDbOperation('force-cleanup', 'failed', { error });
    throw new Error(`Force cleanup failed: ${error.message}`);
  }
};

// Get database instance
export const getDb = async () => {
  try {
    if (!db || db._closed) {
      logDbOperation('get-db', 'initializing');
      db = await initDb();
    }
    
    // Double check the database methods exist
    if (!db.getAllAsync || !db.getFirstAsync || !db.runAsync || !db.execAsync) {
      logDbOperation('get-db', 'extending-methods');
      db = extendDatabaseWithAsync(db);
    }
    
    // Verify database is working
    await db.execAsync('SELECT 1');
    return db;
  } catch (error) {
    logDbOperation('get-db', 'failed', { error });
    // If there's an error, try to force cleanup and reinitialize
    try {
      await forceCleanupDatabase();
      return db;
    } catch (cleanupError) {
      logDbOperation('get-db', 'cleanup-failed', { error: cleanupError });
      throw cleanupError;
    }
  }
};

// Execute SQL with logging and transaction support
export const executeWithLog = async (operation, sql, params = [], useTransaction = false) => {
  try {
    // Ensure we have a working database connection
    const tempDb = await getDb();
    if (!tempDb) {
      throw new Error('Failed to get database connection');
    }

    return await queueOperation(async () => {
      logDbOperation(operation, 'started', { sql, params, useTransaction });
      
      try {
        let result;
        
        if (useTransaction) {
          let transactionCompleted = false;
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              if (!transactionCompleted) {
                reject(new Error('Transaction timeout exceeded'));
              }
            }, DB_CONFIG.transaction.timeout);
          });

          try {
            await tempDb.execAsync('BEGIN TRANSACTION;');
            result = await Promise.race([
              tempDb[operation](sql, params),
              timeoutPromise
            ]);
            await tempDb.execAsync('COMMIT;');
            transactionCompleted = true;
            logDbOperation(operation, 'committed');
          } catch (error) {
            try {
              await tempDb.execAsync('ROLLBACK;');
              logDbOperation(operation, 'rolled-back', { error });
            } catch (rollbackError) {
              logDbOperation(operation, 'rollback-failed', { error: rollbackError });
            }
            throw error;
          }
        } else {
          if (typeof tempDb[operation] !== 'function') {
            throw new Error(`Operation '${operation}' is not a function`);
          }
          result = await tempDb[operation](sql, params);
        }
        
        logDbOperation(operation, 'completed');
        return result;
      } catch (error) {
        logDbOperation(operation, 'failed', { sql, params, error });
        
        if (error.message.includes('database is locked')) {
          try {
            await forceCleanupDatabase();
          } catch (cleanupError) {
            logDbOperation(operation, 'recovery-failed', { error: cleanupError });
          }
        }
        
        throw error;
      }
    }, `${operation} - ${sql}`);
  } catch (error) {
    logDbOperation('execute', 'critical-failure', { operation, sql, error });
    throw error;
  }
};

// Helper function for retrying operations
const retryWithBackoff = async (operation, description) => {
  let lastError;
  
  for (let attempt = 0; attempt < DB_CONFIG.retries.max; attempt++) {
    try {
      if (!await checkDatabaseHealth()) {
        await forceCleanupDatabase();
      }
      
      logDbOperation(description, 'started');
      const result = await operation();
      logDbOperation(description, 'completed');
      return result;
    } catch (error) {
      lastError = error;
      logDbOperation(description, 'failed', { error, attempt });
      
      if (!error.message.includes('database is locked') || attempt === DB_CONFIG.retries.max - 1) {
        throw error;
      }
      
      const delay = Math.min(
        DB_CONFIG.retries.baseDelay * Math.pow(2, attempt),
        DB_CONFIG.retries.maxDelay
      );
      
      logDbOperation(description, 'retrying', { 
        attempt: attempt + 1, 
        maxAttempts: DB_CONFIG.retries.max, 
        delay 
      });
      
      await wait(delay);
      
      if (attempt > 1) {
        try {
          await forceCleanupDatabase();
        } catch (cleanupError) {
          logDbOperation(description, 'cleanup-failed', { error: cleanupError });
        }
      }
    }
  }
  
  throw lastError;
};

// Queue operations to prevent concurrent access
export const queueOperation = async (operation, description) => {
  const operationId = `${description}-${Date.now()}`;
  logDbOperation(operationId, 'queued');
  
  try {
    if (!await checkDatabaseHealth()) {
      await forceCleanupDatabase();
    }
    
    if (operationQueue) {
      try {
        await operationQueue;
      } catch (error) {
        logDbOperation(operationId, 'previous-operation-failed', { error });
      }
    }
    
    operationQueue = (async () => {
      try {
        logDbOperation(operationId, 'starting');
        const result = await retryWithBackoff(operation, description);
        logDbOperation(operationId, 'success');
        return result;
      } catch (error) {
        logDbOperation(operationId, 'failed', { error });
        
        if (error.message.includes('database is locked') || 
            error.message.includes('not initialized')) {
          try {
            await forceCleanupDatabase();
          } catch (cleanupError) {
            logDbOperation(operationId, 'recovery-failed', { error: cleanupError });
          }
        }
        
        throw error;
      } finally {
        DB_MONITOR.operations.delete(operationId);
      }
    })();
    
    return await operationQueue;
  } catch (error) {
    logDbOperation(operationId, 'final-failure', { error });
    throw error;
  }
};