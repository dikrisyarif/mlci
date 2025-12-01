// api/apiClient.js
import { getAccessTokenFromMitsui } from "./authApi";
import { generateMitsuiSignature } from "../utils/signatureHelper";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { acquireEndpointLock } from "../utils/requestLocks";

import {
  requestLocks,
  waitForTokenRefresh,
  resolvePendingTokenWaiters,
} from "../utils/requestLocks";

const BASE_URL = "https://betaapi.mitsuilease.co.id:4151";
const MITSUI_CLIENT_SECRET =
  Constants.expoConfig?.extra?.MITSUI_CLIENT_SECRET ||
  process.env.MITSUI_CLIENT_SECRET;

let cachedTokenData = null;

function canonicalJSON(obj) {
  if (!obj || typeof obj !== "object") return "";
  const sortKeys = (value) => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      const sorted = {};
      Object.keys(value)
        .sort()
        .forEach((k) => {
          sorted[k] = sortKeys(value[k]);
        });
      return sorted;
    }
    return value;
  };
  return JSON.stringify(sortKeys(obj));
}

function isTokenExpired(tokenData) {
  if (!tokenData?.ValidTo) return true;
  const expiry = new Date(tokenData.ValidTo);
  return Date.now() > expiry.getTime() - 60 * 1000;
}

function removeUndefined(obj) {
  if (!obj || typeof obj !== "object") return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
  );
}

async function refreshTokenLocked() {
  if (requestLocks.tokenRefresh) {
    return waitForTokenRefresh();
  }

  requestLocks.tokenRefresh = true;
  try {
    const newTokenData = await getAccessTokenFromMitsui();
    cachedTokenData = newTokenData;
    resolvePendingTokenWaiters(newTokenData);
    return newTokenData;
  } catch (err) {
    resolvePendingTokenWaiters(null);
    throw err;
  } finally {
    requestLocks.tokenRefresh = false;
  }
}

export const callMitsuiApi = async ({
  endpointPath,
  method,
  body = {},
  offlineFallback = null,
  opts = {},
}) => {
  const cleanedBodyObject = removeUndefined(body);
  const bodyString = canonicalJSON(cleanedBodyObject);

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.warn(`[apiClient] Offline mode — skip API: ${endpointPath}`);
      if (offlineFallback) return await offlineFallback();
      throw new Error("Offline mode: no internet connection");
    }

    if (!cachedTokenData || isTokenExpired(cachedTokenData)) {
      await refreshTokenLocked();
    }

    if (!cachedTokenData) {
      cachedTokenData = await refreshTokenLocked();
    }

    let token = cachedTokenData.AccessToken;
    const clientId = cachedTokenData.ClientId;

    const timestamp = opts.forceDate || new Date().toISOString();
    const tokenForSign = token.replace(/^Bearer\s+/i, "");

    const release = await acquireEndpointLock(endpointPath);
    let signature;
    try {
      signature = generateMitsuiSignature(
        method,
        endpointPath,
        tokenForSign,
        timestamp,
        bodyString,
        MITSUI_CLIENT_SECRET
      );
    } finally {
      release();
    }

    const response = await fetch(`${BASE_URL}${endpointPath}`, {
      method,
      headers: {
        Authorization: token,
        "X-PARTNER-ID": clientId,
        "X-TIMESTAMP": timestamp,
        "X-SIGNATURE": signature,
        "Content-Type": "application/json",
      },
      body: bodyString || undefined,
    });

    // 5. handle 401 -> refresh token once (locked) and retry using SAME timestamp
    if (response.status === 401) {
      console.warn("[apiClient] Unauthorized. Refreshing token...");

      const newTokenData = await refreshTokenLocked();
      if (!newTokenData) throw new Error("Failed to refresh token");

      cachedTokenData = newTokenData;

      const newToken = cachedTokenData.AccessToken;
      const newClientId = cachedTokenData.ClientId;

      // VERY IMPORTANT → retry MUST use SAME timestamp for signature
      const retryTimestamp = timestamp;
      const retryTokenForSign = newToken.replace(/^Bearer\s+/i, "");

      const releaseRetry = await acquireEndpointLock(endpointPath);
      let retrySignature;
      try {
        retrySignature = generateMitsuiSignature(
          method,
          endpointPath,
          retryTokenForSign,
          retryTimestamp,
          bodyString,
          MITSUI_CLIENT_SECRET
        );
      } finally {
        releaseRetry();
      }

      const retryResponse = await fetch(`${BASE_URL}${endpointPath}`, {
        method,
        headers: {
          Authorization: newToken,
          "X-PARTNER-ID": newClientId,
          "X-TIMESTAMP": retryTimestamp,
          "X-SIGNATURE": retrySignature,
          "Content-Type": "application/json",
        },
        body: bodyString || undefined,
      });

      if (!retryResponse.ok) {
        const retryText = await retryResponse.text();
        let retryJson;
        try {
          retryJson = JSON.parse(retryText);
        } catch {
          retryJson = { raw: retryText };
        }
        // console.error("[apiClient] HTTP Error (retry)", {
        //   endpointPath,
        //   method,
        //   status: retryResponse.status,
        //   body: retryJson,
        // });
        throw new Error(
          `HTTP ${retryResponse.status} - ${
            retryJson?.Message || JSON.stringify(retryJson)
          }`
        );
      }

      const retryText = await retryResponse.text();
      try {
        return JSON.parse(retryText);
      } catch {
        return { raw: retryText };
      }
    }

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!response.ok) {
      // console.error("[apiClient] HTTP Error", {
      //   endpointPath,
      //   method,
      //   status: response.status,
      //   body: json,
      // });
      throw new Error(
        `HTTP ${response.status} - ${json?.Message || JSON.stringify(json)}`
      );
    }

    return json;
  } catch (error) {
    if (error.message?.includes("Network request failed")) {
      console.warn(`[apiClient] Network lost mid-request: ${endpointPath}`);
      if (offlineFallback) return await offlineFallback();
    }

    // console.error("[apiClient] Network/Fetch error", {
    //   endpointPath,
    //   method,
    //   body: bodyString,
    //   message: error?.message,
    //   stack: error?.stack,
    // });
    throw error;
  }
};
