import * as Database from '../../utils/database';

/**
 * Update last server upload time
 */
export async function updateLastUploadTime() {
  try {
    await Database.saveAppState('lastServerUpload', Date.now().toString());
  } catch (error) {
    // console.error('[storageService] Update upload time error:', error);
  }
}

/**
 * Get last server upload time
 */
export async function getLastUploadTime() {
  try {
    const lastUploadStr = await Database.getAppState('lastServerUpload');
    return lastUploadStr ? parseInt(lastUploadStr, 10) : 0;
  } catch (error) {
    // console.error('[storageService] Get upload time error:', error);
    return 0;
  }
}

/**
 * Update last sent location info to prevent duplicates
 */
export async function updateLastSentInfo(loc) {
  try {
    await Database.saveAppState('lastTrackingSentTimestamp', loc.timestamp);
    await Database.saveAppState('lastTrackingSentLoc', JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude }));
  } catch (error) {
    // console.error('[storageService] Update sent info error:', error);
  }
}

/**
 * Check if location is duplicate
 */
export async function isDuplicateLocation(loc) {
  try {
    const lastSentTimestamp = await Database.getAppState('lastTrackingSentTimestamp');
    const lastSentLocStr = await Database.getAppState('lastTrackingSentLoc');

    if (lastSentTimestamp && lastSentLocStr) {
      const lastLoc = JSON.parse(lastSentLocStr);
      return (
        lastSentTimestamp === loc.timestamp &&
        lastLoc.latitude === loc.latitude &&
        lastLoc.longitude === loc.longitude
      );
    }
    return false;
  } catch (error) {
    console.warn('[storageService] Check duplicate error:', error);
    return false;
  }
}

/**
 * Check if location is too close to last checkin
 */
export async function isTooCloseToCheckin(loc, TRACKING_CONFIG) {
  try {
    const lastCheckinStartTimestamp = await Database.getAppState('lastCheckinStartTimestamp');
    const lastCheckinStartLocStr = await Database.getAppState('lastCheckinStartLoc');

    if (lastCheckinStartTimestamp && lastCheckinStartLocStr) {
      const lastCheckinLoc = JSON.parse(lastCheckinStartLocStr);
      const checkinTime = new Date(lastCheckinStartTimestamp);
      const trackingTime = new Date(loc.timestamp);
      const diffMs = Math.abs(trackingTime - checkinTime);

      return (
        diffMs < TRACKING_CONFIG.TIME_THRESHOLDS.CHECKIN_PROXIMITY &&
        lastCheckinLoc.latitude === loc.latitude &&
        lastCheckinLoc.longitude === loc.longitude
      );
    }
    return false;
  } catch (error) {
    console.warn('[storageService] Check checkin proximity error:', error);
    return false;
  }
}
