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

  // Initialize database and schedule cleanup
  useEffect(() => {
    const initializeApplication = async () => {
      try {
        //console.log('[DEBUG] App.js: Initializing database and scheduled tasks...');
        const db = await Database.initDatabase();
        if (db && db._db && db._db.filename) {
          console.log('[DEBUG][App.js] DB path:', db._db.filename);
        } else if (db && db.filename) {
          console.log('[DEBUG][App.js] DB path:', db.filename);
        } else {
          console.log('[DEBUG][App.js] DB path: [unknown]');
        }
        //console.log('[DEBUG] App.js: Database initialized successfully');

        // Import dependencies
        const { migratePendingLocationsToDatabase } = await import('./services/trackingService');
        const { initializeApp } = await import('./app/initialization');

        // Get current user
        const employeeName = await AsyncStorage.getItem('employeeName');
        if (!employeeName) {
          // //console.warn('[DEBUG] App.js: No employee name found, cleanup scheduling skipped');
        } else {
          // Initialize app with cleanup scheduling
          //console.log('[DEBUG] App.js: Initializing app with cleanup scheduling for', employeeName);
          await initializeApp(employeeName);
        }

        // Migrate any pending locations from AsyncStorage to SQLite
        //console.log('[DEBUG] App.js: Checking for pending locations to migrate...');
        await migratePendingLocationsToDatabase();

        setIsDbInitialized(true);
      } catch (error) {
        console.error('[DEBUG] App.js: Failed to initialize application:', error);
        // Still set as initialized to not block app launch, but log the error
        setIsDbInitialized(true);
      }
    };

    initializeApplication();
  }, []); // Empty dependency array means this runs once on mount

  // Show loading indicator while initializing
  if (!fontsLoaded || !isDbInitialized) {
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
