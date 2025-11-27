// App.js
import React, { useState, useEffect } from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import Navigation from "./navigation/AppNavigator";
import { AuthProvider } from "./context/AuthContext";
import { ApiProvider } from "./context/ApiContext";
import { ThemeProvider } from "./context/ThemeContext";
import { TrackingProvider } from "./context/TrackingContext";
import {
  useFonts,
  DancingScript_400Regular,
} from "@expo-google-fonts/dancing-script";
import SplashScreenComponent from "./SplashScreen";
import { MapProvider } from "./context/MapContext";
import { LogBox } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Database from "./utils/database";

import "./locationTask"
// ✅ Tambah import custom hook untuk auto sync
import { useAutoSync } from "./hooks/useAutoSync";

LogBox.ignoreLogs(["Warning: ..."]); // Ignore specific warnings

const App = () => {
  const [fontsLoaded] = useFonts({
    DancingScript_400Regular,
  });

  const [isSplashVisible, setSplashVisible] = useState(true);
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [dbInitError, setDbInitError] = useState(null);
  const [retryFlag, setRetryFlag] = useState(0); // trigger re-run on retry

  // Initialize database and migrate
  useEffect(() => {
    let mounted = true;

    const initializeApplication = async () => {
      const maxAttempts = 3;
      let attempt = 0;
      let lastError = null;

      while (attempt < maxAttempts && mounted) {
        attempt++;
        try {
          // console.log(
          //   // `[DEBUG][App.js] Initializing database (attempt ${attempt})...`
          // );

          // 1. Initialize DB
          const db = await Database.initDatabase();
          // if (db?.filename || db?._db?.filename) {
          //   console.log(
          //     "[DEBUG][App.js] DB path:",
          //     db.filename || db._db.filename
          //   );
          // } else {
          //   console.log("[DEBUG][App.js] DB path: [unknown]");
          // }

          // 2. Import services AFTER DB ready
          const { migratePendingLocationsToDatabase } = await import(
            "./services/tracking"
          );
          const { initializeApp } = await import("./app/initialization");

          // 3. Migrate any pending location data
          await migratePendingLocationsToDatabase();

          // 4. Initialize app if logged in
          const employeeName = await AsyncStorage.getItem("employeeName");
          if (employeeName) {
            await initializeApp(employeeName);
          }

          // ✅ Jangan start AutoSyncWorker langsung di sini lagi
          // (akan otomatis dijalankan oleh useAutoSync setelah user login & tracking aktif)

          if (mounted) {
            setIsDbInitialized(true);
            setDbInitError(null);
          }

          // console.log(
          //   "[DEBUG][App.js] Database initialization completed successfully."
          // );
          return; // success — exit retry loop
        } catch (error) {
          lastError = error;
          // console.error(
          //   `[DEBUG][App.js] DB init attempt ${attempt} failed:`,
          //   error
          // );
          await new Promise((r) => setTimeout(r, 1000 * attempt)); // exponential backoff
        }
      }

      // ❌ all attempts failed
      if (mounted) {
        const message =
          lastError?.message || String(lastError) || "Unknown error";
        setDbInitError(message);
        // console.error(
        //   "[DEBUG][App.js] Final DB initialization error:",
        //   message
        // );
      }
    };

    initializeApplication();

    return () => {
      mounted = false;
    };
  }, [retryFlag]); // run again on retry

  // Error state — show retry UI
  if (dbInitError) {
    return (
      <View style={[styles.container, { padding: 20 }]}>
        <Text style={{ marginBottom: 12, textAlign: "center" }}>
          Failed to initialize local database:
        </Text>
        <Text style={{ marginBottom: 20, color: "red", textAlign: "center" }}>
          {dbInitError}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setDbInitError(null);
            setIsDbInitialized(false);
            setRetryFlag((v) => v + 1); // trigger re-run
          }}
          style={{
            padding: 12,
            backgroundColor: "#007bff",
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold" }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading state
  if (!fontsLoaded || !isDbInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#32a852" />
      </View>
    );
  }

  // Main app render
  return (
    <TrackingProvider>
      <AuthProvider>
        <ApiProvider>
          <ThemeProvider>
            <MapProvider>
              <AutoSyncWrapper>
                {isSplashVisible ? (
                  <SplashScreenComponent
                    onFinish={() => setSplashVisible(false)}
                  />
                ) : (
                  <Navigation />
                )}
              </AutoSyncWrapper>
            </MapProvider>
          </ThemeProvider>
        </ApiProvider>
      </AuthProvider>
    </TrackingProvider>
  );
};

// ✅ Tambahkan AutoSyncWrapper untuk menjalankan hook di dalam context
const AutoSyncWrapper = ({ children }) => {
  useAutoSync();
  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
});

export default App;
