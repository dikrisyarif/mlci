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
import { useTracking } from "../../context/TrackingContext";

import { handleStart, handleStop } from "./trackingHelper";

const StartEndButton = ({ onPress, checkinLocations: propCheckinLocations }) => {
  const { colors } = useTheme();
  const { addCheckin, checkinLocations: mapCheckins } = useMap();
  const { isStarted, setIsStarted } = useTracking();
  const { state: authState } = useAuth();

  const checkinLocations = propCheckinLocations || mapCheckins;

  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(false);

  // ============================================================
  // Load & Sync tracking status (Local + Server)
  // ============================================================
  useEffect(() => {
    const loadTrackingStatus = async () => {
      try {
        let employeeName =
          authState?.userInfo?.UserName || authState?.userInfo?.username;

        if (!employeeName) {
          const stored = await AsyncStorage.getItem("userInfo");
          if (stored) {
            const info = JSON.parse(stored);
            employeeName = info.UserName || info.username;
          }
        }
        if (!employeeName) return;

        // LOCAL
        const localStatus = await Database.getAppState("isTracking");
        if (localStatus !== null) {
          setIsStarted(localStatus === "true");
        }

        // SERVER
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          const res = await isStartedApi({
            EmployeeName: employeeName,
            CreatedDate: new Date().toISOString(),
          });

          const nextAction = res?.Data?.NextAction;
          if (nextAction) {
            const serverStarted = nextAction === "Stop";
            setIsStarted(serverStarted);

            await Database.saveAppState(
              "isTracking",
              serverStarted ? "true" : "false"
            );
          }
        }
      } catch (e) {
        console.log("[loadTrackingStatus] ERROR", e);
      }
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
      setStarted: setIsStarted,
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
      setStarted: setIsStarted,
      setLoading,
      onPress,
      setShowAlert,
    });
  };

  // ============================================================
  // UI
  // ============================================================
  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          isStarted
            ? { backgroundColor: "#d32f2f", borderColor: "#d32f2f" }
            : { backgroundColor: colors.button, borderColor: colors.buttonborder },
          { borderWidth: 1, opacity: loading ? 0.7 : 1 },
        ]}
        onPress={isStarted ? onStop : onStart}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Loading..." : isStarted ? "Stop" : "Start"}
        </Text>
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
