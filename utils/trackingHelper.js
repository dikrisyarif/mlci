import { TRACKING_CONFIG, WIB_OFFSET } from '../config/trackingConfig';

// Formatting helpers
export function getLocalWIBString(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function getLocalWIBLogString(date = new Date()) {
  const local = new Date(date.getTime() + (WIB_OFFSET - date.getTimezoneOffset()) * 60000);
  const pad = n => n.toString().padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
}

// Location validation helpers
export function isValidLocation(location) {
  return location?.coords?.accuracy <= TRACKING_CONFIG.MIN_ACCURACY;
}

export function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isSignificantMovement(newLoc, lastLoc) {
  if (!lastLoc) return true;
  return getDistanceFromLatLonInMeters(
    newLoc.coords.latitude,
    newLoc.coords.longitude,
    lastLoc.latitude,
    lastLoc.longitude
  ) >= TRACKING_CONFIG.MIN_DISTANCE;
}

// Timestamp handling
export function normalizeTimestamp(timestamp) {
  if (typeof timestamp === 'number') {
    const dateObj = new Date(timestamp);
    dateObj.setMilliseconds(0);
    return getLocalWIBString(dateObj);
  } else if (typeof timestamp === 'string') {
    return timestamp;
  } else {
    const nowDate = new Date();
    nowDate.setMilliseconds(0);
    return getLocalWIBString(nowDate);
  }
}

// Validation helpers
export function validatePayload(payload) {
  const nullFields = Object.entries(payload)
    .filter(([_, value]) => value === null || value === undefined)
    .map(([key]) => key);
    
  if (nullFields.length > 0) {
    throw new Error('Invalid payload: missing fields: ' + nullFields.join(', '));
  }
  return true;
}