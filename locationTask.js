import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveCheckinToServer, isStartedApi } from "./api/listApi";
import { TRACKING_CONFIG } from "./config/trackingConfig";
import {
  isValidLocation,
  isSignificantMovement,
  getLocalWIBLogString,
  normalizeTimestamp,
  validatePayload,
} from "./utils/trackingHelper";

// ===== helper getUserName =====
async function getUserName() {
  const userInfoStr = await SecureStore.getItemAsync("userInfo");
  if (!userInfoStr) return null;

  const userInfo = JSON.parse(userInfoStr);
  return userInfo?.UserName ?? null;
}

// ===== helper baru: getLastTrackedLocation =====
async function getLastTrackedLocation() {
  const lastLocStr = await AsyncStorage.getItem("lastTrackedLocation");
  return lastLocStr ? JSON.parse(lastLocStr) : null;
}

// ===== improved checkAndStopTracking dengan throttling & return status =====
let _lastIsStartedCheckMs = 0;
const IS_STARTED_THROTTLE_MS = 15000; // 15 detik

async function checkAndStopTracking(employeeName) {
  try {
    const now = Date.now();

    if (now - _lastIsStartedCheckMs < IS_STARTED_THROTTLE_MS) {
      return { stopped: false, statusResponse: null };
    }

    _lastIsStartedCheckMs = now;

    const nowIso = new Date().toISOString();
    const statusResponse = await isStartedApi({
      EmployeeName: employeeName,
      CreatedDate: nowIso,
    });

    if (statusResponse?.Data?.NextAction === "Start") {
      const isActive = await Location.hasStartedLocationUpdatesAsync(
        TRACKING_CONFIG.LOCATION_TASK_NAME
      );

      if (isActive) {
        await Location.stopLocationUpdatesAsync(
          TRACKING_CONFIG.LOCATION_TASK_NAME
        );
        await AsyncStorage.setItem("isTracking", "false");

        return { stopped: true, statusResponse };
      }
    }

    return { stopped: false, statusResponse };
  } catch (error) {
    return { stopped: false, statusResponse: null };
  }
}

// ===== save pending to local =====
async function savePendingLocation(location, employeeName) {
  const timestamp = normalizeTimestamp(location.timestamp);

  const locationData = {
    timestamp,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    employee_name: employeeName,
    is_uploaded: 0,
  };

  console.log("[BG TASK] SIMPAN LOCAL:", {
    lat: locationData.latitude,
    lon: locationData.longitude,
    t: locationData.timestamp,
  });

  try {
    const pendingLocationsStr = await AsyncStorage.getItem("pendingLocations");
    const pendingLocations = pendingLocationsStr
      ? JSON.parse(pendingLocationsStr)
      : [];

    pendingLocations.push(locationData);

    if (pendingLocations.length > TRACKING_CONFIG.MAX_LOCAL_RECORDS) {
      pendingLocations.splice(
        0,
        pendingLocations.length - TRACKING_CONFIG.MAX_LOCAL_RECORDS
      );
    }

    await AsyncStorage.setItem(
      "pendingLocations",
      JSON.stringify(pendingLocations)
    );

    await AsyncStorage.setItem(
      "lastTrackedLocation",
      JSON.stringify({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      })
    );
  } catch (error) {
    // ignore
  }
}

// ===== upload batch ke server =====
async function uploadPendingLocationsToServer(employeeName) {
  const lastUpload = await AsyncStorage.getItem("lastServerUpload");
  const currentTime = Date.now();
  const lastUploadTime = lastUpload ? parseInt(lastUpload, 10) : 0;

  if (currentTime - lastUploadTime < TRACKING_CONFIG.UPLOAD_INTERVAL) {
    return;
  }

  try {
    const pendingLocationsStr = await AsyncStorage.getItem("pendingLocations");
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

    console.log(
      "[BG TASK] MULAI UPLOAD pendingLocations:",
      pendingLocations.length
    );

    await AsyncStorage.setItem(
      "pendingLocations",
      JSON.stringify(remainingLocations)
    );

    if (sentCount > 0) {
      await AsyncStorage.setItem("lastServerUpload", currentTime.toString());
      console.log(
        `[BG Tracking] Batch upload complete. Success: ${sentCount}, Failed: ${failedCount}. WIB: ${getLocalWIBLogString()}`
      );
    }
  } catch (error) {
    // ignore
  }
}

// ===== tryUploadLocation dengan retry =====
async function tryUploadLocation(loc, employeeName) {
  for (
    let retryCount = 0;
    retryCount < TRACKING_CONFIG.RETRY_DELAYS.length;
    retryCount++
  ) {
    try {
      const payload = {
        EmployeeName: employeeName,
        Lattitude: loc.latitude,
        Longtitude: loc.longitude,
        CreatedDate: loc.timestamp,
        tipechekin: "tracking",
        localTimestamp: loc.timestamp,
      };

      validatePayload(payload);
      await saveCheckinToServer(payload);

      await AsyncStorage.setItem("lastTrackingSentTimestamp", loc.timestamp);
      await AsyncStorage.setItem(
        "lastTrackingSentLoc",
        JSON.stringify({
          latitude: loc.latitude,
          longitude: loc.longitude,
        })
      );

      return true;
    } catch (error) {
      if (retryCount < TRACKING_CONFIG.RETRY_DELAYS.length - 1) {
        await new Promise((r) =>
          setTimeout(r, TRACKING_CONFIG.RETRY_DELAYS[retryCount])
        );
      }
    }
  }

  return false;
}

// ===== BACKGROUND TASK DEFINISI =====
TaskManager.defineTask(
  TRACKING_CONFIG.LOCATION_TASK_NAME,
  ({ data, error }) => {
    return new Promise(async (resolve) => {
      try {
        if (error) return resolve();
        if (!data?.locations?.length) return resolve();

        const location = data.locations[0];

        console.log(
          "[BG Tracking] Task executing (WIB):",
          getLocalWIBLogString()
        );

        if (!isValidLocation(location)) {
          return resolve();
        }

        console.log("[BG TASK] Lokasi diterima:", {
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          acc: location.coords.accuracy,
        });

        const employeeName = await getUserName();
        if (!employeeName) return resolve();

        const lastLoc = await getLastTrackedLocation();
        if (!isSignificantMovement(location, lastLoc)) {
          console.log("[BG Tracking] Skipping: No significant movement");
          return resolve();
        }

        // === perbaikan stop check ===
        const stopCheck = await checkAndStopTracking(employeeName);
        if (stopCheck.stopped) {
          console.log(
            "[BG TASK] Tracking dihentikan server. NextAction:",
            stopCheck.statusResponse?.Data?.NextAction
          );
          return resolve();
        }

        await savePendingLocation(location, employeeName);

        await uploadPendingLocationsToServer(employeeName);

        resolve();
      } catch (error) {
        resolve();
      }
    });
  }
);
