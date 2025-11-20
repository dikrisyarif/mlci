import { executeWithLog } from "./core";

export const resetDatabase = async () => {
  console.log("[DB][reset] 🚀 Executing reset operation...");

  try {
    // STEP 1: Drop all tables to ensure clean schema
    console.log("[DB][reset] Step 1: Dropping existing tables...");
    await executeWithLog(
      "runAsync",
      "DROP TABLE IF EXISTS contracts;",
      [],
      false,
      true
    );
    await executeWithLog(
      "runAsync",
      "DROP TABLE IF EXISTS contract_checkins;",
      [],
      false,
      true
    );
    await executeWithLog(
      "runAsync",
      "DROP TABLE IF EXISTS background_tracks;",
      [],
      false,
      true
    );
    await executeWithLog(
      "runAsync",
      "DROP TABLE IF EXISTS app_state;",
      [],
      false,
      true
    );
    console.log("[DB][reset] Step 1 done ✅");

    // STEP 2: Recreate fresh tables
    console.log("[DB][reset] Step 2: Recreating tables...");
    await executeWithLog(
      "runAsync",
      `
      CREATE TABLE contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_data TEXT,
        employee_name TEXT
      );
    `
    );

    await executeWithLog(
      "runAsync",
      `
  CREATE TABLE contract_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lease_no TEXT,
    employee_name TEXT,
    latitude REAL,
    longitude REAL,
    timestamp TEXT,
    comment TEXT,
    address TEXT,
    is_uploaded INTEGER DEFAULT 0
  );
`
    );

    await executeWithLog(
      "runAsync",
      `
      CREATE TABLE background_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL,
        longitude REAL,
        timestamp TEXT,
        employee_name TEXT,
        is_uploaded INTEGER DEFAULT 0
      );
    `
    );

    await executeWithLog(
      "runAsync",
      `
      CREATE TABLE app_state (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `
    );
    console.log("[DB][reset] Step 2 done ✅");

    // STEP 3: Vacuum to ensure clean file
    console.log("[DB][reset] Step 3: Vacuum (optimize DB file)...");
    await executeWithLog("runAsync", "VACUUM;");
    console.log("[DB][reset] Step 3 done ✅");

    console.log("[DB][reset] ✅ Finished reset operation!");
    return true;
  } catch (error) {
    console.error("[DB][reset] ❌ Error resetting database:", error);
    throw error;
  }
};
