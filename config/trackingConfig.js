// Konfigurasi untuk background tracking
export const TRACKING_CONFIG = {
  // Pengaturan lokasi
  MIN_ACCURACY: 30, // dalam meter
  MIN_DISTANCE: 10, // minimum jarak pergerakan dalam meter
  
  // Pengaturan penyimpanan
  MAX_LOCAL_RECORDS: 1000, // maksimum record di local storage
  
  // Pengaturan upload
  UPLOAD_INTERVAL: 2 * 60 * 1000, // 2 menit dalam milliseconds
  MAX_BATCH_SIZE: 100, // maksimum record per upload
  
  // Retry settings
  RETRY_DELAYS: [5000, 15000, 30000, 60000], // delays untuk exponential backoff (dalam ms)
  
  // Task name
  LOCATION_TASK_NAME: 'background-location-task',
  
  // Waktu
  TIME_THRESHOLDS: {
    CHECKIN_PROXIMITY: 60 * 1000, // 1 menit dalam milliseconds
  }
};

// Export konstanta tambahan jika diperlukan
export const WIB_OFFSET = 7 * 60; // UTC+7 dalam menit