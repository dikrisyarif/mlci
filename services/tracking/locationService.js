import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Database from '../../utils/database';
import { TRACKING_CONFIG } from '../../config/trackingConfig';
import { isDuplicateLocation, isTooCloseToCheckin, updateLastSentInfo } from './storageService';
/**
 * Save a location record into SQLite and cache the last position
 */
export async function saveTrackingLocation(locationData, employeeName) {
  try {
    console.log("[SAVE-LOCATION] Menyimpan ke DB:", locationData);
    // skip jika duplicate dengan last sent
    const duplicate = await isDuplicateLocation(locationData);
    if (duplicate) {
      console.log('[locationService] Duplicate location detected, skipped.');
      return null;
    }

    // skip jika terlalu dekat dengan checkin
    const tooClose = await isTooCloseToCheckin(locationData, TRACKING_CONFIG);
    if (tooClose) {
      console.log('[locationService] Location too close to last checkin, skipped.');
      return null;
    }

    const id = await Database.saveBackgroundLocation(locationData, employeeName);

    if (id) {
      await updateLastSentInfo(locationData);
      console.log("[SAVE-LOCATION] data tersimpan:", locationData);

    }

    return id;
  } catch (err) {
    // console.error('[locationService] Save location error:', err);
    throw err;
  }
}

/**
 * Keep DB size under limit
 */
export async function cleanupOldRecords() {
  try {
    const count = await Database.getTrackingCount();
    if (count > TRACKING_CONFIG.MAX_LOCAL_RECORDS) {
      const toDelete = count - TRACKING_CONFIG.MAX_LOCAL_RECORDS;
      await Database.deleteOldestTracks(toDelete);
    }
  } catch (error) {
    // console.error('[locationService] Cleanup error:', error);
  }
}

/**
 * Get the last tracked location from AsyncStorage
 */
export async function getLastTrackedLocation() {
  try {
    const lastLocStr = await AsyncStorage.getItem('lastTrackedLocation');
    return lastLocStr ? JSON.parse(lastLocStr) : null;
  } catch (error) {
    // console.error('[locationService] Get last location error:', error);
    return null;
  }
}
