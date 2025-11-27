import * as Database from '../../utils/database';

/**
 * Update last sent info
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
 * Check duplicate
 */
export async function isDuplicateLocation(loc) {
  try {
    const lastTs = await Database.getAppState('lastTrackingSentTimestamp');
    const lastLocStr = await Database.getAppState('lastTrackingSentLoc');

    if (lastTs && lastLocStr) {
      const lastLoc = JSON.parse(lastLocStr);
      return lastTs === loc.timestamp &&
        lastLoc.latitude === loc.latitude &&
        lastLoc.longitude === loc.longitude;
    }
    return false;
  } catch (error) {
    console.warn('[storageService] Check duplicate error:', error);
    return false;
  }
}

/**
 * Skip locations too close to checkin
 */
export async function isTooCloseToCheckin(loc, TRACKING_CONFIG) {
  try {
    const lastCheckinTs = await Database.getAppState('lastCheckinStartTimestamp');
    const lastCheckinLocStr = await Database.getAppState('lastCheckinStartLoc');

    if (lastCheckinTs && lastCheckinLocStr) {
      const lastLoc = JSON.parse(lastCheckinLocStr);
      const diffMs = Math.abs(new Date(loc.timestamp) - new Date(lastCheckinTs));
      return diffMs < TRACKING_CONFIG.TIME_THRESHOLDS.CHECKIN_PROXIMITY &&
        lastLoc.latitude === loc.latitude &&
        lastLoc.longitude === loc.longitude;
    }
    return false;
  } catch (error) {
    console.warn('[storageService] Check checkin proximity error:', error);
    return false;
  }
}
