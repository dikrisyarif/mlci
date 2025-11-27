import { executeWithLog } from "../database/core"; // pastikan ini helper SQLite sudah ada

/**
 * Ambil data tracking lokal dari SQLite untuk employeeName
 */
export async function getLocalTrackings(employeeName) {
  console.log(`[trackingDB] Loading local tracking for: ${employeeName}`);

  try {
    // Debug: count rows per source table for this employee to help diagnose missing rows
    try {
      const startCount = await executeWithLog('getAllAsync', 'SELECT COUNT(*) as c FROM checkin_startstop WHERE employee_name = ?;', [employeeName]);
      const bgCount = await executeWithLog('getAllAsync', 'SELECT COUNT(*) as c FROM background_tracks WHERE employee_name = ?;', [employeeName]);
      const contractCount = await executeWithLog('getAllAsync', 'SELECT COUNT(*) as c FROM contract_checkins WHERE employee_name = ?;', [employeeName]);
      console.log(`[trackingDB] counts -> start:${startCount?.[0]?.c ?? 0}, bg:${bgCount?.[0]?.c ?? 0}, contract:${contractCount?.[0]?.c ?? 0}`);

      // also show a small sample from each table to inspect employee_name values and timestamps
      const sampleStart = await executeWithLog('getAllAsync', 'SELECT id,type,latitude,longitude,timestamp,employee_name FROM checkin_startstop WHERE employee_name = ? ORDER BY timestamp DESC LIMIT 5;', [employeeName]);
      const sampleBg = await executeWithLog('getAllAsync', 'SELECT id,latitude,longitude,timestamp,employee_name FROM background_tracks WHERE employee_name = ? ORDER BY timestamp DESC LIMIT 5;', [employeeName]);
      const sampleContract = await executeWithLog('getAllAsync', 'SELECT id,lease_no,latitude,longitude,timestamp,employee_name FROM contract_checkins WHERE employee_name = ? ORDER BY timestamp DESC LIMIT 5;', [employeeName]);
      console.log('[trackingDB] sample start:', sampleStart);
      console.log('[trackingDB] sample bg:', sampleBg);
      console.log('[trackingDB] sample contract:', sampleContract);
    } catch (dbgErr) {
      console.warn('[trackingDB] debug counts failed:', dbgErr?.message || dbgErr);
    }
    const sql = `
      SELECT employee_name, '' AS lease_no, '' AS cust_name,
             CASE 
               WHEN type='start' THEN 'Start'
               WHEN type='stop' THEN 'Stop'
               ELSE 'Tracking'
             END AS label_map,
             latitude, longitude, timestamp AS checkin_date
      FROM checkin_startstop
      WHERE employee_name = ?

      UNION ALL

      SELECT employee_name, '' AS lease_no, '' AS cust_name,
             'Tracking' AS label_map,
             latitude, longitude, timestamp AS checkin_date
      FROM background_tracks
      WHERE employee_name = ?

      UNION ALL

      SELECT employee_name, lease_no AS lease_no, comment AS cust_name,
        'Contract' AS label_map,
        latitude, longitude, timestamp AS checkin_date
      FROM contract_checkins
      WHERE employee_name = ?

      ORDER BY checkin_date ASC;
    `;

    const params = [employeeName, employeeName, employeeName];
    const rows = await executeWithLog("getAllAsync", sql, params);

    if (!rows || rows.length === 0) {
      console.log(`[trackingDB] No records found`);
      return [];
    }

    console.log(`[trackingDB] Loaded ${rows.length} records`);
    return rows;
  } catch (err) {
    console.error(`[trackingDB] ERROR loading tracking:`, err);
    return [];
  }
}
