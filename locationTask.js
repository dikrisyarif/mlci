import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Database from "./utils/database";
import { getLocalWIBString } from "./utils/trackingHelper";
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
  try {
    const lastLocStr = await Database.getAppState("lastTrackedLocation");
    return lastLocStr ? JSON.parse(lastLocStr) : null;
  } catch (e) {
    return null;
  }
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
        await Database.saveAppState('isTracking', 'false');

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
    // Save to SQLite background_tracks table instead of AsyncStorage
    await Database.saveBackgroundLocation({
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timestamp: locationData.timestamp,
      employee_name: employeeName,
      is_uploaded: 0,
    }, employeeName);

    // Keep a lightweight last location in app_state for quick checks
    await Database.saveAppState(
      "lastTrackedLocation",
      JSON.stringify({ latitude: location.coords.latitude, longitude: location.coords.longitude })
    );
  } catch (error) {
    // ignore
  }
}

// ===== upload batch ke server =====
async function uploadPendingLocationsToServer(employeeName) {
  const lastUpload = await Database.getAppState("lastServerUpload");
  const currentTime = Date.now();
  const lastUploadTime = lastUpload ? parseInt(lastUpload, 10) : 0;

  if (currentTime - lastUploadTime < TRACKING_CONFIG.UPLOAD_INTERVAL) {
    return;
  }

  try {
    // Read unuploaded tracks from SQLite
    const rows = await Database.getUnuploadedTracks(employeeName);
    if (!rows || rows.length === 0) return;

    // Only upload records that belong to today's WIB date.
    // This avoids uploading older-day data when the app is started the next morning.
    const todayWIB = getLocalWIBString(new Date()).slice(0, 10); // YYYY-MM-DD
    const rowsForToday = rows.filter(r => {
      try {
        const ts = (r.timestamp || '').slice(0, 10);
        return ts === todayWIB;
      } catch (e) {
        return false;
      }
    });

    if (!rowsForToday || rowsForToday.length === 0) {
      console.log('[BG TASK] No unuploaded tracks for today (WIB), skipping upload.');
      return;
    }

    let sentCount = 0;
    let failedCount = 0;
    const successfulIds = [];

    for (const r of rowsForToday) {
      const loc = {
        latitude: r.latitude,
        longitude: r.longitude,
        timestamp: r.timestamp,
        id: r.id,
      };
      if (await tryUploadLocation(loc, employeeName)) {
        sentCount++;
        successfulIds.push(r.id);
      } else {
        failedCount++;
      }
    }

    console.log("[BG TASK] MULAI UPLOAD unuploaded tracks for today:", rowsForToday.length, `(skipped ${rows.length - rowsForToday.length} older records)`);

    if (successfulIds.length > 0) {
      await Database.markTracksAsUploaded(successfulIds);
    }

    if (sentCount > 0) {
      await Database.saveAppState("lastServerUpload", currentTime.toString());
      console.log(
        `[BG Tracking] Batch upload complete. Success: ${sentCount}, Failed: ${failedCount}. WIB: ${getLocalWIBLogString()}`
      );
      // If this is the first time we successfully synced (no previous lastServerUpload),
      // delete older-day records (keep only today's data) for this employee to avoid
      // uploading historical data later.
      try {
        if (lastUploadTime === 0) {
          const todayWIB = getLocalWIBString(new Date()).slice(0, 10);
          // delete older records from background_tracks, checkin_startstop, contract_checkins
          await Database.executeWithLog('runAsync', 'DELETE FROM background_tracks WHERE employee_name = ? AND substr(timestamp,1,10) < ?;', [employeeName, todayWIB], false, true);
          await Database.executeWithLog('runAsync', 'DELETE FROM checkin_startstop WHERE employee_name = ? AND substr(timestamp,1,10) < ?;', [employeeName, todayWIB], false, true);
          await Database.executeWithLog('runAsync', 'DELETE FROM contract_checkins WHERE employee_name = ? AND substr(timestamp,1,10) < ?;', [employeeName, todayWIB], false, true);
          console.log('[BG TASK] Deleted older-day local records as part of first sync for', employeeName);
        }
      } catch (delErr) {
        console.warn('[BG TASK] Failed deleting older-day records on first sync:', delErr?.message || delErr);
      }
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

      // persist last sent info into app_state
      await Database.saveAppState('lastTrackingSentTimestamp', loc.timestamp);
      await Database.saveAppState('lastTrackingSentLoc', JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude }));

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
