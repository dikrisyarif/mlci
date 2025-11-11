import { DB_CONFIG } from './config';
import { logDbOperation } from './monitor';
import { 
  initDb, 
  getDb, 
  queueOperation, 
  executeWithLog,
  forceCleanupDatabase
} from './operations';
import { migrateDatabase, isSameDay } from './migration';

// Initialize database and create tables
export const initDatabase = async () => {
  logDbOperation('init', 'started');
  
  try {
    // Initialize database and ensure it has async methods
    const db = await initDb();
    if (!db) {
      throw new Error('Failed to initialize database');
    }

    // Verify database is working before proceeding
    await db.execAsync('SELECT 1');
    
    // Check current version
    const versionResult = await queueOperation(async () => {
      const result = await db.getFirstAsync(
        'SELECT value FROM metadata WHERE key = ?',
        ['db_version']
      );
      return result;
    }, 'Get database version');

    const currentVersion = versionResult ? parseInt(versionResult.value, 10) : 0;

    // Migrate if needed
    if (currentVersion !== DB_CONFIG.version) {
      await migrateDatabase(db, currentVersion, DB_CONFIG.version);
      await queueOperation(async () => {
        await db.runAsync(
          'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
          ['db_version', DB_CONFIG.version.toString()]
        );
      }, 'Update database version');
    }
    
    logDbOperation('init', 'completed');
    return db;
  } catch (error) {
    logDbOperation('init', 'failed', { error });
    throw error;
  }
};

// Reset database
export const resetDatabase = async () => {
  logDbOperation('reset', 'started');
  
  try {
    await forceCleanupDatabase();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const db = await initDb();
    const today = new Date().toISOString().split('T')[0];


    // Clear ALL data from all tables (no restore)
    await queueOperation(async () => {
      const tables = [
        DB_CONFIG.tables.background_tracks,
        DB_CONFIG.tables.contract_checkins,
        DB_CONFIG.tables.contracts,
        DB_CONFIG.tables.app_state,
        DB_CONFIG.tables.metadata
      ];
      for (const table of tables) {
        logDbOperation('reset', `clearing-${table}`);
        await db.execAsync(`DELETE FROM ${table};`);
      }
    }, 'Clear all data');

    // Reinitialize structure
    await migrateDatabase(db, 0, DB_CONFIG.version);

    // Get final stats
    const [tracksCount, checkinsCount, contractsCount] = await Promise.all([
      queueOperation(async () => {
        return await db.getFirstAsync('SELECT COUNT(*) as count FROM background_tracks;');
      }, 'Count remaining tracks'),
      queueOperation(async () => {
        return await db.getFirstAsync('SELECT COUNT(*) as count FROM contract_checkins;');
      }, 'Count remaining check-ins'),
      queueOperation(async () => {
        return await db.getFirstAsync('SELECT COUNT(*) as count FROM contracts;');
      }, 'Count remaining contracts')
    ]);

    logDbOperation('reset', 'completed', {
      stats: {
        remainingTracks: tracksCount?.count || 0,
        remainingCheckins: checkinsCount?.count || 0,
        remainingContracts: contractsCount?.count || 0
      }
    });
    return true;
  } catch (error) {
    logDbOperation('reset', 'failed', { error });
    throw error;
  }
};

// Export all needed functions
export {
  getDb,
  executeWithLog,
  forceCleanupDatabase
};