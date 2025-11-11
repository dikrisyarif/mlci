import { getDb, executeWithLog } from './core';

export const saveAppState = async (key, value) => {
  //console.log('[AppState] Saving state:', { key, value });
  try {
    await executeWithLog(
      'runAsync',
      'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?);',
      [key, value],
      false // Do NOT use transaction to avoid nested transaction error
    );
    //console.log('[AppState] State saved successfully');
  } catch (error) {
    console.error('[AppState] Failed to save state:', error);
    throw error;
  }
};

export const getAppState = async (key) => {
  //console.log('[AppState] Getting state for key:', key);
  const result = await executeWithLog(
    'getFirstAsync',
    'SELECT value FROM app_state WHERE key = ?;',
    [key]
  );
  //console.log('[AppState] Retrieved state:', { key, value: result?.value });
  return result ? result.value : null;
};