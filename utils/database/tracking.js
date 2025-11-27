import { executeWithLog } from './core';

/**
 * Save background location safely, prevent duplicates
 */
export const saveBackgroundLocation = async (location, employeeName) => {
  const { latitude, longitude, timestamp } = location; // gunakan timestamp dari service
  try {
    // Cek duplicate by timestamp + lat/lng
    const sqlCheck = `
      SELECT id FROM background_tracks
      WHERE employee_name = ? AND timestamp = ? 
        AND latitude = ? AND longitude = ?
      LIMIT 1;
    `;
    const existing = await executeWithLog('getFirstAsync', sqlCheck, [employeeName, timestamp, latitude, longitude]);
    if (existing) {
      // console.log(`[TRACKING] Duplicate location detected, skipping: ts=${timestamp}`);
      return null;
    }

    const sql = `
      INSERT INTO background_tracks (latitude, longitude, timestamp, employee_name, is_uploaded)
      VALUES (?, ?, ?, ?, 0);
    `;
    const params = [latitude, longitude, timestamp, employeeName];
    const result = await executeWithLog('runAsync', sql, params, true);
    // console.log(`[TRACKING] Saved location: id=${result?.lastInsertRowId}`);
    return result?.lastInsertRowId || null;

  } catch (err) {
    if (err.message.includes('no such table')) {
      // console.warn('[TRACKING] background_tracks not ready. Skipped.');
      return null;
    }
    // console.error('[TRACKING] Error saving location:', err);
    throw err;
  }
};

/**
 * Get unuploaded tracks safely
 */
export const getUnuploadedTracks = async (limit = null, employeeName = null) => {
  let sql;
  let params = [];
  if (employeeName) {
    sql = limit
      ? `SELECT * FROM background_tracks WHERE is_uploaded = 0 AND employee_name = ? ORDER BY timestamp ASC LIMIT ?`
      : `SELECT * FROM background_tracks WHERE is_uploaded = 0 AND employee_name = ? ORDER BY timestamp ASC`;
    params = limit ? [employeeName, limit] : [employeeName];
  } else {
    sql = limit
      ? `SELECT * FROM background_tracks WHERE is_uploaded = 0 ORDER BY timestamp ASC LIMIT ?`
      : `SELECT * FROM background_tracks WHERE is_uploaded = 0 ORDER BY timestamp ASC`;
    params = limit ? [limit] : [];
  }
  try {
    return await executeWithLog('getAllAsync', sql, params);
  } catch (err) {
    if (err.message.includes('no such table')) {
      // console.warn('[TRACKING] background_tracks not ready. Return empty.');
      return [];
    }
    throw err;
  }
};

/**
 * Mark tracks as uploaded
 */
export const markTracksAsUploaded = async (ids) => {
  if (!ids || ids.length === 0) return true;

  try {
    const chunks = [];
    while (ids.length) chunks.push(ids.splice(0, 200));

    for (const chunk of chunks) {
      const placeholders = chunk.map(() => '?').join(',');
      await executeWithLog(
        'runAsync',
        `UPDATE background_tracks SET is_uploaded = 1 WHERE id IN (${placeholders})`,
        chunk,
        true
      );
    }
    // console.log(`[TRACKING] Marked uploaded ids: ${ids.join(',')}`);
    return true;
  } catch (err) {
    if (err.message.includes('no such table')) {
      // console.warn('[TRACKING] background_tracks gone (reset). Skip mark uploaded.');
      return false;
    }
    throw err;
  }
};

export const getDataMapTrackingFormatted = async (employeeName) => {
  try {
    const sql = `
      SELECT 
        employee_name,
        '' AS LeaseNo,
        '' AS CustName,
        CASE 
          WHEN type = 'start' THEN 'Start'
          WHEN type = 'stop' THEN 'Stop'
          ELSE 'Tracking'
        END AS LabelMap,
        latitude AS Lattitude,
        longitude AS Longtitude,
        timestamp AS CheckinDate
      FROM checkin_startstop
      WHERE employee_name = ?

      UNION ALL

      SELECT
        employee_name,
        '' AS LeaseNo,
        '' AS CustName,
        'Tracking' AS LabelMap,
        latitude AS Lattitude,
        longitude AS Longtitude,
        timestamp AS CheckinDate
      FROM background_tracks
      WHERE employee_name = ?

      UNION ALL

      SELECT
        employee_name,
        LeaseNo,
        CustName,
        'Contract' AS LabelMap,
        latitude AS Lattitude,
        longitude AS Longtitude,
        timestamp AS CheckinDate
      FROM contract_checkins
      WHERE employee_name = ?

      ORDER BY CheckinDate ASC;
    `;

    const params = [employeeName, employeeName, employeeName];
    const rows = await executeWithLog("getAllAsync", sql, params);

    if (!rows || rows.length === 0) {
      return {
        Status: 0,
        Message: "Get Record By EmployeeName data not found.",
        Data: null
      };
    }

    return {
      Status: 1,
      Message: "Success",
      Data: rows
    };

  } catch (err) {
    return {
      Status: 0,
      Message: err.message,
      Data: null
    };
  }
};

