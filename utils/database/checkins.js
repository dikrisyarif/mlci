import { executeWithLog } from './core';

// -------------------------------------------------------------
// ADD CHECKIN (SAFE + TRANSACTION + DUPLICATE CHECK + ADDRESS)
// -------------------------------------------------------------
export const addCheckin = async (checkinData) => {
  const { lease_no, employee_name, latitude, longitude, timestamp, comment, address } = checkinData;

  try {
    // check duplicate by lease_no, employee, date, timestamp
    const sqlCheck = `
      SELECT id 
      FROM contract_checkins
      WHERE lease_no = ?
        AND lease_no != '_tracking_'
        AND employee_name = ?
        AND date(timestamp) = date(?)
        AND timestamp = ?
      LIMIT 1;
    `;
    const existing = await executeWithLog('getFirstAsync', sqlCheck, [lease_no, employee_name, timestamp, timestamp]);
    if (existing) {
      console.log(`[CHECKIN] Duplicate checkin detected, skipping: lease_no=${lease_no}, ts=${timestamp}`);
      return null;
    }

    const sql = `
      INSERT INTO contract_checkins (
        lease_no, employee_name, latitude, longitude, timestamp, comment, address, is_uploaded
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0);
    `;

    const params = [
      lease_no,
      employee_name,
      latitude,
      longitude,
      timestamp,
      comment || '',
      address || ''
    ];

    const result = await executeWithLog('runAsync', sql, params, true);
    console.log(`[CHECKIN] Added new checkin: id=${result?.lastInsertRowId}`);
    return result?.lastInsertRowId || null;

  } catch (err) {
    if (String(err.message).includes('no such table')) {
      console.warn('[CHECKIN] Table not ready (DB reset). Skip addCheckin');
      return null;
    }
    // console.error('[Database] Error saving check-in:', err);
    throw err;
  }
};

// -------------------------------------------------------------
// ADD CHECKIN START/STOP (SAFE)
// -------------------------------------------------------------
export const addCheckinStartStop = async (data) => {
  const { employee_name, type, latitude, longitude, timestamp } = data;

  try {
    console.log(`[CHECKIN STARTSTOP] addCheckinStartStop called with:`, {
      employee_name,
      type,
      latitude,
      longitude,
      timestamp,
    });
    // normalize timestamp to an ISO string; fallback to now if invalid/missing
    let safeTimestamp;
    try {
      if (!timestamp) {
        safeTimestamp = new Date().toISOString();
      } else if (typeof timestamp === 'number') {
        safeTimestamp = new Date(timestamp).toISOString();
      } else {
        const parsed = Date.parse(String(timestamp));
        safeTimestamp = isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
      }
    } catch (e) {
      safeTimestamp = new Date().toISOString();
    }
    // optional duplicate protection:
    // - only block duplicates if same employee + same type + same timestamp
    const sqlCheck = `
      SELECT id
      FROM checkin_startstop
      WHERE employee_name = ?
        AND type = ?
        AND timestamp = ?
      LIMIT 1;
    `;

    const existing = await executeWithLog(
      "getFirstAsync",
      sqlCheck,
      [employee_name, type, safeTimestamp]
    );

    if (existing) {
      console.log(
        `[CHECKIN STARTSTOP] Duplicate detected, skip. employee=${employee_name}, type=${type}, ts=${timestamp}`
      );
      return null;
    }

    const sql = `
      INSERT INTO checkin_startstop (
        employee_name, type, latitude, longitude, timestamp, is_uploaded
      ) VALUES (?, ?, ?, ?, ?, 0);
    `;

    const params = [
      employee_name,
      type,         // "start" | "stop"
      latitude || null,
      longitude || null,
      safeTimestamp,
    ];

    console.log('[CHECKIN STARTSTOP] Insert SQL:', sql.trim(), 'params:', params);

    const result = await executeWithLog("runAsync", sql, params, true);
    console.log(
      `[CHECKIN STARTSTOP] Added: id=${result?.lastInsertRowId}, type=${type}`,
      { result }
    );

    return result?.lastInsertRowId || null;
  } catch (err) {
    if (String(err.message).includes("no such table")) {
      console.warn("[CHECKIN STARTSTOP] Table not ready (DB reset). Skip.");
      return null;
    }
    throw err;
  }
};


