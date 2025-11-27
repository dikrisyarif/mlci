import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import haversine from 'haversine-distance';

const KEY = 'locationLogs';

export async function readLogs() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}

export async function writeLogs(list = []) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    return false;
  }
}

export async function deduplicateLogs(minDistance = 20) {
  const logs = await readLogs();
  if (!logs.length) return { before: 0, after: 0 };
  const out = [logs[0]];
  for (let i = 1; i < logs.length; i++) {
    const prev = out[out.length - 1];
    const curr = logs[i];
    const dist = haversine({ latitude: prev.latitude, longitude: prev.longitude }, { latitude: curr.latitude, longitude: curr.longitude });
    if (dist > minDistance) out.push(curr);
  }
  await writeLogs(out);
  return { before: logs.length, after: out.length };
}

export async function exportLogs(filename = 'tracking_export.json') {
  const logs = await readLogs();
  const json = JSON.stringify(logs, null, 2);
  const fileUri = FileSystem.documentDirectory + filename;
  try {
    await FileSystem.writeAsStringAsync(fileUri, json);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
      return { ok: true, uri: fileUri };
    }
    return { ok: true, uri: fileUri };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function clearLogs() {
  try {
    await AsyncStorage.removeItem(KEY);
    return true;
  } catch (err) {
    return false;
  }
}
