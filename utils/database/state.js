import { executeWithLog } from './core';

export const saveAppState = async (key, value) => {
  try {
    await executeWithLog(
      'runAsync',
      'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?);',
      [key, value],
      false
    );
  } catch (err) {
    if (err.message.includes('no such table')) {
      console.warn('[AppState] app_state table missing (DB reset). State not saved.');
      return false;
    }
    throw err;
  }
};

export const getAppState = async (key) => {
  try {
    const result = await executeWithLog(
      'getFirstAsync',
      'SELECT value FROM app_state WHERE key = ?;',
      [key]
    );
    return result ? result.value : null;

  } catch (err) {
    if (err.message.includes('no such table')) {
      console.warn('[AppState] app_state not ready (reset in progress). Return null.');
      return null;
    }
    throw err;
  }
};
