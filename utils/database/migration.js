import { DB_CONFIG } from './config';
import { queueOperation } from './operations';
import { logDbOperation } from './monitor';

export const migrateDatabase = async (dbInstance, oldVersion, newVersion) => {
  logDbOperation('migrate', 'started', { oldVersion, newVersion });

  try {
    // Create background_tracks table
    await queueOperation(async () => {
      await dbInstance.execAsync(`
        CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.background_tracks} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          timestamp TEXT NOT NULL,
          is_uploaded INTEGER DEFAULT 0,
          employee_name TEXT NOT NULL
        );
      `);
    }, 'Create background_tracks table');

    // Create contract_checkins table
    await queueOperation(async () => {
      await dbInstance.execAsync(`
        CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.contract_checkins} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lease_no TEXT NOT NULL,
          employee_name TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          timestamp TEXT NOT NULL,
          comment TEXT,
          is_uploaded INTEGER DEFAULT 0
        );
      `);
    }, 'Create contract_checkins table');

    // Create contracts table
    await queueOperation(async () => {
      await dbInstance.execAsync(`
        CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.contracts} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract_data TEXT,
          employee_name TEXT
        );
      `);
    }, 'Create contracts table');

    // Create app_state table
    await queueOperation(async () => {
      await dbInstance.execAsync(`
        CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.app_state} (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
    }, 'Create app_state table');

    // Create metadata table if not exists
    await queueOperation(async () => {
      await dbInstance.execAsync(`
        CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.metadata} (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);
    }, 'Create metadata table');

    logDbOperation('migrate', 'completed');
  } catch (error) {
    logDbOperation('migrate', 'failed', { error });
    throw error;
  }
};

// Helper function to check if data is from same day
export const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};