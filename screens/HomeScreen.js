// screens/HomeScreen.js
import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  BackHandler,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useTheme } from "../context/ThemeContext";
import { useFocusEffect } from "@react-navigation/native";
import CustomAlert from "../components/CustomAlert";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMap } from "../context/MapContext";
import {
  getContracts as dbGetContracts,
  getContractsRaw as dbGetContractsRaw,
  resetDatabase,
} from "../utils/database";
import { isStartedApi } from "../api/listApi";
import NetInfo from "@react-native-community/netinfo";

// FIXED — pakai nama fungsi yang BENAR dari TrackingContext
import { useTracking } from "../context/TrackingContext";

const HomeScreen = ({ navigation }) => {

  const [loggingContracts, setLoggingContracts] = React.useState(false);
  const [localContracts, setLocalContracts] = React.useState([]);

  const { state } = require("../context/AuthContext").useAuth();

  // ✔ gunakan setIsStarted, bukan setStartedGlobal
  const { setIsStarted, isStarted } = useTracking();

  const handleLogContracts = async () => {
    setLoggingContracts(true);
    try {
      const userName = state?.userInfo?.UserName || "unknown";
      const contracts = await dbGetContracts(userName);
      setLocalContracts(contracts);
      alert("Data kontrak lokal sudah ditampilkan di log.");
    } catch (e) {
      alert("Gagal mengambil data kontrak: " + e.message);
    }
    setLoggingContracts(false);
  };

  // KEEP ORIGINAL — Fetch Local Contracts
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const fetchLocalContracts = async () => {
        try {
          const userName = state?.userInfo?.UserName || "unknown";
          let retryCount = 0;
          let contracts = [];

          while (retryCount < 3) {
            if (retryCount > 0) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            contracts = await dbGetContracts(userName);

            try {
              const raw = await dbGetContractsRaw();
              console.log(
                "[DEBUG][HomeScreen] raw contracts rows:",
                raw.length,
                // raw.map((r) => ({ id: r.id, employee_name: r.employee_name }))
              );
            } catch (e) {
              // console.error("[DEBUG][HomeScreen] failed to read raw rows:", e);
            }

            if (contracts.length > 0) break;
            retryCount++;
          }

          if (mounted) setLocalContracts(contracts);
        } catch (error) {
          // console.error("[HomeScreen][useFocusEffect] Error:", error);
        }
      };

      fetchLocalContracts();
      return () => {
        mounted = false;
      };
    }, [state?.userInfo?.UserName])
  );

  // KEEP ORIGINAL — Reset DB
  const [resetting, setResetting] = React.useState(false);
  // const handleResetDatabase = async () => {
  //   setResetting(true);
  //   try {
  //     await resetDatabase();
  //     const userName = state?.userInfo?.UserName || "unknown";
  //     await dbGetContracts(userName);
  //     alert("Database lokal berhasil direset!");
  //   } catch (e) {
  //     alert("Gagal reset database: " + e.message);
  //   }
  //   setResetting(false);
  // };

  const { colors } = useTheme();
  const { clearCheckins } = useMap();
  const { signOut } = require("../context/AuthContext").useAuth();

  const [exitAlert, setExitAlert] = React.useState(false);

  // KEEP ORIGINAL — Exit Handling
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        setExitAlert(true);
        return true;
      };
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );
      return () => subscription.remove();
    }, [])
  );

  const handleExit = async () => {
    setExitAlert(false);
    // cleanup legacy AsyncStorage keys (locationLogs kept for compatibility)
    try { await AsyncStorage.removeItem("locationLogs"); } catch(e){}
    if (clearCheckins) await clearCheckins();
    if (typeof signOut === "function") await signOut();
  };

  // ─────────────────────────────────────────────
  // FIXED: INITIAL TRACKING CHECK (GLOBAL)
  // ─────────────────────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;

      const checkTracking = async () => {
        try {
          const employeeName =
            state?.userInfo?.UserName || state?.userInfo?.username;
          if (!employeeName) return;

          // Ambil status lokal dulu
          const local = await AsyncStorage.getItem("isTracking");
          if (mounted) setIsStarted(local === "true");

          // Cek koneksi → offline stop
          const net = await NetInfo.fetch();
          if (!net.isConnected) return;

          // Panggil API sekali saja
          const now = new Date().toISOString();
          const res = await isStartedApi({
            EmployeeName: employeeName,
            CreatedDate: now,
          });

          if (res?.Data?.NextAction) {
            const active = res.Data.NextAction === "Stop";

            await AsyncStorage.setItem("isTracking", active ? "true" : "false");

            if (mounted) setIsStarted(active);
          }
        } catch (err) {
          console.warn("[HomeScreen] Initial track sync failed:", err.message);
        }
      };

      checkTracking();
      return () => (mounted = false);
    }, [state?.userInfo?.UserName])
  );

  // ─────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("ListContract")}
      >
        <Icon name="list" size={40} color="#fff" />
        <Text style={styles.text}>List Contract</Text>
      </TouchableOpacity>

      {/* <TouchableOpacity
        style={[styles.button, { backgroundColor: "#f44336" }]}
        onPress={handleResetDatabase}
        disabled={resetting}
      >
        <Icon name="trash" size={40} color="#fff" />
        <Text style={styles.text}>
          {resetting ? "Resetting..." : "Reset DB (Dummy)"}
        </Text>
      </TouchableOpacity> */}

      <CustomAlert
        visible={exitAlert}
        onClose={() => setExitAlert(false)}
        onConfirm={handleExit}
        message="Are you sure want to exit?"
        mode="confirm"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-evenly",
    alignItems: "center",
    flexDirection: "row",
    padding: 20,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#007bff",
    padding: 20,
    borderRadius: 15,
  },
  text: {
    marginTop: 10,
    color: "#fff",
    fontWeight: "bold",
  },
});

export default HomeScreen;
