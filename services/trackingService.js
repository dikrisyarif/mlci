import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRACKING_CONFIG } from '../config/trackingConfig';
import * as Database from '../utils/database';
import NetInfo from '@react-native-community/netinfo';
import { isStartedApi } from '../api/listApi';

// Migration functions
export async function migratePendingLocationsToDatabase() {
  try {
    const pendingLocationsStr = await AsyncStorage.getItem('pendingLocations');
    if (!pendingLocationsStr) return;

    const pendingLocations = JSON.parse(pendingLocationsStr);
    //console.log(`[Migration] Found ${pendingLocations.length} pending locations to migrate`);

    for (const location of pendingLocations) {
      await saveTrackingLocation(location);
    }

    // Clear pending locations from AsyncStorage after successful migration
    await AsyncStorage.removeItem('pendingLocations');
    //console.log('[Migration] Successfully migrated all pending locations to database');
  } catch (error) {
    console.error('[Migration] Error migrating pending locations:', error);
    throw error;
  }
}

// Database operations
export async function saveTrackingLocation(locationData) {
  try {
    await Database.addTrackingLocation(locationData);
    await AsyncStorage.setItem('lastTrackedLocation', JSON.stringify({
      latitude: locationData.latitude,
      longitude: locationData.longitude
    }));
  } catch (error) {
    console.error('[TrackingService] Save location error:', error);
    throw error;
  }
}

export async function cleanupOldRecords() {
  try {
    const count = await Database.getTrackingCount();
    if (count > TRACKING_CONFIG.MAX_LOCAL_RECORDS) {
      const toDelete = count - TRACKING_CONFIG.MAX_LOCAL_RECORDS;
      await Database.deleteOldestTracks(toDelete);
      //console.log(`[TrackingService] Cleaned up ${toDelete} old records`);
    }
  } catch (error) {
    console.error('[TrackingService] Cleanup error:', error);
  }
}

// Storage operations
export async function getLastTrackedLocation() {
  try {
    const lastLocStr = await AsyncStorage.getItem('lastTrackedLocation');
    return lastLocStr ? JSON.parse(lastLocStr) : null;
  } catch (error) {
    console.error('[TrackingService] Get last location error:', error);
    return null;
  }
}

export async function updateLastUploadTime() {
  try {
    await AsyncStorage.setItem('lastServerUpload', Date.now().toString());
  } catch (error) {
    console.error('[TrackingService] Update upload time error:', error);
  }
}

export async function getLastUploadTime() {
  try {
    const lastUploadStr = await AsyncStorage.getItem('lastServerUpload');
    return lastUploadStr ? parseInt(lastUploadStr, 10) : 0;
  } catch (error) {
    console.error('[TrackingService] Get upload time error:', error);
    return 0;
  }
}

// Upload status management
export async function markLocationsAsUploaded(locationIds) {
  try {
    await Database.markTracksAsUploaded(locationIds);
  } catch (error) {
    console.error('[TrackingService] Mark uploaded error:', error);
    throw error;
  }
}

export async function getUnuploadedLocations() {
  try {
    return await Database.getUnuploadedTracks(TRACKING_CONFIG.MAX_BATCH_SIZE);
  } catch (error) {
    console.error('[TrackingService] Get unuploaded error:', error);
    return [];
  }
}

// Duplicate prevention
export async function isDuplicateLocation(loc) {
  try {
    const lastSentTimestamp = await AsyncStorage.getItem('lastTrackingSentTimestamp');
    const lastSentLocStr = await AsyncStorage.getItem('lastTrackingSentLoc');
    
    if (lastSentTimestamp && lastSentLocStr) {
      const lastLoc = JSON.parse(lastSentLocStr);
      return lastSentTimestamp === loc.timestamp &&
             lastLoc.latitude === loc.latitude &&
             lastLoc.longitude === loc.longitude;
    }
    return false;
  } catch (error) {
    //console.warn('[TrackingService] Check duplicate error:', error);
    return false;
  }
}

export async function isTooCloseToCheckin(loc) {
  try {
    const lastCheckinStartTimestamp = await AsyncStorage.getItem('lastCheckinStartTimestamp');
    const lastCheckinStartLocStr = await AsyncStorage.getItem('lastCheckinStartLoc');
    
    if (lastCheckinStartTimestamp && lastCheckinStartLocStr) {
      const lastCheckinLoc = JSON.parse(lastCheckinStartLocStr);
      const checkinTime = new Date(lastCheckinStartTimestamp);
      const trackingTime = new Date(loc.timestamp);
      const diffMs = Math.abs(trackingTime - checkinTime);
      
      return diffMs < TRACKING_CONFIG.TIME_THRESHOLDS.CHECKIN_PROXIMITY &&
             lastCheckinLoc.latitude === loc.latitude &&
             lastCheckinLoc.longitude === loc.longitude;
    }
    return false;
  } catch (error) {
    //console.warn('[TrackingService] Check checkin proximity error:', error);
    return false;
  }
}

export async function updateLastSentInfo(loc) {
  try {
    await AsyncStorage.setItem('lastTrackingSentTimestamp', loc.timestamp);
    await AsyncStorage.setItem('lastTrackingSentLoc', JSON.stringify({
      latitude: loc.latitude,
      longitude: loc.longitude
    }));
  } catch (error) {
    console.error('[TrackingService] Update sent info error:', error);
  }
}

/**
 * Load the tracking status from local storage and sync with server
 * @param {Object} profile - The user profile containing UserName
 * @returns {Promise<boolean>} The current tracking status
 */
export async function loadTrackingStatus(profile) {
  try {
    // First try to get from SQLite
    const savedStatus = await Database.getAppState('isTracking');
    let status = savedStatus === 'true';

    // Then try to sync with server if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected && profile?.UserName) {
      try {
        const now = new Date();
        const res = await isStartedApi({
          EmployeeName: profile.UserName,
          CreatedDate: now.toISOString()
        });

        if (res?.Data?.NextAction) {
          status = res.Data.NextAction === 'Stop';
          await Database.saveAppState('isTracking', status ? 'true' : 'false');
        }
      } catch (error) {
        //console.log('[TrackingService] Failed to sync tracking status:', error);
      }
    }

    return status;
  } catch (error) {
    console.error('[TrackingService] Error loading tracking status:', error);
    return false;
  }
}

/**
 * Toggle the tracking status both locally and on the server
 * @param {Object} profile - The user profile containing UserName
 * @param {boolean} currentStatus - The current tracking status
 * @returns {Promise<boolean>} The new tracking status
 */
export async function toggleTrackingStatus(profile, currentStatus) {
  try {
    const newStatus = !currentStatus;
    
    // Save to SQLite
    await Database.saveAppState('isTracking', newStatus ? 'true' : 'false');
    
    // Try to sync with server if online
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      try {
        const now = new Date();
        await isStartedApi({
          EmployeeName: profile.UserName,
          CreatedDate: now.toISOString()
        });
      } catch (error) {
        //console.log('[TrackingService] Failed to sync tracking status with server:', error);
      }
    }
    
    return newStatus;
  } catch (error) {
    console.error('[TrackingService] Error toggling tracking status:', error);
    throw error;
  }
}