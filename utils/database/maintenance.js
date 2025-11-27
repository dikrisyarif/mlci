import { getDb } from './core';
import { getAppState } from './state';

export const cleanDailyData = async () => {
  const db = await getDb();
  try {
    // Get current tracking status before cleanup
    const trackingStatus = await getAppState('isTracking');
    // Clear daily operational data
    await db.execAsync('DELETE FROM background_tracks WHERE is_uploaded = 1;');
    await db.execAsync('DELETE FROM contract_checkins WHERE is_uploaded = 1;');
    await db.execAsync('DELETE FROM checkin_startstop WHERE is_uploaded = 1;');
    await db.execAsync('DELETE FROM app_state WHERE key != "db_version";');
    //console.log('✅ Daily data cleanup completed');
    return trackingStatus === 'true';
  } catch (error) {
    console.error('Error during daily cleanup:', error);
    throw error;
  }
};