// -------------------------------------------------------------
// GET UNUPLOADED CHECKINS (SAFE)
// -------------------------------------------------------------
export const getUnuploadedCheckins = async () => {
  try {
    const sql = `
      SELECT * 
      FROM contract_checkins 
      WHERE is_uploaded = 0 
      ORDER BY timestamp ASC;
    `;
    return await executeWithLog('getAllAsync', sql, []);

  } catch (err) {
    if (String(err.message).includes('no such table')) {
      console.warn('[CHECKIN] Table missing (reset). Return empty.');
      return [];
    }
    // console.error('[Database] Error getting unuploaded check-ins:', err);
    throw err;
  }
};

export const getUnuploadedCheckinsForEmployee = async (employeeName) => {
  try {
    const sql = `
      SELECT * 
      FROM contract_checkins 
      WHERE is_uploaded = 0 AND employee_name = ?
      ORDER BY timestamp ASC;
    `;
    return await executeWithLog('getAllAsync', sql, [employeeName]);
  } catch (err) {
    if (String(err.message).includes('no such table')) {
      console.warn('[CHECKIN] Table missing (reset). Return empty.');
      return [];
    }
    throw err;
  }
};


// -------------------------------------------------------------
// CHECK IF CONTRACT CHECKED IN (SAFE)
// -------------------------------------------------------------
export const isContractCheckedIn = async (leaseNo, employeeName) => {
  try {
    if (leaseNo === '_tracking_') return false;

    const today = new Date().toISOString().split('T')[0];

    const sql = `
      SELECT id 
      FROM contract_checkins
      WHERE lease_no = ?
        AND lease_no != '_tracking_'
        AND employee_name = ?
        AND date(timestamp) = date(?)
      LIMIT 1;
    `;

    const row = await executeWithLog(
      'getFirstAsync',
      sql,
      [leaseNo, employeeName, today]
    );

    return row !== null;

  } catch (err) {
    if (String(err.message).includes('no such table')) {
      console.warn('[CHECKIN] Table missing (reset). Assume NOT checked in.');
      return false;
    }
    // console.error('[Database] Error checking contract check-in status:', err);
    throw err;
  }
};


// -------------------------------------------------------------
// MARK CHECKIN AS UPLOADED (SAFE)
// -------------------------------------------------------------
export const markCheckinAsUploaded = async (id) => {
  try {
    const sql = `UPDATE contract_checkins SET is_uploaded = 1 WHERE id = ?;`;
    await executeWithLog('runAsync', sql, [id]);
    return true;

  } catch (err) {
    if (String(err.message).includes('no such table')) {
      console.warn('[CHECKIN] Table gone during reset. Skip mark uploaded.');
      return false;
    }
    // console.error('[Database] Error marking check-in as uploaded:', err);
    throw err;
  }
};


// -------------------------------------------------------------
// GET CHECKIN DETAILS (SAFE)
// -------------------------------------------------------------
export const getContractCheckinDetails = async (leaseNo, employeeName) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const sql = `
      SELECT id, lease_no, employee_name, latitude, longitude,
             timestamp, comment, is_uploaded
      FROM contract_checkins 
      WHERE lease_no = ?
        AND employee_name = ?
        AND date(timestamp) = date(?);
    `;

    return await executeWithLog(
      'getFirstAsync',
      sql,
      [leaseNo, employeeName, today]
    );

  } catch (err) {
    if (String(err.message).includes('no such table')) {
      console.warn('[CHECKIN] Table missing (reset). Return null.');
      return null;
    }
    // console.error('[Database] Error getting contract check-in details:', err);
    throw err;
  }
};
