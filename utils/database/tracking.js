import { getDb } from './core';

export const saveBackgroundLocation = async (location, employeeName) => {
  const db = await getDb();
  const { latitude, longitude } = location.coords;
  const timestamp = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO background_tracks (latitude, longitude, timestamp, employee_name) VALUES (?, ?, ?, ?);',
    [latitude, longitude, timestamp, employeeName]
  );
};

export const getUnuploadedTracks = async (limit = null) => {
  const db = await getDb();
  const query = limit 
    ? 'SELECT * FROM background_tracks WHERE is_uploaded = 0 ORDER BY timestamp ASC LIMIT ?;'
    : 'SELECT * FROM background_tracks WHERE is_uploaded = 0 ORDER BY timestamp ASC;';
  const params = limit ? [limit] : [];
  return await db.getAllAsync(query, params);
};

export const markTracksAsUploaded = async (ids) => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE background_tracks SET is_uploaded = 1 WHERE id IN (${ids.join(',')});`
  );
};