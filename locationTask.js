import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveCheckinToServer, isStartedApi } from './api/listApi';
import { TRACKING_CONFIG } from './config/trackingConfig';
import {
  isValidLocation,
  isSignificantMovement,
  getLocalWIBLogString,
  normalizeTimestamp,
  validatePayload
} from './utils/trackingHelper';

// Helper functions for the task
async function getUserName() {
  const userInfoStr = await SecureStore.getItemAsync('userInfo');
  if (!userInfoStr) {
    //console.warn('[BG Tracking] No user info found');
    return null;
  }

  const userInfo = JSON.parse(userInfoStr);
  if (!userInfo?.UserName) {
    //console.warn('[BG Tracking] No username found');
    return null;
  }

  return userInfo.UserName;
}

async function checkAndStopTracking(employeeName) {
  const now = new Date();
  const statusResponse = await isStartedApi({
    EmployeeName: employeeName,
    CreatedDate: now.toISOString()
  });

  if (statusResponse?.Data?.NextAction === 'Start') {
    const isActive = await Location.hasStartedLocationUpdatesAsync(TRACKING_CONFIG.LOCATION_TASK_NAME);
    if (isActive) {
      await Location.stopLocationUpdatesAsync(TRACKING_CONFIG.LOCATION_TASK_NAME);
      await AsyncStorage.setItem('isTracking', 'false');
      //console.log('[BG Tracking] Tracking stopped by server command');
      return true;
    }
  }
  return false;
}

async function savePendingLocation(location, employeeName) {
  const timestamp = normalizeTimestamp(location.timestamp);
  const locationData = {
    timestamp,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    employee_name: employeeName,
    is_uploaded: 0
  };

  try {
    // Get existing pending locations
    const pendingLocationsStr = await AsyncStorage.getItem('pendingLocations');
    const pendingLocations = pendingLocationsStr ? JSON.parse(pendingLocationsStr) : [];
    
    // Add new location
    pendingLocations.push(locationData);
    
    // Keep only last MAX_LOCAL_RECORDS locations
    if (pendingLocations.length > TRACKING_CONFIG.MAX_LOCAL_RECORDS) {
      pendingLocations.splice(0, pendingLocations.length - TRACKING_CONFIG.MAX_LOCAL_RECORDS);
    }
    
    // Save back to AsyncStorage
    await AsyncStorage.setItem('pendingLocations', JSON.stringify(pendingLocations));
    
    // Update last tracked location for movement detection
    await AsyncStorage.setItem('lastTrackedLocation', JSON.stringify({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    }));
    
    //console.log('[BG Tracking] Location saved to AsyncStorage');
  } catch (error) {
    console.error('[BG Tracking] Error saving to AsyncStorage:', error);
  }
}

async function uploadPendingLocationsToServer(employeeName) {
  const lastUpload = await AsyncStorage.getItem('lastServerUpload');
  const currentTime = Date.now();
  const lastUploadTime = lastUpload ? parseInt(lastUpload, 10) : 0;

  if (currentTime - lastUploadTime < TRACKING_CONFIG.UPLOAD_INTERVAL) {
    return;
  }

  try {
    // Get pending locations from AsyncStorage
    const pendingLocationsStr = await AsyncStorage.getItem('pendingLocations');
    if (!pendingLocationsStr) return;

    const pendingLocations = JSON.parse(pendingLocationsStr);
    let sentCount = 0;
    let failedCount = 0;
    const remainingLocations = [];

    for (const loc of pendingLocations) {
      if (await tryUploadLocation(loc, employeeName)) {
        sentCount++;
      } else {
        failedCount++;
        remainingLocations.push(loc);
      }
    }

    // Save remaining locations back to AsyncStorage
    await AsyncStorage.setItem('pendingLocations', JSON.stringify(remainingLocations));
    
    if (sentCount > 0) {
      await AsyncStorage.setItem('lastServerUpload', currentTime.toString());
      //console.log(
      //   `[BG Tracking] Batch upload complete. Success: ${sentCount}, Failed: ${failedCount}. WIB: ${getLocalWIBLogString()}`
      // );
    }
  } catch (error) {
    console.error('[BG Tracking] Error during upload:', error);
  }
}

async function tryUploadLocation(loc, employeeName) {
  for (let retryCount = 0; retryCount < TRACKING_CONFIG.RETRY_DELAYS.length; retryCount++) {
    try {
      const payload = {
        EmployeeName: employeeName,
        Lattitude: loc.latitude,
        Longtitude: loc.longitude,
        CreatedDate: loc.timestamp,
        tipechekin: 'tracking',
        localTimestamp: loc.timestamp
      };

      validatePayload(payload);
      await saveCheckinToServer(payload);
      
      // Update last sent info in AsyncStorage
      await AsyncStorage.setItem('lastTrackingSentTimestamp', loc.timestamp);
      await AsyncStorage.setItem('lastTrackingSentLoc', JSON.stringify({
        latitude: loc.latitude,
        longitude: loc.longitude
      }));
      
      return true;
    } catch (error) {
      //console.warn(`[BG Tracking] Upload retry ${retryCount + 1} failed:`, error.message);
      if (retryCount < TRACKING_CONFIG.RETRY_DELAYS.length - 1) {
        await new Promise(r => setTimeout(r, TRACKING_CONFIG.RETRY_DELAYS[retryCount]));
      }
    }
  }
  return false;
}

// Background location task definition
TaskManager.defineTask(TRACKING_CONFIG.LOCATION_TASK_NAME, ({ data, error }) => {
  return new Promise(async (resolve) => {
    try {
      if (error) {
        console.error('[BG Tracking] Task error:', error);
        return resolve();
      }

      if (!data?.locations?.length) {
        //console.warn('[BG Tracking] No location data received');
        return resolve();
      }

      const location = data.locations[0];
      //console.log('[BG Tracking] Task executing (WIB):', getLocalWIBLogString());

      if (!isValidLocation(location)) {
        //console.log('[BG Tracking] Skipping: Low accuracy:', location.coords.accuracy);
        return resolve();
      }

      const employeeName = await getUserName();
      if (!employeeName) {
        return resolve();
      }

      const lastLoc = await getLastTrackedLocation();
      if (!isSignificantMovement(location, lastLoc)) {
        //console.log('[BG Tracking] Skipping: No significant movement');
        return resolve();
      }

      if (await checkAndStopTracking(employeeName)) {
        return resolve();
      }

      await savePendingLocation(location, employeeName);
      await uploadPendingLocationsToServer(employeeName);

      resolve();
    } catch (error) {
      console.error('[BG Tracking] Fatal error:', error);
      resolve();
    }
  });
});