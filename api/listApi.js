// src/api/listApi.js
import { callMitsuiApi } from './apiClient';

export const fetchListDtl = async ({ EmployeeName = '', LeaseNo = '' }) => {
  const endpointPath = '/common/v1/mobile/get-list-dtl';
  const body = { EmployeeName, LeaseNo };

  const result = await callMitsuiApi({ endpointPath, method: 'POST', body });
  return result;
};

// src/api/listApi.js

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
    Latitude: Latitude.toString(),
    Longitude: Longitude.toString(),
    CheckIn: CheckIn, // sudah string lokal
    CreatedDate: new Date().toISOString(),
  };
  const result = await callMitsuiApi({ endpointPath, method: 'PUT', body });
  return result;
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
  //console.log('[ListApi] Mengirim update comment ke server:', body);
  try {
    const result = await callMitsuiApi({ endpointPath, method: 'PUT', body });
    //console.log('[ListApi] Hasil update comment:', result);
    return result;
  } catch (error) {
    console.error('[ListApi] Error update comment:', error);
    throw error;
  }
};

// Insert check-in (start, stop, tracking, kontrak) ke /common/v1/mobile/save
export const saveCheckinToServer = async ({
  EmployeeName,
  Lattitude,
  Longtitude,
  CreatedDate,
  Address = '',
  tipechekin = 'tracking',
  localTimestamp, // tambahkan argumen opsional
}) => {
  const endpointPath = '/common/v1/mobile/save';
  // Gunakan localTimestamp jika ada, jika tidak pakai CreatedDate
  const finalCreatedDate = localTimestamp || CreatedDate;
  let body = {
    EmployeeName,
    Lattitude,
    Longtitude,
    CreatedDate: finalCreatedDate,
    Address: '', // default kosong
    CheckIn: false,
    Start: false,
    Stop: false,
    MockProvider: false,
  };
  if (tipechekin === 'start') {
    body.Start = true;
    body.Address = Address;
    // CheckIn dan Stop tetap false
  } else if (tipechekin === 'stop') {
    body.Stop = true;
    body.Address = Address;
    // CheckIn dan Start tetap false
  } else if (tipechekin === 'kontrak') {
    body.CheckIn = true;
    body.Address = Address;
    // Start dan Stop tetap false
  }
  // tracking: semua false
  // //console.log('[listApi] Payload ke API saveCheckinToServer:', { endpointPath, body });
  const result = await callMitsuiApi({ endpointPath, method: 'POST', body });
  // //console.log('[listApi] Response dari API saveCheckinToServer:', result);
  return result;
};

// Ambil data marker untuk MapView dari API /common/v1/mobile/get-record
// Pastikan EmployeeName diambil dari parameter (misal: profile.UserName dari context seperti di ListContractScreen)
export const fetchGetRecord = async ({ EmployeeName, CreatedDate } = {}) => {
  // EmployeeName WAJIB dari parameter, fallback ke storage hanya jika tidak ada
  let employeeName = EmployeeName;
  if (!employeeName) {
    // //console.warn('[listApi] fetchGetRecord: EmployeeName is empty! Data tidak akan diambil dari server. Pastikan parameter EmployeeName dikirim dari context (profile.UserName)');
  }
  // CreatedDate default: hari ini (ISO string)
  const createdDate = CreatedDate || new Date().toISOString();
  const endpointPath = '/common/v1/mobile/get-record';
  const body = { EmployeeName: employeeName, CreatedDate: createdDate };
  // //console.log('[listApi] Trigger fetchGetRecord:', { endpointPath, body });
  try {
    const result = await callMitsuiApi({ endpointPath, method: 'POST', body });
    // //console.log('[listApi] Response fetchGetRecord:', result);
    // Mapping ke format marker MapView
    const dataArr = result?.data || result?.Data;
    if (Array.isArray(dataArr)) {
      return dataArr.map((item) => ({
        id: item.Id || item.id || `${item.EmployeeName}-${item.CheckinDate || item.CreatedDate}`,
        employeeName: item.EmployeeName,
        leaseNo: item.LeaseNo,
        contractName: item.CustName || '',
        latitude: parseFloat(item.Lattitude || item.Latitude),
        longitude: parseFloat(item.Longtitude || item.Longitude),
        createdDate: item.CreatedDate || item.CheckinDate,
        address: item.Address || '',
        tipechekin: item.tipechekin ||
          (item.LabelMap === 'Start' ? 'start' : item.LabelMap === 'Stop' ? 'stop' : item.LabelMap === 'Checkin' ? 'kontrak' : (item.Start ? 'start' : item.Stop ? 'stop' : item.CheckIn ? 'kontrak' : 'tracking')),
        // Tambahan field lain jika perlu
      }));
    }
    return [];
  } catch (e) {
    console.error('[listApi] Error fetchGetRecord:', e);
    return [];
  }
};

// Mengecek status start/stop dari server
export const isStartedApi = async ({ EmployeeName, CreatedDate }) => {
  const endpointPath = '/common/v1/mobile/isStarted';
  const body = {
    EmployeeName,
    CreatedDate: CreatedDate || new Date().toISOString(),
  };
  const result = await callMitsuiApi({ endpointPath, method: 'POST', body });
  return result;
};

