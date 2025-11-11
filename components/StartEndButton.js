import React, { useState, useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useMap } from "../context/MapContext";
import * as Location from "expo-location";
import CustomAlert from "./CustomAlert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { isStartedApi } from "../api/listApi";
import { useAuth } from "../context/AuthContext";
import * as Database from "../utils/database";
import {
  startBackgroundTracking,
  stopBackgroundTracking,
} from "../backgroundTrackingManager";

const StartEndButton = ({
  isStarted,
  onPress,
  checkinLocations: propCheckinLocations,
}) => {
  const { colors } = useTheme();
  const { addCheckin, checkinLocations: contextCheckinLocations } = useMap();
  const checkinLocations = propCheckinLocations || contextCheckinLocations;
  const { state: authState } = useAuth();
  const [started, setStarted] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize database
  useEffect(() => {
    const initDb = async () => {
      try {
        //console.log('[StartEndButton] Resetting and initializing database...');
        // First reset the database
        await Database.resetDatabase();
        //console.log('[StartEndButton] Database reset complete');
        
        // Then initialize it
        await Database.initDatabase();
        //console.log('[StartEndButton] Database initialized');
        
        // Clear any stored tracking state
        await AsyncStorage.removeItem('isTracking');
        await AsyncStorage.removeItem('startTime');
        await AsyncStorage.removeItem('lastCheckinStartTimestamp');
        await AsyncStorage.removeItem('lastCheckinStartLoc');
        //console.log('[StartEndButton] Cleared stored tracking state');
        
      } catch (error) {
        console.error('[StartEndButton] Error during database reset:', error);
      }
    };
    initDb();
  }, []);

  // Load tracking status from local and sync with server
  useEffect(() => {
    const loadTrackingStatus = async () => {
      try {
        let employeeName = authState?.userInfo?.UserName || authState?.userInfo?.username;
        //console.log('[StartEndButton] Current employeeName:', employeeName);
        
        if (!employeeName) {
          //console.log('[StartEndButton] Employee name not found in authState, checking AsyncStorage...');
          const userInfoStr = await AsyncStorage.getItem("userInfo");
          if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            employeeName = userInfo.UserName || userInfo.username;
            //console.log('[StartEndButton] Found employee name in AsyncStorage:', employeeName);
          }
        }
        
        if (!employeeName) {
          //console.log('[StartEndButton] No employee name found, returning');
          return;
        }

        // First check local status
        //console.log('[StartEndButton] Checking local tracking status...');
        const localStatus = await Database.getAppState("isTracking");
        //console.log('[StartEndButton] Local tracking status:', localStatus);
        
        if (localStatus !== null) {
          const isTracking = localStatus === "true";
          //console.log('[StartEndButton] Setting started state to:', isTracking);
          setStarted(isTracking);
        }

        // Then try to sync with server if online
        //console.log('[StartEndButton] Checking network connection...');
        const netInfo = await NetInfo.fetch();
        //console.log('[StartEndButton] Network status:', netInfo.isConnected);
        
        if (netInfo.isConnected) {
          try {
            //console.log('[StartEndButton] Syncing with server...');
            const now = new Date();
            const res = await isStartedApi({
              EmployeeName: employeeName,
              CreatedDate: now.toISOString(),
            });

            if (res?.Data?.NextAction) {
              const serverStatus = res.Data.NextAction === "Stop";
              //console.log('[StartEndButton] Server status received:', { NextAction: res.Data.NextAction, serverStatus });
              setStarted(serverStatus);
              await Database.saveAppState("isTracking", serverStatus ? "true" : "false");
              //console.log('[StartEndButton] Status synced with server');
            }
          } catch (error) {
            console.error("[StartEndButton] Server sync error:", error);
          }
        } else {
          //console.log('[StartEndButton] No network connection, using local status only');
        }
      } catch (e) {
        console.error("[StartEndButton] Load status error:", e);
        console.error("[StartEndButton] Error details:", {
          message: e?.message,
          stack: e?.stack,
          name: e?.name
        });
      }
    };
    loadTrackingStatus();
  }, [authState?.userInfo, checkinLocations]);

  // useEffect berikut DINONAKTIFKAN agar status tombol hanya dari API
  // useEffect(() => {
  //   const checkTrackingStatus = async () => {
  //     try {
  //       const tracking = await AsyncStorage.getItem('isTracking');
  //       setStarted(tracking === 'true');
  //     } catch {
  //       setStarted(false);
  //     }
  //   };
  //   checkTrackingStatus();
  // }, []);

  // Helper waktu lokal
  function getLocalISOString(offsetHours = 7) {
    const now = new Date();
    now.setHours(now.getHours() + offsetHours);
    return now.toISOString().slice(0, 19);
  }

  // Handle Start
  const handleStart = async () => {
    //console.log('[StartEndButton] Starting handleStart...');
    setLoading(true);
    try {
      // Check location permission
      //console.log('[StartEndButton] Requesting location permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      //console.log('[StartEndButton] Location permission status:', status);
      if (status !== "granted") {
        //console.log('[StartEndButton] Location permission denied');
        Alert.alert("Izin lokasi diperlukan untuk check-in.");
        return;
      }

      // Get current location
      //console.log('[StartEndButton] Getting current location...');
      const loc = await Location.getCurrentPositionAsync({});
      //console.log('[StartEndButton] Location data received:', JSON.stringify(loc?.coords));
      if (!loc?.coords) {
        //console.log('[StartEndButton] Invalid location data');
        Alert.alert("Data lokasi tidak valid.");
        return;
      }

      // Get employee name
      //console.log('[StartEndButton] Getting employee name...');
      let employeeName = authState?.userInfo?.UserName || authState?.userInfo?.username;
      if (!employeeName) {
        //console.log('[StartEndButton] Employee name not found in authState, checking AsyncStorage...');
        const userInfoStr = await AsyncStorage.getItem("userInfo");
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          employeeName = userInfo.UserName || userInfo.username;
          //console.log('[StartEndButton] Found employee name in AsyncStorage:', employeeName);
        }
      }
      if (!employeeName) {
        //console.log('[StartEndButton] Employee name not found');
        Alert.alert("User tidak ditemukan, silakan login ulang.");
        return;
      }
      //console.log('[StartEndButton] Using employee name:', employeeName);

      let address = "";
      try {
        //console.log('[StartEndButton] Getting address for location...');
        address = await getBestAddress({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        //console.log('[StartEndButton] Address retrieved:', address);
      } catch (error) {
        //console.log('[StartEndButton] Error getting address:', error);
      }

      //console.log('[StartEndButton] Getting timestamp...');
      const timestamp = getLocalISOString();
      //console.log('[StartEndButton] Timestamp:', timestamp);

      const checkInData = {
        EmployeeName: employeeName,
        type: "start",
        tipechekin: "start",
        timestamp: timestamp,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        Address: address,
      };
      //console.log('[StartEndButton] CheckInData prepared:', JSON.stringify(checkInData));

      // Save to SQLite first
      //console.log('[StartEndButton] Saving tracking state to SQLite...');
      await Database.saveAppState("isTracking", "true");
      //console.log('[StartEndButton] Tracking state saved, adding checkin...');
      
      const checkinData = {
        employee_name: employeeName,
        lease_no: "_tracking_", // Special value for tracking, not a contract
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: timestamp,
        comment: "Start tracking",
        is_uploaded: 0,
        tipechekin: "start" // Add type to differentiate from contract check-ins
      };
      //console.log('[StartEndButton] Adding checkin to local DB:', JSON.stringify(checkinData));
      await Database.addCheckin(checkinData);
      //console.log('[StartEndButton] Checkin added to local DB');

      // Try to sync with server if online
      //console.log('[StartEndButton] Checking network connection...');
      const netInfo = await NetInfo.fetch();
      //console.log('[StartEndButton] Network status:', JSON.stringify(netInfo));
      
      if (netInfo.isConnected) {
        try {
          //console.log('[StartEndButton] Network available, syncing with server...');
          await addCheckin(checkInData);
          //console.log('[StartEndButton] Server sync successful');
        } catch (error) {
          console.error("[StartEndButton] Server sync error:", error);
          //console.log('[StartEndButton] Falling back to offline mode');
          Alert.alert(
            "Mode Offline",
            "Status start disimpan secara offline dan akan disinkronkan saat online."
          );
        }
      } else {
        //console.log('[StartEndButton] No network connection, using offline mode');
        Alert.alert(
          "Mode Offline",
          "Status start disimpan secara offline dan akan disinkronkan saat online."
        );
      }

      // Save local references
      //console.log('[StartEndButton] Saving start details to AsyncStorage...');
      await AsyncStorage.setItem("lastCheckinStartTimestamp", timestamp);
      await AsyncStorage.setItem(
        "lastCheckinStartLoc",
        JSON.stringify({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        })
      );
      //console.log('[StartEndButton] Start details saved to AsyncStorage');

      // Start background tracking
      //console.log('[StartEndButton] Starting background tracking...');
      await startBackgroundTracking(authState?.userInfo);
      //console.log('[StartEndButton] Background tracking started');
      
      //console.log('[StartEndButton] Updating UI state...');
      setStarted(true);
      if (onPress) {
        //console.log('[StartEndButton] Calling onPress callback...');
        onPress(true);
      }
      //console.log('[StartEndButton] Start process completed successfully');

    } catch (err) {
      console.error("[StartEndButton] Start error:", err);
      console.error("[StartEndButton] Error details:", {
        message: err?.message,
        stack: err?.stack,
        code: err?.code,
        name: err?.name
      });
      
      // Log the current state
      //console.log('[StartEndButton] State at error:', {
      //   started,
      //   loading,
      //   authState: JSON.stringify(authState),
      //   showAlert
      // });
      
      Alert.alert("Terjadi error saat memulai tracking.", err?.message || "");
    } finally {
      //console.log('[StartEndButton] Resetting loading state');
      setLoading(false);
    }
  };

  // Handle Stop
  const handleStop = async () => {
    setShowAlert(true);
  };

  // Konfirmasi stop
  const confirmStop = async () => {
    setShowAlert(false);
    setLoading(true);
    try {
      // Check location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin lokasi diperlukan untuk check-out.");
        return;
      }

      // Get current location
      const loc = await Location.getCurrentPositionAsync({});
      if (!loc?.coords) {
        Alert.alert("Data lokasi tidak valid.");
        return;
      }

      // Get employee name
      let employeeName = authState?.userInfo?.UserName || authState?.userInfo?.username;
      if (!employeeName) {
        const userInfoStr = await AsyncStorage.getItem("userInfo");
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          employeeName = userInfo.UserName || userInfo.username;
        }
      }

      let address = "";
      try {
        address = await getBestAddress({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {}

      const timestamp = getLocalISOString();
      const checkOutData = {
        type: "stop",
        tipechekin: "stop",
        timestamp: timestamp,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        Address: address,
      };

      // Save to SQLite first
      await Database.saveAppState("isTracking", "false");
      await Database.addCheckin({
        employee_name: employeeName,
        lease_no: "_tracking_", // Special value for tracking, not a contract
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: timestamp,
        comment: "Stop tracking",
        is_uploaded: 0,
        tipechekin: "stop" // Add type to differentiate from contract check-ins
      });

      // Try to sync with server if online
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        try {
          await addCheckin(checkOutData);
        } catch (error) {
          //console.log("[StartEndButton] Server sync error:", error);
          Alert.alert(
            "Mode Offline",
            "Status stop disimpan secara offline dan akan disinkronkan saat online."
          );
        }
      } else {
        Alert.alert(
          "Mode Offline",
          "Status stop disimpan secara offline dan akan disinkronkan saat online."
        );
      }

      // Stop background tracking
      await stopBackgroundTracking();
      setStarted(false);
      if (onPress) onPress(false);

    } catch (err) {
      console.error("[StartEndButton] Stop error:", err);
      Alert.alert("Terjadi error saat menghentikan tracking.", err?.message || "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          started
            ? { backgroundColor: "#d32f2f", borderColor: "#d32f2f" }
            : {
                backgroundColor: colors.button,
                borderColor: colors.buttonborder,
              },
          { borderWidth: 1 },
        ]}
        onPress={started ? handleStop : handleStart}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{started ? "Stop" : "Start"}</Text>
      </TouchableOpacity>
      <CustomAlert
        visible={showAlert}
        onClose={() => setShowAlert(false)}
        onConfirm={confirmStop}
        message="Are you want to finish all job ?"
        mode="confirm"
      />
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 5,
    borderRadius: 5,
    alignItems: "center",
    margin: 5,
    width: 200,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
  },
});

export default StartEndButton;
