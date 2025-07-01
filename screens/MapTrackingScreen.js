import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, AppState, Modal, Text } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import haversine from 'haversine-distance';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useMap } from '../context/MapContext';
import { useTheme } from '../context/ThemeContext';
import { GOOGLE_MAPS_APIKEY } from '../config/config';

const MapTrackingScreen = () => {
  const { colors } = useTheme();
  const { checkinLocations, clearCheckins } = useMap();

  const [trackingRoute, setTrackingRoute] = useState([]);
  const [filteredRoute, setFilteredRoute] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const appState = useRef(AppState.currentState);

  const logLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      const newLog = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      };

      const existing = JSON.parse(await AsyncStorage.getItem('locationLogs') || '[]');
      const updated = [...existing, newLog];
      await AsyncStorage.setItem('locationLogs', JSON.stringify(updated));
      setTrackingRoute(updated);
    } catch (err) {
      console.error('Error logging location:', err);
    }
  };

  const filterByDate = (data, date) => {
    if (!date) return setFilteredRoute(data);
    const selected = new Date(date).toDateString();
    const filtered = data.filter(loc => new Date(loc.timestamp).toDateString() === selected);
    setFilteredRoute(filtered);
  };
  const deduplicateLocationLogs = async () => {
    try {
      const raw = await AsyncStorage.getItem('locationLogs');
      const logs = JSON.parse(raw || '[]');
      const clean = deduplicatePoints(logs);
      await AsyncStorage.setItem('locationLogs', JSON.stringify(clean));
      Alert.alert('Sukses', `Sebelum: ${logs.length}, Sesudah: ${clean.length}`);
      loadTrackingData();
    } catch (e) {
      console.log('Dedup gagal:', e);
    }
  };

  const clearAll = async () => {
    await AsyncStorage.removeItem('locationLogs');
    await clearCheckins();
    setRoute([]);
    setFilteredRoute([]);
    setOptimizedRoute([]);
  };
  const loadTrackingData = useCallback(async () => {
    try {
      const raw = JSON.parse(await AsyncStorage.getItem('locationLogs') || '[]');
      // Filter hanya titik > 200 meter
      const filtered = filterByDistance(raw, 200);
      setTrackingRoute(filtered);
      filterByDate(filtered, selectedDate);
    } catch (e) {
      console.log('Error loading locationLogs:', e);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadTrackingData();
  }, [loadTrackingData]);

  // Run every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      logLocation();
      loadTrackingData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (checkinLocations.length > 0) {
      const combined = [...trackingRoute, ...checkinLocations];
      setTrackingRoute(combined);
      filterByDate(combined, selectedDate);
      buildOptimizedRoute(combined);
    }
  }, [checkinLocations, selectedDate]);

  const deduplicatePoints = (data) => {
    return data.reduce((acc, curr) => {
      if (!acc.length) return [curr];
      const prev = acc[acc.length - 1];
      const dist = haversine(
        { latitude: prev.latitude, longitude: prev.longitude },
        { latitude: curr.latitude, longitude: curr.longitude }
      );
      if (dist > 20) acc.push(curr);
      return acc;
    }, []);
  };

  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length - 1; i += size - 1) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const snapToRoads = async (points) => {
    const path = points.map(p => `${p.latitude},${p.longitude}`).join('|');
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${GOOGLE_MAPS_APIKEY}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      return (data.snappedPoints || []).map(p => ({
        latitude: p.location.latitude,
        longitude: p.location.longitude,
      }));
    } catch {
      return [];
    }
  };

  const fetchDirections = async (points) => {
    if (points.length < 2) return [];
    const origin = `${points[0].latitude},${points[0].longitude}`;
    const destination = `${points[points.length - 1].latitude},${points[points.length - 1].longitude}`;
    const waypoints = points.slice(1, -1).map(p => `${p.latitude},${p.longitude}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_APIKEY}&mode=driving${waypoints ? `&waypoints=${waypoints}` : ''}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      const steps = json.routes?.[0]?.legs?.flatMap(leg => leg.steps) || [];
      return steps.map(step => ({
        latitude: step.end_location.lat,
        longitude: step.end_location.lng,
      }));
    } catch {
      return [];
    }
  };

  const buildOptimizedRoute = async (sourceData) => {
    setLoading(true);
    const clean = deduplicatePoints(sourceData);
    const chunks = chunkArray(clean, 100);

    const snapped = [];
    for (const chunk of chunks) {
      const s = await snapToRoads(chunk);
      snapped.push(...s);
    }

    const final = await fetchDirections(snapped.length ? snapped : clean);
    setOptimizedRoute(final.length ? final : clean);
    setLoading(false);
  };

  const onExport = async () => {
    try {
      const exportData = [...filteredRoute, ...checkinLocations];
      const json = JSON.stringify(exportData, null, 2);
      const fileUri = FileSystem.documentDirectory + 'tracking_export.json';
      await FileSystem.writeAsStringAsync(fileUri, json);
      await Sharing.shareAsync(fileUri);
    } catch {
      Alert.alert('Export Error', 'Gagal ekspor file.');
    }
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  // Gabungkan semua marker untuk urutan global berdasarkan timestamp
  const allMarkers = [
    ...filteredRoute.map((loc, i) => ({
      ...loc,
      type: i === 0 ? 'start' : (i === filteredRoute.length - 1 ? 'stop' : 'tracking'),
      index: i,
      source: 'route',
    })),
    ...checkinLocations.map((loc, i) => ({
      ...loc,
      type: 'checkin',
      source: 'checkin',
    }))
  ];
  // Urutkan berdasarkan timestamp
  const sortedMarkers = allMarkers
    .filter(m => m.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((m, idx) => ({ ...m, order: idx + 1 }));

  // Helper untuk dapatkan info marker dari urutan global
  const getMarkerInfo = (loc, type, extra) => {
    const found = sortedMarkers.find(m => m.latitude === loc.latitude && m.longitude === loc.longitude && m.timestamp === loc.timestamp && m.type === type);
    if (!found) return { no: '?', label: '', time: loc.timestamp, contractName: extra?.contractName };
    let label = '';
    if (type === 'start') label = 'Start';
    else if (type === 'stop') label = 'STOP';
    else if (type === 'tracking') label = 'Tracking';
    else if (type === 'checkin') label = extra?.contractName || 'Check-in';
    return { no: found.order, label, time: found.timestamp, contractName: extra?.contractName };
  };

  const initial = filteredRoute[0] || checkinLocations[0];
  const region = initial
    ? { latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: -6.2, longitude: 106.816666, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={{ flex: 1 }}>
      {loading && <ActivityIndicator style={{ position: 'absolute', top: '50%', alignSelf: 'center' }} />}
      <MapView style={StyleSheet.absoluteFillObject} initialRegion={region} showsUserLocation>
        {filteredRoute.map((loc, i) => {
          let pinColor = 'yellow';
          let type = 'tracking';
          if (i === 0) {
            pinColor = 'green';
            type = 'start';
          } else if (i === filteredRoute.length - 1) {
            pinColor = 'red';
            type = 'stop';
          }
          const markerInfo = getMarkerInfo(loc, type);
          return (
            <Marker
              key={`track-${i}`}
              coordinate={loc}
              pinColor={pinColor}
              onPress={() => setSelectedMarker(markerInfo)}
            />
          );
        })}
        {checkinLocations.map((loc, i) => {
          const markerInfo = getMarkerInfo(loc, 'checkin', { contractName: loc.contractName });
          return (
            <Marker
              key={`checkin-${i}`}
              coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
              pinColor="purple"
              onPress={() => setSelectedMarker(markerInfo)}
            />
          );
        })}
        {optimizedRoute.length > 1 && (
          <Polyline coordinates={optimizedRoute} strokeColor="#007AFF" strokeWidth={3} />
        )}
      </MapView>

      {/* Modal info marker */}
      <Modal
        visible={!!selectedMarker}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMarker(null)}
      >
        <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.3)' }}>
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:24, alignItems:'center', minWidth:220 }}>
            <Text style={{ fontSize:22, fontWeight:'bold', marginBottom:8 }}>No. {selectedMarker?.no}</Text>
            {selectedMarker?.label === 'Check-in' && selectedMarker?.contractName ? (
              <Text style={{ fontSize:18, color:'#8e24aa', marginBottom:8 }}>{selectedMarker.contractName}</Text>
            ) : (
              <Text style={{ fontSize:18, color:selectedMarker?.label==='STOP'?'#d32f2f':selectedMarker?.label==='Start'?'#388e3c':'#007bff', marginBottom:8 }}>{selectedMarker?.label}</Text>
            )}
            <Text style={{ fontSize:16 }}>{selectedMarker?.time ? new Date(selectedMarker.time).toLocaleString() : ''}</Text>
            <TouchableOpacity style={{ marginTop:18 }} onPress={() => setSelectedMarker(null)}>
              <Text style={{ color:'#007bff', fontWeight:'bold', fontSize:16 }}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.buttonRow}>
        <TouchableOpacity onPress={onExport} style={styles.iconButton}>
          <Icon name="file-download" size={24} color={colors.button} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.iconButton}>
          <Icon name="date-range" size={24} color={colors.button} />
        </TouchableOpacity>
        <TouchableOpacity onPress={deduplicateLocationLogs} style={[styles.iconButton, { backgroundColor: colors.primary }]}>
          <Icon name="social-distance" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={clearAll} style={[styles.iconButton, { backgroundColor: '#f44336' }]}>
          <Icon name="delete-forever" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  buttonRow: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  iconButton: {
    padding: 12,
    backgroundColor: '#eee',
    borderRadius: 25,
  },
});

// Fungsi hitung jarak haversine (meter)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Filter array: hanya titik > 200 meter dari sebelumnya
function filterByDistance(data, minDistance = 200) {
  if (!data.length) return [];
  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    const prev = result[result.length - 1];
    const curr = data[i];
    const dist = getDistanceFromLatLonInMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    if (dist > minDistance) result.push(curr);
  }
  return result;
}

export default MapTrackingScreen;
