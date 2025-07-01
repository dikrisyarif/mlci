import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_TASK_NAME = 'background-location-task';

// Task Manager untuk menangani lokasi latar belakang
// Fungsi hitung jarak haversine (meter)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius bumi dalam meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Error in background location task:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    const locationData = {
      timestamp: new Date().toISOString(),
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    const existingLogs = await AsyncStorage.getItem('locationLogs');
    const parsedLogs = JSON.parse(existingLogs || '[]');
    // Cek jarak ke lokasi terakhir
    if (parsedLogs.length > 0) {
      const last = parsedLogs[parsedLogs.length - 1];
      const dist = getDistanceFromLatLonInMeters(
        last.latitude,
        last.longitude,
        locationData.latitude,
        locationData.longitude
      );
      if (dist < 200) {
        // Tidak usah simpan jika < 200 meter
        return;
      }
    }
    parsedLogs.push(locationData);
    await AsyncStorage.setItem('locationLogs', JSON.stringify(parsedLogs));
  }
});

const CheckInScreen = ({ navigation }) => {
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    checkTrackingStatus();
  }, []);

  // Mengecek apakah background task sudah aktif
  const checkTrackingStatus = async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    setIsTracking(hasStarted);
  };

  // Helper untuk waktu lokal (WIB)
  function getLocalISOString(offsetHours = 7) {
    const now = new Date();
    now.setHours(now.getHours() + offsetHours);
    return now.toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss
  }

  // Fungsi check-in awal
  const handleCheckIn = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin lokasi diperlukan untuk check-in.');
        return;
      }
      let loc;
      try {
        loc = await Location.getCurrentPositionAsync({});
      } catch (e) {
        Alert.alert('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
        return;
      }
      if (!loc?.coords) {
        Alert.alert('Data lokasi tidak valid.');
        return;
      }
      const checkInData = {
        timestamp: getLocalISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      try {
        await AsyncStorage.setItem('CheckinLocations', JSON.stringify(checkInData));
      } catch (e) {
        Alert.alert('Gagal menyimpan data check-in.');
        return;
      }
      await startBackgroundTracking();
      navigation.navigate('MapTrackingScreen');
    } catch (err) {
      Alert.alert('Terjadi error saat check-in.', err?.message || '');
    }
  };

  // Mulai tracking lokasi di background
  const startBackgroundTracking = async () => {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      Alert.alert('Izin lokasi latar belakang diperlukan.');
      return;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 2 * 60 * 1000, // 2 menit
      distanceInterval: 10, // 10 meter
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Tracking lokasi aktif',
        notificationBody: 'Aplikasi sedang melacak lokasimu.',
      },
    });

    setIsTracking(true);
  };

  // Berhenti tracking
  const stopBackgroundTracking = async () => {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    setIsTracking(false);
    Alert.alert('Tracking dihentikan');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check-In & Background Tracking</Text>
      <Button title="Check-In dan Mulai Tracking" onPress={handleCheckIn} />
      {isTracking && (
        <Button title="Hentikan Tracking" onPress={stopBackgroundTracking} color="red" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, marginBottom: 20 },
});

export default CheckInScreen;
