import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, AppState, Modal, Text } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialIcons';
import haversine from 'haversine-distance';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useMap } from '../context/MapContext';
import { useTheme } from '../context/ThemeContext';
import { GOOGLE_MAPS_APIKEY } from '../config/config';
import { fetchGetRecord, saveCheckinToServer } from '../api/listApi';
import { useAuth } from '../context/AuthContext';
import GlobalLoading from '../components/GlobalLoading';

const MapTrackingScreen = () => {
  const { colors } = useTheme();
  const { checkinLocations, clearCheckins } = useMap();
  const { state } = useAuth();
  const profile = state.userInfo || {};

  const [trackingRoute, setTrackingRoute] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [renderError, setRenderError] = useState(null);
  const [markers, setMarkers] = useState([]);
  const appState = useRef(AppState.currentState);

  // Helper: format date ke string lokal WIB (GMT+7), bulat detik
  const getLocalWIBDateString = (date = new Date()) => {
    // WIB = UTC+7
    const wibOffset = 7 * 60; // in minutes
    const local = new Date(date.getTime() + (wibOffset - date.getTimezoneOffset()) * 60000);
    // Bulatkan ke detik (hilangkan milidetik)
    local.setMilliseconds(0);
    const pad = n => n.toString().padStart(2, '0');
    return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
  };

  const logLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      // Timestamp bulat detik
      const now = new Date();
      now.setMilliseconds(0);
      const newLog = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: getLocalWIBDateString(now), // sudah bulat detik
      };

      const existing = JSON.parse(await AsyncStorage.getItem('locationLogs') || '[]');
      const updated = [...existing, newLog];
      await AsyncStorage.setItem('locationLogs', JSON.stringify(updated));
      setTrackingRoute(updated);

      // Cek duplikasi dan interval sebelum insert ke DB
      if (profile?.UserName) {
        const lastSentKey = `lastTrackingSent_${profile.UserName}`;
        const lastSentStr = await AsyncStorage.getItem(lastSentKey);
        let isDuplicate = false;
        let isTooSoon = false;
        if (lastSentStr) {
          try {
            const lastSent = JSON.parse(lastSentStr);
            // Cek timestamp dan koordinat
            isDuplicate = lastSent && lastSent.timestamp === newLog.timestamp && lastSent.latitude === newLog.latitude && lastSent.longitude === newLog.longitude;
            // Cek interval minimal 1 menit
            const lastTime = new Date(lastSent.timestamp);
            const currTime = new Date(newLog.timestamp);
            const diffMs = currTime - lastTime;
            isTooSoon = diffMs < 1 * 60 * 1000; // kurang dari 1 menit
            // Cek koordinat sama persis
            if (lastSent.latitude === newLog.latitude && lastSent.longitude === newLog.longitude && isTooSoon) {
              isDuplicate = true;
            }
          } catch {}
        }
        if (!isDuplicate && !isTooSoon) {
          await saveCheckinToServer({
            EmployeeName: profile.UserName,
            Lattitude: newLog.latitude,
            Longtitude: newLog.longitude,
            CreatedDate: newLog.timestamp, // sudah format lokal WIB, bulat detik
            tipechekin: 'tracking',
          });
          await AsyncStorage.setItem(lastSentKey, JSON.stringify(newLog));
        } else {
          //console.log('[TRACKING] Skip insert: duplikat atau <2 menit dari titik sebelumnya');
        }
      }
    } catch (err) {
      // console.error('Error logging location:', err);
    }
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
      //console.log('Dedup gagal:', e);
    }
  };

  const clearAll = async () => {
    await AsyncStorage.removeItem('locationLogs');
    await clearCheckins();
    setRoute([]);
    setOptimizedRoute([]);
  };
  const loadTrackingData = useCallback(async () => {
    try {
      const raw = JSON.parse(await AsyncStorage.getItem('locationLogs') || '[]');
      // Filter hanya titik > 200 meter
      const filtered = filterByDistance(raw, 200);
      setTrackingRoute(filtered);
    } catch (e) {
      //console.log('Error loading locationLogs:', e);
    }
  }, []);

  useEffect(() => {
    loadTrackingData();
  }, [loadTrackingData]);

  // Best practice: Remove tracking interval from screen, use global manager for background tracking
  // Tracking should be started/stopped globally (e.g. via StartEndButton/global context)
  // Here, only load tracking data for visualization
  // If you want to refresh data periodically, use a short interval (e.g. 10s) ONLY for UI refresh, not for logging location
  useEffect(() => {
    const interval = setInterval(() => {
      loadTrackingData();
    }, 10000); // 10s UI refresh
    return () => clearInterval(interval);
  }, [loadTrackingData]);

  useEffect(() => {
    if (checkinLocations.length > 0) {
      const combined = [...trackingRoute, ...checkinLocations];
      setTrackingRoute(combined);
      buildOptimizedRoute(combined);
    }
  }, [checkinLocations]);

  // Ambil marker dari server saat screen di-load
  useEffect(() => {
    const fetchMarkers = async () => {
      setLoading(true);
      try {
        // Ambil EmployeeName dari context
        const data = await fetchGetRecord({ EmployeeName: profile.UserName });
        // //console.log('[MAPVIEW] Data marker dari server:', JSON.stringify(data, null, 2));
        setMarkers(data);
      } catch (e) {
        setMarkers([]);
      }
      setLoading(false);
    };
    fetchMarkers();
  }, [profile.UserName]);

  // Update optimizedRoute setiap markers dari server berubah
  useEffect(() => {
    if (sortedServerMarkers.length > 1) {
      buildOptimizedRoute(sortedServerMarkers.map(m => ({ latitude: m.latitude, longitude: m.longitude })));
    }
  }, [markers]);

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
      const exportData = [...trackingRoute, ...checkinLocations];
      const json = JSON.stringify(exportData, null, 2);
      const fileUri = FileSystem.documentDirectory + 'tracking_export.json';
      await FileSystem.writeAsStringAsync(fileUri, json);
      await Sharing.shareAsync(fileUri);
    } catch {
      Alert.alert('Export Error', 'Gagal ekspor file.');
    }
  };

  // Gabungkan semua marker untuk urutan global berdasarkan timestamp
  const allMarkers = [
    ...trackingRoute.map((loc, i) => ({
      ...loc,
      tipechekin: loc.tipechekin, // pastikan tipechekin ikut
      type: i === 0 ? 'start' : (i === trackingRoute.length - 1 ? 'stop' : 'tracking'),
      index: i,
      source: 'route',
    })),
    ...checkinLocations.map((loc, i) => ({
      ...loc,
      tipechekin: loc.tipechekin, // pastikan tipechekin ikut
      type: 'checkin',
      source: 'checkin',
    }))
  ];
  // Urutkan berdasarkan timestamp
  const sortedMarkers = allMarkers
    .filter(m => m.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((m, idx) => ({ ...m, order: idx + 1 }));

  // Urutkan marker dari server berdasarkan CheckinDate (createdDate)
  const sortedServerMarkers = markers
    .filter(m => m.createdDate && typeof m.latitude === 'number' && typeof m.longitude === 'number' && !isNaN(m.latitude) && !isNaN(m.longitude))
    .sort((a, b) => new Date(a.createdDate) - new Date(b.createdDate))
    .map((m, idx) => ({ ...m, order: idx + 1 }));

  // Helper untuk info marker dari server
  const getMarkerInfo = (loc) => {
    const found = sortedServerMarkers.find(m => m.latitude === loc.latitude && m.longitude === loc.longitude && m.createdDate === loc.createdDate);
    let label = '';
    let color = '#007bff';
    let tipe = loc.tipechekin || loc.type;
    if (found) {
      tipe = found.tipechekin || found.type;
    }
    if (tipe === 'start') { label = 'Start'; color = '#388e3c'; }
    else if (tipe === 'stop') { label = 'STOP'; color = '#d32f2f'; }
    else if (tipe === 'kontrak') { label = 'Kontrak'; color = '#8e24aa'; }
    else if (tipe === 'tracking') { label = 'Tracking'; color = 'orange'; }
    return {
      no: found ? found.order : '?',
      label,
      color,
      time: found ? found.createdDate : loc.createdDate,
      contractName: found ? found.contractName : loc.contractName
    };
  };

  const initial = trackingRoute[0] || checkinLocations[0];
  const region = initial
    ? { latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: -6.2, longitude: 106.816666, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  if (!GOOGLE_MAPS_APIKEY) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red', fontSize: 18, textAlign: 'center' }}>
          GOOGLE_MAPS_APIKEY tidak ditemukan. Cek konfigurasi app.json dan .env.
        </Text>
      </View>
    );
  }

  // Error boundary wrapper
  const SafeMapView = (props) => {
    try {
      return props.children;
    } catch (err) {
      setRenderError(err.message || 'Unknown error');
      return null;
    }
  };

  if (renderError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red', fontSize: 18, textAlign: 'center' }}>
          Terjadi error saat render Map: {renderError}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <GlobalLoading visible={loading} />
      <SafeMapView>
        <MapView style={StyleSheet.absoluteFillObject} initialRegion={region} showsUserLocation>
          {markers.filter(loc =>
            typeof loc.latitude === 'number' &&
            typeof loc.longitude === 'number' &&
            !isNaN(loc.latitude) &&
            !isNaN(loc.longitude)
          ).map((loc, i) => {
            let pinColor = 'yellow';
            let markerType = loc.tipechekin || loc.type || 'tracking';
            if (markerType === 'start') pinColor = 'green';
            else if (markerType === 'stop') pinColor = 'red';
            else if (markerType === 'kontrak') pinColor = 'purple';
            else if (markerType === 'tracking') pinColor = 'orange';
            const markerInfo = getMarkerInfo(loc);
            return (
              <Marker
                key={`track-${i}`}
                coordinate={loc}
                pinColor={pinColor}
                onPress={() => setSelectedMarker(markerInfo)}
              />
            );
          })}
          {/* Polyline snap to road/directions */}
          {optimizedRoute.length > 1 ? (
            <Polyline coordinates={optimizedRoute} strokeColor="#007AFF" strokeWidth={3} />
          ) : null}
        </MapView>
      </SafeMapView>

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
            <Text style={{ fontSize:18, color:selectedMarker?.color, marginBottom:8 }}>{selectedMarker?.label}</Text>
            {selectedMarker?.contractName ? (
              <Text style={{ fontSize:16, color:'#8e24aa', marginBottom:8 }}>{selectedMarker.contractName}</Text>
            ) : null}
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
        <TouchableOpacity onPress={deduplicateLocationLogs} style={[styles.iconButton, { backgroundColor: colors.primary }]}>
          <Icon name="social-distance" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={clearAll} style={[styles.iconButton, { backgroundColor: '#f44336' }]}>
          <Icon name="delete-forever" size={24} color="white" />
        </TouchableOpacity>
      </View>
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
