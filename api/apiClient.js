import { getAccessTokenFromMitsui } from './authApi';
import { generateMitsuiSignature } from '../utils/signatureHelper';
import Constants from 'expo-constants';

const BASE_URL = 'https://betaapi.mitsuilease.co.id:4151';
let cachedTokenData = null;

const MITSUI_CLIENT_SECRET = Constants.expoConfig?.extra?.MITSUI_CLIENT_SECRET || process.env.MITSUI_CLIENT_SECRET;

function isTokenExpired(tokenData) {
  if (!tokenData?.ValidTo) return true;
  // ValidTo format: 2025-06-30T11:46:05Z
  const expiry = new Date(tokenData.ValidTo);
  return Date.now() > expiry.getTime() - 60 * 1000; // refresh 1 menit sebelum expired
}

export const callMitsuiApi = async ({ endpointPath, method, body = {}, _retryData = null }) => {
  if (!cachedTokenData || isTokenExpired(cachedTokenData)) {
    cachedTokenData = await getAccessTokenFromMitsui();
  }

  const token = cachedTokenData.AccessToken;
  const clientSecret = MITSUI_CLIENT_SECRET;

  // Gunakan data retry jika ada, agar signature dan timestamp stabil
  const timestamp = _retryData?.timestamp || new Date().toISOString();
  const cleanedBody = removeUndefined(body);

  const signature = _retryData?.signature || generateMitsuiSignature(
    method,
    endpointPath,
    token.replace('Bearer ', ''),
    timestamp,
    cleanedBody,
    clientSecret
  );

  console.log('==== API REQUEST ====');
  console.log('Endpoint:', endpointPath);
  console.log('Method:', method);
  console.log('Token (short):', token.slice(0, 30) + '...');
  console.log('X-TIMESTAMP:', timestamp);
  console.log('Body:', cleanedBody);
  console.log('======================');

  console.log('==== API REQUEST FULL DETAIL ====');
  console.log('Endpoint:', endpointPath);
  console.log('Method:', method);
  console.log('Headers:', {
    Authorization: token,
    'X-PARTNER-ID': cachedTokenData.ClientId,
    'X-TIMESTAMP': timestamp,
    'X-SIGNATURE': signature,
    'Content-Type': 'application/json',
  });
  console.log('Body:', JSON.stringify(cleanedBody));
  console.log('==============================');

  const minifiedBodyForSignature = JSON.stringify(cleanedBody);
  console.log('==== DEBUG BODY SIGNATURE VS REQUEST ====');
  console.log('Minified body for signature:', minifiedBodyForSignature);
  console.log('Body sent to backend:', JSON.stringify(cleanedBody));
  console.log('========================================');

  const response = await fetch(`${BASE_URL}${endpointPath}`, {
    method,
    headers: {
      Authorization: token,
      'X-PARTNER-ID': cachedTokenData.ClientId,
      'X-TIMESTAMP': timestamp,
      'X-SIGNATURE': signature,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cleanedBody),
  });

  if (response.status === 401 && !_retryData) {
    console.warn('[Mitsui] Unauthorized. Retrying once with refreshed token...');
    cachedTokenData = await getAccessTokenFromMitsui();
    // Retry dengan _retryData agar signature dan timestamp tetap sama
    return callMitsuiApi({ endpointPath, method, body, _retryData: { timestamp, signature } });
  }

  const json = await response.json();
  return json;
};

const removeUndefined = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
  );
};
