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
      console.log(`[TRACKING] Duplicate location detected, skipping: ts=${timestamp}`);
      return null;
    }

    const sql = `
      INSERT INTO background_tracks (latitude, longitude, timestamp, employee_name, is_uploaded)
      VALUES (?, ?, ?, ?, 0);
    `;
    const params = [latitude, longitude, timestamp, employeeName];
    const result = await executeWithLog('runAsync', sql, params, true);
    console.log(`[TRACKING] Saved location: id=${result?.lastInsertRowId}`);
    return result?.lastInsertRowId || null;

  } catch (err) {
    if (err.message.includes('no such table')) {
      console.warn('[TRACKING] background_tracks not ready. Skipped.');
      return null;
    }
    // console.error('[TRACKING] Error saving location:', err);
    throw err;
  }
};

/**
 * Get unuploaded tracks safely
 */
export const getUnuploadedTracks = async (limit = null) => {
  const sql = limit
    ? `SELECT * FROM background_tracks WHERE is_uploaded = 0 ORDER BY timestamp ASC LIMIT ?`
    : `SELECT * FROM background_tracks WHERE is_uploaded = 0 ORDER BY timestamp ASC`;
  const params = limit ? [limit] : [];
  try {
    return await executeWithLog('getAllAsync', sql, params);
  } catch (err) {
    if (err.message.includes('no such table')) {
      console.warn('[TRACKING] background_tracks not ready. Return empty.');
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
    console.log(`[TRACKING] Marked uploaded ids: ${ids.join(',')}`);
    return true;
  } catch (err) {
    if (err.message.includes('no such table')) {
      console.warn('[TRACKING] background_tracks gone (reset). Skip mark uploaded.');
      return false;
    }
    throw err;
  }
};
