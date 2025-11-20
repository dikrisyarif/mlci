import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Update last sent info
 */
export async function updateLastSentInfo(loc) {
  try {
    await AsyncStorage.setItem('lastTrackingSentTimestamp', loc.timestamp);
    await AsyncStorage.setItem(
      'lastTrackingSentLoc',
      JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude })
    );
  } catch (error) {
    // console.error('[storageService] Update sent info error:', error);
  }
}

/**
 * Check duplicate
 */
export async function isDuplicateLocation(loc) {
  try {
    const lastTs = await AsyncStorage.getItem('lastTrackingSentTimestamp');
    const lastLocStr = await AsyncStorage.getItem('lastTrackingSentLoc');

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
    const lastCheckinTs = await AsyncStorage.getItem('lastCheckinStartTimestamp');
    const lastCheckinLocStr = await AsyncStorage.getItem('lastCheckinStartLoc');

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
