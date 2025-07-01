import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useMap } from '../context/MapContext';
import * as Location from 'expo-location';
import CustomAlert from './CustomAlert';

const StartEndButton = ({ isStarted, onPress }) => {
  const { colors } = useTheme();
  const { addCheckin, checkinLocations } = useMap();
  const [started, setStarted] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cek status started dari checkinLocations saat mount/berubah
  useEffect(() => {
    // Cari index start terakhir
    const lastStartIdx = [...checkinLocations].reverse().findIndex(c => c.type === 'start');
    if (lastStartIdx === -1) {
      setStarted(false);
      return;
    }
    // Cari index stop setelah start terakhir
    const lastStopIdx = [...checkinLocations].reverse().findIndex(c => c.type === 'stop');
    // Jika tidak ada stop setelah start, berarti masih started
    setStarted(lastStopIdx === -1 || lastStopIdx > lastStartIdx);
  }, [checkinLocations]);

  // Helper waktu lokal
  function getLocalISOString(offsetHours = 7) {
    const now = new Date();
    now.setHours(now.getHours() + offsetHours);
    return now.toISOString().slice(0, 19);
  }

  // Mulai tracking lokasi di background
  const startBackgroundTracking = async () => {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      Alert.alert('Izin lokasi latar belakang diperlukan.');
      return;
    }
    await Location.startLocationUpdatesAsync('background-location-task', {
      accuracy: Location.Accuracy.High,
      timeInterval: 2 * 60 * 1000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Tracking lokasi aktif',
        notificationBody: 'Aplikasi sedang melacak lokasimu.'
      },
    });
  };

  // Berhenti tracking
  const stopBackgroundTracking = async () => {
    await Location.stopLocationUpdatesAsync('background-location-task');
  };

  // Handle Start
  const handleStart = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin lokasi diperlukan untuk check-in.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      if (!loc?.coords) {
        Alert.alert('Data lokasi tidak valid.');
        setLoading(false);
        return;
      }
      const checkInData = {
        type: 'start',
        timestamp: getLocalISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      await addCheckin(checkInData);
      await startBackgroundTracking();
      setStarted(true);
      if (onPress) onPress(true);
    } catch (err) {
      Alert.alert('Terjadi error saat check-in.', err?.message || '');
    }
    setLoading(false);
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin lokasi diperlukan untuk check-out.');
        setLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      if (!loc?.coords) {
        Alert.alert('Data lokasi tidak valid.');
        setLoading(false);
        return;
      }
      const checkOutData = {
        type: 'stop',
        timestamp: getLocalISOString(),
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      await addCheckin(checkOutData);
      await stopBackgroundTracking();
      setStarted(false);
      if (onPress) onPress(false);
    } catch (err) {
      Alert.alert('Terjadi error saat check-out.', err?.message || '');
    }
    setLoading(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          started
            ? { backgroundColor: '#d32f2f', borderColor: '#d32f2f' }
            : { backgroundColor: colors.button, borderColor: colors.buttonborder },
          { borderWidth: 1 },
        ]}
        onPress={started ? handleStop : handleStart}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{started ? 'Stop' : 'Start'}</Text>
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
    alignItems: 'center',
    margin: 5,
    width: 200,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
  },
});

export default StartEndButton;