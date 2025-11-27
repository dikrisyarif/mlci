import * as Location from "expo-location";
import * as Database from "./utils/database";

const LOCATION_TASK_NAME = "background-location-task";

export async function startBackgroundTracking() {
  // Cek apakah sudah berjalan
  const isActive = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (isActive) {
    // //console.log('[BG Tracking] Sudah berjalan, skip start ulang');
    console.log("[BG Tracking] startBackgroundTracking() dipanggil");
    return;
  }
  // Request permission jika belum
  const { status, canAskAgain } =
    await Location.requestBackgroundPermissionsAsync();
  if (status !== "granted") {
    // Tampilkan alert ke user jika permission belum diberikan
    if (canAskAgain) {
      alert(
        'Aplikasi membutuhkan izin lokasi background. Silakan aktifkan "Allow all the time" di pengaturan aplikasi Android Anda.'
      );
    } else {
      alert(
        "Izin lokasi background ditolak permanen. Silakan aktifkan secara manual di pengaturan aplikasi Android."
      );
    }
    // //console.warn('[BG Tracking] Background location permission not granted');
    return;
  }
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 15000, // 15 detik
    distanceInterval: 5, // hanya update jika pindah >5m    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "MLCI Tracking",
      notificationBody: "Tracking lokasi berjalan di background",
      notificationColor: "#007bff",
    },
  });
  await Database.saveAppState("isTracking", "true");
  console.log("[BG Tracking] BACKGROUND tracking DIMULAI (interval 15 detik)");
}

export async function stopBackgroundTracking() {
  const isActive = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TASK_NAME
  );
  if (isActive) {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  await Database.saveAppState("isTracking", "false");
    console.log('[BG Tracking] Background tracking dihentikan');
  } else {
    console.log('[BG Tracking] Tidak ada background tracking yang aktif');
  }
}
