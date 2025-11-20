import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Update last server upload time
 */
export async function updateLastUploadTime() {
  try {
    await AsyncStorage.setItem('lastServerUpload', Date.now().toString());
  } catch (error) {
    // console.error('[storageService] Update upload time error:', error);
  }
}

/**
 * Get last server upload time
 */
export async function getLastUploadTime() {
  try {
    const lastUploadStr = await AsyncStorage.getItem('lastServerUpload');
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
    await AsyncStorage.setItem('lastTrackingSentTimestamp', loc.timestamp);
    await AsyncStorage.setItem(
      'lastTrackingSentLoc',
      JSON.stringify({
        latitude: loc.latitude,
        longitude: loc.longitude,
      })
    );
  } catch (error) {
    // console.error('[storageService] Update sent info error:', error);
  }
}

/**
 * Check if location is duplicate
 */
export async function isDuplicateLocation(loc) {
  try {
    const lastSentTimestamp = await AsyncStorage.getItem('lastTrackingSentTimestamp');
    const lastSentLocStr = await AsyncStorage.getItem('lastTrackingSentLoc');

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
    const lastCheckinStartTimestamp = await AsyncStorage.getItem('lastCheckinStartTimestamp');
    const lastCheckinStartLocStr = await AsyncStorage.getItem('lastCheckinStartLoc');

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
