// App.js
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Navigation from './navigation/AppNavigator';
import { AuthProvider } from './context/AuthContext';
import { ApiProvider } from './context/ApiContext';
import { ThemeProvider } from './context/ThemeContext';
import { useFonts, DancingScript_400Regular } from '@expo-google-fonts/dancing-script';
import SplashScreenComponent from './SplashScreen';
import { MapProvider } from './context/MapContext';
import { LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Database from './utils/database';

// DEBUG: Log checkinLocations setiap kali app mount
LogBox.ignoreLogs(['Warning: ...']); // Ignore log notification by message

// (async () => {
//   try {
//     const data = await AsyncStorage.getItem('CheckinLocations');
//     //console.log('DEBUG: CheckinLocations on app start:', data);
//   } catch (e) {
//     //console.log('DEBUG: Gagal membaca CheckinLocations', e);
//   }
// })();

const App = () => {
  const [fontsLoaded] = useFonts({
    DancingScript_400Regular,
  });

  const [isSplashVisible, setSplashVisible] = useState(true);
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [dbInitError, setDbInitError] = useState(null);

  // Initialize database and schedule cleanup
  useEffect(() => {
    let mounted = true;

    const initializeApplication = async () => {
      const maxAttempts = 3;
      let attempt = 0;
      let lastError = null;
      while (attempt < maxAttempts && mounted) {
        attempt++;
        try {
          //console.log('[DEBUG] App.js: Initializing database (attempt', attempt, ')...');
          const db = await Database.initDatabase();
          if (db && db._db && db._db.filename) {
            console.log('[DEBUG][App.js] DB path:', db._db.filename);
          } else if (db && db.filename) {
            console.log('[DEBUG][App.js] DB path:', db.filename);
          } else {
            console.log('[DEBUG][App.js] DB path: [unknown]');
          }

          // Import dependencies only after DB initialized
          const { migratePendingLocationsToDatabase } = await import('./services/trackingService');
          const { initializeApp } = await import('./app/initialization');

          // Get current user
          const employeeName = await AsyncStorage.getItem('employeeName');
          if (employeeName) {
            await initializeApp(employeeName);
          }

          await migratePendingLocationsToDatabase();

          if (mounted) {
            setIsDbInitialized(true);
            setDbInitError(null);
          }
          return;
        } catch (error) {
          lastError = error;
          console.error('[DEBUG] App.js: DB init attempt failed:', attempt, error);
          // small backoff
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }

      if (mounted) {
        setDbInitError(lastError ? String(lastError.message || lastError) : 'Unknown error');
      }
    };

    initializeApplication();

    return () => { mounted = false; };
  }, []); // Empty dependency array means this runs once on mount

  // Show loading indicator while initializing
  if (!fontsLoaded || !isDbInitialized) {
    if (dbInitError) {
      return (
        <View style={[styles.container, { padding: 20 }]}> 
          <Text style={{ marginBottom: 12, textAlign: 'center' }}>Failed to initialize local database:</Text>
          <Text style={{ marginBottom: 20, color: 'red', textAlign: 'center' }}>{dbInitError}</Text>
          <TouchableOpacity onPress={() => { setDbInitError(null); setIsDbInitialized(false); /* trigger retry by re-running effect via state change */ window.requestAnimationFrame(() => location.reload()); }} style={{ padding: 12, backgroundColor: '#007bff', borderRadius: 8 }}>
            <Text style={{ color: '#fff' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#32a852" />
      </View>
    );
  }

  // Main app render
  return (
    <AuthProvider>
      <ApiProvider>
        <ThemeProvider>
          <MapProvider>
            {isSplashVisible ? (
              <SplashScreenComponent onFinish={() => setSplashVisible(false)} />
            ) : (
              <Navigation />
            )}
          </MapProvider>
        </ThemeProvider>
      </ApiProvider>
    </AuthProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  }
});

export default App;
