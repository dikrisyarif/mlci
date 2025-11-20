import React, { useEffect, useState } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useMap } from "../../context/MapContext";
import CustomAlert from "../CustomAlert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { isStartedApi } from "../../api/listApi";
import { useAuth } from "../../context/AuthContext";
import * as Database from "../../utils/database";

// 🔥 TrackingContext sebagai sumber kebenaran global tracking
import { useTracking } from "../../context/TrackingContext";

import { handleStart, handleStop } from "./trackingHelper";

const StartEndButton = ({
  onPress,
  checkinLocations: propCheckinLocations,
}) => {
  const { colors } = useTheme();

  // Checkin tetap dari MapContext → tidak diubah
  const { addCheckin, checkinLocations: contextCheckinLocations } = useMap();

  const checkinLocations = propCheckinLocations || contextCheckinLocations;

  // 🔥 Ambil Global Tracking State (yang benar)
  const { isStarted, setIsStarted } = useTracking();

  const { state: authState } = useAuth();

  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(false);

  // ============================================================
  // Load & Sync tracking status (local + server)
  // ============================================================
  useEffect(() => {
    const loadTrackingStatus = async () => {
      try {
        console.log("===== loadTrackingStatus() START =====");

        let employeeName =
          authState?.userInfo?.UserName || authState?.userInfo?.username;

        if (!employeeName) {
          const userInfoStr = await AsyncStorage.getItem("userInfo");
          if (userInfoStr) {
            const userInfo = JSON.parse(userInfoStr);
            employeeName = userInfo.UserName || userInfo.username;
          }
        }

        console.log("[loadTrackingStatus] employee =", employeeName);
        if (!employeeName) return;

        // LOCAL STATE
        const localStatus = await Database.getAppState("isTracking");
        console.log("[loadTrackingStatus] localStatus =", localStatus);

        if (localStatus !== null) {
          setIsStarted(localStatus === "true");
        }

        // SERVER
        const netInfo = await NetInfo.fetch();
        console.log(
          "[loadTrackingStatus] net connected =",
          netInfo.isConnected
        );

        if (netInfo.isConnected) {
          const now = new Date();
          console.log("[loadTrackingStatus] calling server isStartedApi...");

          const res = await isStartedApi({
            EmployeeName: employeeName,
            CreatedDate: now.toISOString(),
          });

          console.log("[loadTrackingStatus] server response =", res);

          if (res?.Data?.NextAction) {
            console.log(
              "[loadTrackingStatus] server NextAction =",
              res.Data.NextAction
            );

            const serverStatus = res.Data.NextAction === "Stop";
            setIsStarted(serverStatus);

            await Database.saveAppState(
              "isTracking",
              serverStatus ? "true" : "false"
            );
          }
        }
      } catch (e) {
        console.log("[loadTrackingStatus] ERROR =", e);
      }

      console.log("===== loadTrackingStatus() END =====");
    };

    loadTrackingStatus();
  }, [authState?.userInfo, checkinLocations]);

  // ============================================================
  // START handler
  // ============================================================
  const onStart = async () => {
    await handleStart({
      authState,
      addCheckin,
      setStarted: setIsStarted, // ← gunakan TrackingContext
      setLoading,
      onPress,
    });
  };

  // ============================================================
  // STOP handler
  // ============================================================
  const onStop = () => {
    setShowAlert(true);
  };

  const confirmStop = async () => {
    await handleStop({
      authState,
      addCheckin,
      setStarted: setIsStarted, // ← gunakan TrackingContext
      setLoading,
      onPress,
      setShowAlert,
    });
  };

  // ============================================================

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          isStarted
            ? { backgroundColor: "#d32f2f", borderColor: "#d32f2f" }
            : {
                backgroundColor: colors.button,
                borderColor: colors.buttonborder,
              },
          { borderWidth: 1, opacity: loading ? 0.7 : 1 },
        ]}
        onPress={isStarted ? onStop : onStart}
        disabled={loading}
      >
        {loading ? (
          <Text style={styles.buttonText}>Loading...</Text>
        ) : (
          <Text style={styles.buttonText}>{isStarted ? "Stop" : "Start"}</Text>
        )}
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
