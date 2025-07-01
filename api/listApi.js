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
  const result = await callMitsuiApi({ endpointPath, method: 'PUT', body });
  return result;
};

