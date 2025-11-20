import { callMitsuiApi } from './apiClient';
import * as Database from '../utils/database/state'; // ✅ untuk offline fallback

/** ==============================
 *  DETAIL & LIST
 * ============================== */
export const fetchListDtl = async ({ EmployeeName = '', LeaseNo = '' }) => {
  const endpointPath = '/common/v1/mobile/get-list-dtl';
  const body = { EmployeeName, LeaseNo };

  return await callMitsuiApi({
    endpointPath,
    method: 'POST',
    body,
    offlineFallback: async () => {
      console.warn('[fetchListDtl] Offline fallback: return cached data');
      const cache = await Database.getAppState('listDtlCache');
      return cache ? JSON.parse(cache) : [];
    },
  });
};

/** ==============================
 *  UPDATE CHECK-IN / COMMENT
 * ============================== */
export const updateCheckin = async ({
  EmployeeName,
  LeaseNo,
  Comment,
  Latitude,
  Longitude,
  CheckIn,
}) => {
  const endpointPath = '/common/v1/mobile/update-check';
  const body = {
    EmployeeName,
    LeaseNo,
    Comment,
    Latitude: Latitude?.toString(),
    Longitude: Longitude?.toString(),
    CheckIn,
    CreatedDate: new Date().toISOString(),
  };

  return await callMitsuiApi({
    endpointPath,
    method: 'PUT',
    body,
    offlineFallback: async () => {
      console.warn('[updateCheckin] Offline fallback: queueing update');
      await Database.saveAppState(
        `pending-update-${LeaseNo}`,
        JSON.stringify(body)
      );
      return { Message: 'Saved locally (offline)', Offline: true };
    },
  });
};

export const updateComment = async ({
  EmployeeName,
  LeaseNo,
  Comment,
  CreatedDate,
}) => {
  const endpointPath = '/common/v1/mobile/update-comment';
  const body = {
    EmployeeName,
    LeaseNo,
    Comment,
    CreatedDate: CreatedDate || new Date().toISOString(),
  };

  try {
    return await callMitsuiApi({
      endpointPath,
      method: 'PUT',
      body,
      offlineFallback: async () => {
        console.warn('[updateComment] Offline fallback: save local');
        await Database.saveAppState(
          `pending-comment-${LeaseNo}`,
          JSON.stringify(body)
        );
        return { Message: 'Comment saved locally (offline)', Offline: true };
      },
    });
  } catch (error) {
    // console.error('[ListApi] Error update comment:', error);
    throw error;
  }
};

/** ==============================
 *  SAVE CHECK-IN / START / STOP / TRACKING
 * ============================== */
export const saveCheckinToServer = async ({
  EmployeeName,
  Lattitude,
  Longtitude,
  CreatedDate,
  Address = '',
  tipechekin = 'tracking',
  localTimestamp,
}) => {
  const endpointPath = '/common/v1/mobile/save';
  const finalCreatedDate = localTimestamp || CreatedDate;

  let body = {
    EmployeeName,
    Lattitude,
    Longtitude,
    CreatedDate: finalCreatedDate,
    Address: '',
    CheckIn: false,
    Start: false,
    Stop: false,
    MockProvider: false,
  };

  switch (tipechekin) {
    case 'start':
      body.Start = true;
      body.Address = Address;
      break;
    case 'stop':
      body.Stop = true;
      body.Address = Address;
      break;
    case 'kontrak':
      body.CheckIn = true;
      body.Address = Address;
      break;
  }

  return await callMitsuiApi({
    endpointPath,
    method: 'POST',
    body,
    offlineFallback: async () => {
      console.warn(`[saveCheckinToServer] Offline: queue ${tipechekin}`);
      const localKey = `pending-${tipechekin}-${finalCreatedDate}`;
      await Database.saveAppState(localKey, JSON.stringify(body));
      return { Message: 'Check-in saved locally', Offline: true };
    },
  });
};

/** ==============================
 *  GET RECORD / MARKER MAP
 * ============================== */
