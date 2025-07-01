import CryptoJS from 'crypto-js';

export const generateMitsuiSignature = (method, endpointPath, accessToken, timestamp, body, clientSecret) => {
  const jsonBody = JSON.stringify(body); // Jaga key order dan spasi di value
  const hashedBody = CryptoJS.SHA256(jsonBody).toString(CryptoJS.enc.Hex).toLowerCase();

  const stringToSign = `${method}:${endpointPath}:${accessToken}:${hashedBody}:${timestamp}`;

  console.log('==== DEBUG Signature ====');
  console.log('JSON Body:', jsonBody);
  console.log('SHA-256 Hex:', hashedBody);
  console.log('StringToSign:', stringToSign);
  console.log('==========================');

  // Pastikan clientSecret diambil dari environment variable di pemanggil, bukan hardcoded di sini
  const signature = CryptoJS.HmacSHA512(stringToSign, clientSecret).toString(CryptoJS.enc.Hex);
  return signature;
};
