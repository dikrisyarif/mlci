// context/MapContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import { saveCheckinToServer } from "../api/listApi";
import { useAuth } from "./AuthContext";
import * as Location from "expo-location";
import * as Database from "../utils/database";
import { getLocalTrackings } from "../utils/map/trackingDB";

const MapContext = createContext();

export const MapProvider = ({ children }) => {
  const [checkinLocations, setCheckinLocations] = useState([]); 
  const { state } = useAuth();
 

  const loadCheckinsFromStorage = async () => {
    try {
      // read combined tracking data from sqlite
      const employeeName = state?.userInfo?.UserName || state?.userInfo?.username;
      if (!employeeName) {
        setCheckinLocations([]);
        return;
      }
  const rows = await getLocalTrackings(employeeName);
      const mapped = rows.map(r => ({
        contractId: r.lease_no || null,
        contractName: r.cust_name || null,
        latitude: r.latitude,
        longitude: r.longitude,
        timestamp: r.checkin_date,
        tipechekin: (r.label_map || 'Tracking').toLowerCase(),
      }));
      setCheckinLocations(mapped);
    } catch (e) {
      console.warn('[MapContext] loadCheckinsFromStorage error:', e?.message || e);
      setCheckinLocations([]);
    }
  };

  const clearCheckins = async () => {
    try {
      const employeeName = state?.userInfo?.UserName || state?.userInfo?.username;
      if (employeeName) {
        // remove from sqlite for this employee
        await Database.executeWithLog('runAsync', 'DELETE FROM background_tracks WHERE employee_name = ?;', [employeeName], false, true);
        await Database.executeWithLog('runAsync', 'DELETE FROM checkin_startstop WHERE employee_name = ?;', [employeeName], false, true);
        await Database.executeWithLog('runAsync', 'DELETE FROM contract_checkins WHERE employee_name = ?;', [employeeName], false, true);
      }
      setCheckinLocations([]);
    } catch (e) {
      console.warn('[MapContext] Error clearing checkins:', e?.message || e);
    }
  };

  // Helper untuk waktu lokal (WIB)
  function getLocalISOString(offsetHours = 7) {
    const now = new Date();
    now.setHours(now.getHours() + offsetHours);
    return now.toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss
  }

  // Helper: Ambil address dari reverse geocode, prioritas street+number, fallback ke city/district, dengan caching
  async function getBestAddress({ latitude, longitude, Address }) {
    if (Address && Address.trim()) return Address;
    if (!latitude || !longitude) return "";

    const cacheKey = `address_${latitude}_${longitude}`;
    try {
      // check app_state cache first
      const cached = await Database.getAppState(cacheKey);
      if (cached) return cached;

      // Try reverse geocode
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude }, { useGoogleMaps: false });
        let bestAddress = "";
        if (geocode && geocode[0]) {
          const g = geocode[0];
          let street = g.street || "";
          let number = g.name || g.streetNumber || "";
          let city = g.city || g.subregion || g.district || g.region || "";

          if (street && number) bestAddress = `${street} No. ${number}`;
          else if (street) bestAddress = street;
          else if (city) bestAddress = city;
        }

        if (bestAddress) {
          await Database.saveAppState(cacheKey, bestAddress);
          return bestAddress;
        }
      } catch (geoErr) {
        // ignore geocode errors, fallback below
      }

      const fallbackAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      await Database.saveAppState(cacheKey, fallbackAddress);
      return fallbackAddress;
    } catch (err) {
      // fallback
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }

  const addCheckin = async (location) => {
    try {
      // Pastikan timestamp lokal
      const locWithLocalTime = {
        ...location,
        timestamp: location.timestamp || getLocalISOString(),
        tipechekin: location.tipechekin || location.type || "tracking",
      };
      // Cek duplikasi berdasarkan contractId, tipechekin, dan timestamp
      const isDuplicate = checkinLocations.some(
        (l) =>
          l.contractId === locWithLocalTime.contractId &&
          l.tipechekin === locWithLocalTime.tipechekin &&
          l.timestamp === locWithLocalTime.timestamp
      );
      if (isDuplicate) return;
      const updated = [...checkinLocations, locWithLocalTime];
      setCheckinLocations(updated);

      // persist to sqlite using appropriate helper depending on type
      const employeeName = state?.userInfo?.UserName || state?.userInfo?.username || '';
      if (locWithLocalTime.tipechekin === 'start' || locWithLocalTime.tipechekin === 'stop') {
        await Database.addCheckinStartStop({
          employee_name: employeeName,
          type: locWithLocalTime.tipechekin,
          latitude: locWithLocalTime.latitude,
          longitude: locWithLocalTime.longitude,
          timestamp: locWithLocalTime.timestamp,
        });
        // save lastCheckinStartTimestamp/Loc to app_state for other services
        if (locWithLocalTime.tipechekin === 'start') {
          await Database.saveAppState('lastCheckinStartTimestamp', locWithLocalTime.timestamp);
          await Database.saveAppState('lastCheckinStartLoc', JSON.stringify({ latitude: locWithLocalTime.latitude, longitude: locWithLocalTime.longitude }));
        }
      } else if (locWithLocalTime.tipechekin === 'kontrak' || locWithLocalTime.tipechekin === 'contract' || locWithLocalTime.tipechekin === 'checkin') {
        await Database.addCheckin({
          lease_no: locWithLocalTime.contractId || '_contract_',
          employee_name: employeeName,
          latitude: locWithLocalTime.latitude,
          longitude: locWithLocalTime.longitude,
          timestamp: locWithLocalTime.timestamp,
          comment: locWithLocalTime.remark || locWithLocalTime.comment || '',
          address: locWithLocalTime.address || '',
        });
      } else {
        // tracking/background
        await Database.saveBackgroundLocation({
          latitude: locWithLocalTime.latitude,
          longitude: locWithLocalTime.longitude,
          timestamp: locWithLocalTime.timestamp,
        }, employeeName);
      }

      // Kirim ke server (start, stop, kontrak semuanya pakai address terbaik)
      const userName =
        state?.userInfo?.UserName || state?.userInfo?.username || "";
      const address = await getBestAddress(locWithLocalTime);
      //console.log(`[MapContext] Akan kirim ke API saveCheckinToServer tipe: ${locWithLocalTime.tipechekin}`, {
      //   EmployeeName: userName,
      //   Lattitude: locWithLocalTime.latitude,
      //   Longtitude: locWithLocalTime.longitude,
      //   CreatedDate: locWithLocalTime.timestamp,
      //   Address: address,
      //   tipechekin: locWithLocalTime.tipechekin,
      // });
      const apiResult = await saveCheckinToServer({
        EmployeeName: userName,
        Lattitude: locWithLocalTime.latitude,
        Longtitude: locWithLocalTime.longitude,
        CreatedDate: locWithLocalTime.timestamp,
        Address: address,
        tipechekin: locWithLocalTime.tipechekin,
      });
      //console.log(`[MapContext] Hasil panggil API saveCheckinToServer tipe: ${locWithLocalTime.tipechekin}`, apiResult);
    } catch (e) {
      // console.error("[MapContext] Error saving checkin:", e);
    }
  };

  // Tambahkan fungsi untuk hanya update lokal tanpa trigger API
  const addCheckinLocal = async (location) => {
    try {
      const locWithLocalTime = {
        ...location,
        timestamp: location.timestamp || getLocalISOString(),
        tipechekin: location.tipechekin || location.type || "tracking",
      };
      const isDuplicate = checkinLocations.some(
        (l) =>
          l.contractId === locWithLocalTime.contractId &&
          l.tipechekin === locWithLocalTime.tipechekin &&
          l.timestamp === locWithLocalTime.timestamp
      );
      if (isDuplicate) return;
      const updated = [...checkinLocations, locWithLocalTime];
      setCheckinLocations(updated);

      // persist locally like addCheckin but without calling API
      const employeeName = state?.userInfo?.UserName || state?.userInfo?.username || '';
      if (locWithLocalTime.tipechekin === 'start' || locWithLocalTime.tipechekin === 'stop') {
        await Database.addCheckinStartStop({
          employee_name: employeeName,
          type: locWithLocalTime.tipechekin,
          latitude: locWithLocalTime.latitude,
          longitude: locWithLocalTime.longitude,
          timestamp: locWithLocalTime.timestamp,
        });
        if (locWithLocalTime.tipechekin === 'start') {
          await Database.saveAppState('lastCheckinStartTimestamp', locWithLocalTime.timestamp);
          await Database.saveAppState('lastCheckinStartLoc', JSON.stringify({ latitude: locWithLocalTime.latitude, longitude: locWithLocalTime.longitude }));
        }
      } else if (locWithLocalTime.tipechekin === 'kontrak' || locWithLocalTime.tipechekin === 'contract' || locWithLocalTime.tipechekin === 'checkin') {
        await Database.addCheckin({
          lease_no: locWithLocalTime.contractId || '_contract_',
          employee_name: employeeName,
          latitude: locWithLocalTime.latitude,
          longitude: locWithLocalTime.longitude,
          timestamp: locWithLocalTime.timestamp,
          comment: locWithLocalTime.remark || locWithLocalTime.comment || '',
          address: locWithLocalTime.address || '',
        });
      } else {
        await Database.saveBackgroundLocation({
          latitude: locWithLocalTime.latitude,
          longitude: locWithLocalTime.longitude,
          timestamp: locWithLocalTime.timestamp,
        }, employeeName);
      }
    } catch (e) {
      console.warn('[MapContext] Error saving checkin (local only):', e?.message || e);
    }
  };

  useEffect(() => {
    loadCheckinsFromStorage();
  }, []);

  return (
    <MapContext.Provider
      value={{
        checkinLocations,
        addCheckin,
        addCheckinLocal,
        loadCheckinsFromStorage,
        clearCheckins, 
      }}
    >
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => useContext(MapContext);