export const fetchGetRecord = async ({ EmployeeName, CreatedDate } = {}) => {
  const endpointPath = '/common/v1/mobile/get-record';
  const createdDate = CreatedDate || new Date().toISOString();
  const body = { EmployeeName, CreatedDate: createdDate };

  try {
    const result = await callMitsuiApi({
      endpointPath,
      method: 'POST',
      body,
      offlineFallback: async () => {
        console.warn('[fetchGetRecord] Offline: load cached map data');
        const cache = await Database.getAppState('lastRecordCache');
        return cache ? JSON.parse(cache) : [];
      },
    });

    const dataArr = result?.data || result?.Data;
    if (!Array.isArray(dataArr)) return [];

    // Normalisasi struktur untuk MapView
    const mapped = dataArr.map((item) => ({
      id: item.Id || `${item.EmployeeName}-${item.CreatedDate}`,
      employeeName: item.EmployeeName,
      leaseNo: item.LeaseNo,
      contractName: item.CustName || '',
      latitude: parseFloat(item.Lattitude || item.Latitude),
      longitude: parseFloat(item.Longtitude || item.Longitude),
      createdDate: item.CreatedDate,
      address: item.Address || '',
      tipechekin:
        item.tipechekin ||
        (item.LabelMap === 'Start'
          ? 'start'
          : item.LabelMap === 'Stop'
          ? 'stop'
          : item.LabelMap === 'Checkin'
          ? 'kontrak'
          : item.Start
          ? 'start'
          : item.Stop
          ? 'stop'
          : item.CheckIn
          ? 'kontrak'
          : 'tracking'),
    }));

    // Simpan cache untuk offline
    await Database.saveAppState('lastRecordCache', JSON.stringify(mapped));

    return mapped;
  } catch (e) {
    // console.error('[listApi] Error fetchGetRecord:', e);
    return [];
  }
};

// /** ==============================
//  *  STATUS START / STOP
//  * ============================== */
// export const isStartedApi = async ({ EmployeeName, CreatedDate }) => {
//   const endpointPath = '/common/v1/mobile/isStarted';
//   const body = {
//     EmployeeName,
//     CreatedDate: CreatedDate || new Date().toISOString(),
//   };

//   return await callMitsuiApi({
//     endpointPath,
//     method: 'POST',
//     body,
//     offlineFallback: async () => {
//       console.warn('[isStartedApi] Offline fallback: read local status');
//       const localStatus = await Database.getAppState('isTracking');
//       return { Data: { isStarted: localStatus === 'true' } };
//     },
//   });
// };
// api/listApi.js
// -------------------- REPLACE isStartedApi IMPLEMENTATION WITH THIS --------------------

/**
 * Safe wrapper for isStartedApi:
 * - serializes concurrent calls (only one call to server at a time)
 * - caches last response for short duration (CACHE_MS)
 * - ensures body timestamp is deterministic for callers that pass forceDate (if provided)
 *
 * All callers that import isStartedApi from this file will automatically use this safe wrapper.
 */

const _isStartedState = {
  lock: false,
  queue: [], // array of {payload, resolve, reject}
  lastResponse: null,
  lastCallTime: 0,
  CACHE_MS: 3000, // cache for 3 seconds
  // you can adjust CACHE_MS to be larger if you want fewer calls (e.g. 5000 ms)
};

async function _callIsStartedServer(payload) {
  const endpointPath = '/common/v1/mobile/isStarted';
  const body = {
    EmployeeName: payload.EmployeeName,
    CreatedDate: payload.CreatedDate || new Date().toISOString(),
  };

  // callMitsuiApi is used (it should be exported/available in this file)
  return await callMitsuiApi({
    endpointPath,
    method: 'POST',
    body,
    offlineFallback: async () => {
      console.warn('[isStartedApi] Offline fallback: read local status');
      const localStatus = await Database.getAppState('isTracking');
      return { Data: { isStarted: localStatus === 'true' } };
    },
  });
}

/**
 * Public isStartedApi wrapper.
 * Usage unchanged: await isStartedApi({ EmployeeName, CreatedDate })
 */
export const isStartedApi = async (payload = {}) => {
  try {
    // If cached and fresh, return cached value
    const now = Date.now();
    if (
      _isStartedState.lastResponse &&
      now - _isStartedState.lastCallTime < _isStartedState.CACHE_MS
    ) {
      // return a shallow copy to avoid accidental mutation of cached object
      return JSON.parse(JSON.stringify(_isStartedState.lastResponse));
    }

    // If a request is ongoing, queue this caller and wait
    if (_isStartedState.lock) {
      return await new Promise((resolve, reject) => {
        _isStartedState.queue.push({ payload, resolve, reject });
      });
    }

    // Acquire lock and perform server call
    _isStartedState.lock = true;
    try {
      const serverRes = await _callIsStartedServer(payload);

      // Save cache
      _isStartedState.lastResponse = serverRes;
      _isStartedState.lastCallTime = Date.now();

      // Resolve any queued callers with same result
      while (_isStartedState.queue.length) {
        const q = _isStartedState.queue.shift();
        try {
          q.resolve(JSON.parse(JSON.stringify(serverRes)));
        } catch (e) {
          q.reject(e);
        }
      }

      return serverRes;
    } catch (err) {
      // Reject queued callers
      while (_isStartedState.queue.length) {
        const q = _isStartedState.queue.shift();
        q.reject(err);
      }
      throw err;
    } finally {
      _isStartedState.lock = false;
    }
  } catch (error) {
    // If anything goes wrong, bubble up the error (callers may fallback)
    throw error;
  }
};

