import Constants from 'expo-constants';

const MITSUI_CLIENT_ID = Constants.expoConfig?.extra?.MITSUI_CLIENT_ID || process.env.MITSUI_CLIENT_ID;
const MITSUI_CLIENT_SECRET = Constants.expoConfig?.extra?.MITSUI_CLIENT_SECRET || process.env.MITSUI_CLIENT_SECRET;

// src/api/authApi.js
export const getAccessTokenFromMitsui = async () => {
  const formBody = new URLSearchParams();
  formBody.append('ClientId', MITSUI_CLIENT_ID);
  formBody.append('ClientSecret', MITSUI_CLIENT_SECRET);

const localRequestTime = new Date();
console.log('[Mitsui] Requesting access token...');
  const response = await fetch(
    'https://betaapi.mitsuilease.co.id:4200/oauth/v1/auth/accesstoken?GrantType=client_credentials',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    }
  );

  const json = await response.json();
    console.log('[Mitsui] Access Token Response:', json);
  if (!json.Data) throw new Error('Failed to get Mitsui access token');

  return {
    ...json.Data,
    LocalRequestTime: localRequestTime.toISOString(),
    ServerIssuedTime: json.Data.ValidFrom, // ambil dari respons server
  };
};


export const loginToMitsui = async ({ username, password }) => {
  const tokenData = await getAccessTokenFromMitsui();
  const timestamp = new Date().toISOString();
  const method = 'POST';
  const endpointPath = '/common/v1/mobile/login';
  const fullUrl = `https://betaapi.mitsuilease.co.id:4151${endpointPath}`;
  const clientSecret = MITSUI_CLIENT_SECRET;

  const body = { Username: username, Password: password };
  const { generateMitsuiSignature } = await import('../utils/signatureHelper');

  const signature = generateMitsuiSignature(
    method,
    endpointPath,
    tokenData.AccessToken.replace('Bearer ', ''),
    timestamp,
    body,
    clientSecret
  );

  const response = await fetch(fullUrl, {
    method,
    headers: {
      'Authorization': tokenData.AccessToken,
      'X-PARTNER-ID': tokenData.ClientId,
      'X-SIGNATURE': signature,
      'X-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  return { result, accessToken: tokenData.AccessToken, clientId: tokenData.ClientId };
};
