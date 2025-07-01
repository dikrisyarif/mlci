// context/MapContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MapContext = createContext();

export const MapProvider = ({ children }) => {
  const [checkinLocations, setCheckinLocations] = useState([]);

  const loadCheckinsFromStorage = async () => {
  try {
    const json = await AsyncStorage.getItem('CheckinLocations');
    let parsed;
    try {
      parsed = JSON.parse(json || '[]');
      if (!Array.isArray(parsed)) parsed = [];
    } catch (err) {
      console.error('[MapContext] Invalid JSON format:', err);
      parsed = [];
    }
    setCheckinLocations(parsed);
    // console.log('[MapContext] Loaded check-ins from storage:', parsed);
  } catch (e) {
    console.error('[MapContext] Error loading CheckinLocations:', e);
    setCheckinLocations([]);
  }
};


  const clearCheckins = async () => {
    try {
      await AsyncStorage.removeItem('CheckinLocations');
      setCheckinLocations([]);
      // console.log('[MapContext] Cleared all check-ins');
    } catch (e) {
      console.error('[MapContext] Error clearing checkins:', e);
    }
  };

  // Helper untuk waktu lokal (WIB)
  function getLocalISOString(offsetHours = 7) {
    const now = new Date();
    now.setHours(now.getHours() + offsetHours);
    return now.toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss
  }

  const addCheckin = async (location) => {
    try {
      // Pastikan timestamp lokal
      const locWithLocalTime = {
        ...location,
        timestamp: location.timestamp || getLocalISOString(),
      };
      const updated = [...checkinLocations, locWithLocalTime];
      setCheckinLocations(updated);
      await AsyncStorage.setItem('CheckinLocations', JSON.stringify(updated));
      // console.log('[MapContext] Added check-in and saved:', locWithLocalTime);
    } catch (e) {
      console.error('[MapContext] Error saving checkin:', e);
    }
  };

  useEffect(() => {
    loadCheckinsFromStorage();
  }, []);

  return (
    <MapContext.Provider value={{ checkinLocations, addCheckin, loadCheckinsFromStorage, clearCheckins }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = () => useContext(MapContext);
