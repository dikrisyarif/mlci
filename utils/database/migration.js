import { DB_CONFIG } from "./config";
import { logDbOperation } from "./monitor";

export const migrateDatabase = async (db, oldVersion, newVersion) => {
  logDbOperation("migrate", "started", { oldVersion, newVersion });

  try {
    // Start atomic migration
    await db.execAsync("BEGIN TRANSACTION;");

    // -------------------------
    // background_tracks
    // -------------------------
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.background_tracks} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp TEXT NOT NULL,
        is_uploaded INTEGER DEFAULT 0,
        employee_name TEXT NOT NULL
      );
    `);

    // -------------------------
    // contract_checkins
    // -------------------------
    // Create table if not exists
    await db.execAsync(`
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

    // Add 'address' column if it doesn't exist (patch for old users)
    const columns = await db.getAllAsync(`PRAGMA table_info(${DB_CONFIG.tables.contract_checkins});`);
    const hasAddress = columns.some(c => c.name === "address");
    if (!hasAddress) {
      console.log("[MIGRATION] Adding 'address' column to contract_checkins...");
      await db.execAsync(`ALTER TABLE ${DB_CONFIG.tables.contract_checkins} ADD COLUMN address TEXT;`);
    }

    // -------------------------
    // contracts
    // -------------------------
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.contracts} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_data TEXT,
        employee_name TEXT
      );
    `);

    // -------------------------
    // app_state
    // -------------------------
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.app_state} (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // -------------------------
    // metadata
    // -------------------------
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${DB_CONFIG.tables.metadata} (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Commit atomic migration
    await db.execAsync("COMMIT;");
    logDbOperation("migrate", "completed");
    console.log("[MIGRATION] Database migration successful.");

  } catch (error) {
    // Safety rollback
    try {
      await db.execAsync("ROLLBACK;");
    } catch {}

    logDbOperation("migrate", "failed", { error });
    // console.error("[MIGRATION] Database migration failed:", error);
    throw error;
  }
};

// Helper
export const isSameDay = (d1, d2) => {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};
