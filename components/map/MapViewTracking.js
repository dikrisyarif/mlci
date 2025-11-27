import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { buildOptimizedRoute } from '../../utils/map/routeUtils';

export default function MapViewTracking({
  data = [], // array of items with Lattitude/Longtitude or latitude/longitude fields
  onExport = () => {},
  onDedup = () => {},
  onClear = () => {},
}) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Normalize data to latitude/longitude/timestamp
  const points = (data || []).map((it) => {
    // Support different field names coming from various mappers
    const rawLat = it.latitude ?? it.Lattitude ?? it.Lattitude ?? it.Lattitude;
    const rawLng = it.longitude ?? it.Longtitude ?? it.Longtitude ?? it.Longtitude;
    const latitude = Number(rawLat);
    const longitude = Number(rawLng);
    const timestamp = it.timestamp ?? it.CheckinDate ?? it.checkin_date ?? it.CheckinDate;
    const label = (it.labelMap ?? it.LabelMap ?? it.Label) || '';
    const contractName = it.contractName ?? it.CustName ?? it.contractName ?? it.cust_name;

    return {
      latitude: isNaN(latitude) ? 0 : latitude,
      longitude: isNaN(longitude) ? 0 : longitude,
      timestamp,
      label,
      contractName,
    };
  }).filter(p => p.latitude && p.longitude);

  useEffect(() => {
    let mounted = true;
    async function runOptimize() {
      if (!points.length) {
        setOptimizedRoute([]);
        return;
      }
      try {
        setLoadingRoute(true);
        const result = await buildOptimizedRoute(points);
        if (mounted) setOptimizedRoute(result || points);
      } catch (err) {
        if (mounted) setOptimizedRoute(points);
      } finally {
        if (mounted) setLoadingRoute(false);
      }
    }
    runOptimize();
    return () => { mounted = false; };
  }, [JSON.stringify(points)]);

  const initial = points[0] || null;
  const region = initial
    ? { latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: -6.2, longitude: 106.816666, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={styles.container}>
      {loadingRoute && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
      <MapView style={styles.map} initialRegion={region} showsUserLocation>
        {points.map((loc, i) => {
          const lbl = (loc.label || '').toLowerCase();
          let type = 'tracking';
          if (lbl.includes('start')) type = 'start';
          else if (lbl.includes('stop')) type = 'stop';
          else if (lbl.includes('contract') || lbl.includes('kontrak')) type = 'contract';

          const colorMap = {
            start: '#006400', // dark green
            stop: '#8B0000', // dark red
            contract: '#8e24aa', // purple
            tracking: '#FFD700', // yellow for background tracking
          };

          const pinColor = colorMap[type] || '#FFA500';

          return (
            <Marker
              key={`mv-${i}`}
              coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
              pinColor={pinColor}
              onPress={() => setSelectedMarker({ ...loc, index: i, type })}
            />
          );
        })}

        {optimizedRoute && optimizedRoute.length > 1 && (
          <Polyline coordinates={optimizedRoute} strokeColor="#FFD700" strokeWidth={3} />
        )}
      </MapView>

      {/* Modal untuk info marker */}
      <Modal visible={!!selectedMarker} transparent animationType="fade" onRequestClose={() => setSelectedMarker(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>No. {selectedMarker?.index ?? '?'}</Text>
            <Text style={[styles.modalLabel, { color: selectedMarker?.type === 'start' ? '#006400' : (selectedMarker?.type === 'stop' ? '#8B0000' : (selectedMarker?.type === 'contract' ? '#8e24aa' : '#FFD700')) }]}>{selectedMarker?.label || 'Tracking'}</Text>
            {selectedMarker?.contractName ? (
              <Text style={styles.modalContract}>{selectedMarker.contractName}</Text>
            ) : null}
            <Text style={styles.modalTime}>{selectedMarker?.timestamp ? new Date(selectedMarker.timestamp).toLocaleString() : ''}</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedMarker(null)}>
              <Text style={{ color: '#007AFF', fontWeight: '700' }}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.buttonRow}>
        <TouchableOpacity onPress={onExport} style={styles.iconButton}>
          <Icon name="file-download" size={22} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDedup} style={[styles.iconButton, { backgroundColor: '#007AFF' }]}>
          <Icon name="social-distance" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClear} style={[styles.iconButton, { backgroundColor: '#f44336' }]}>
          <Icon name="delete-forever" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: { position: 'absolute', top: 12, right: 12, zIndex: 20 },
  modalBg: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, minWidth: 260, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalLabel: { fontSize: 16, color: '#007AFF', marginBottom: 6 },
  modalContract: { fontSize: 14, color: '#8e24aa', marginBottom: 6 },
  modalTime: { fontSize: 13, color: '#444' },
  modalClose: { marginTop: 12 },
});
