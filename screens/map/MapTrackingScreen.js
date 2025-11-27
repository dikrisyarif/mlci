import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { fetchGetRecord } from '../../api/listApi';
import NetInfo from '@react-native-community/netinfo';
import { getLocalTrackings } from '../../utils/map/trackingDB';
import * as Database from '../../utils/database';
import MapViewTracking from '../../components/map/MapViewTracking';
import SyncEngine from '../../services/sync/syncEngine';
import { migratePendingLocationsToDatabase } from '../../services/tracking/migrationService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function MapTrackingScreen() {
  const { state } = useAuth();
  const employeeName = state?.userInfo?.UserName || state?.userInfo?.username;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!employeeName) {
      setMessage('User not available');
      setLoading(false);
      return;
    }

    let mounted = true;

    async function syncAndLoad() {
      setLoading(true);
      try {
        // Migrate any pending AsyncStorage locations to SQLite (one-time migration helper)
        try {
          await migratePendingLocationsToDatabase();
        } catch (merr) {
          console.warn('[MapTrackingScreen] migratePendingLocationsToDatabase error:', merr?.message || merr);
        }

        // Check network connectivity
        const net = await NetInfo.fetch();
        const isOnline = !!net?.isConnected;

        if (!isOnline) {
          // Offline: just read local and display
          const localRows = await getLocalTrackings(employeeName);
          const mappedLocal = localRows.map(r => ({
            EmployeeName: r.employee_name,
            LeaseNo: r.lease_no || '',
            CustName: r.cust_name || '',
            LabelMap: r.label_map,
            Lattitude: String(r.latitude),
            Longtitude: String(r.longitude),
            CheckinDate: r.checkin_date,
          }));
          if (mounted) {
            setData(mappedLocal);
            if (mappedLocal.length === 0) setMessage('No tracking data available');
          }
          return;
        }

        // Online: handle background tracking sync-first per-employee, then fetch server and persist
        const unuploadedTracks = await Database.getUnuploadedTracks(null, employeeName);
        // We intentionally do NOT force-upload contract_checkins here; leave unuploaded contract checkins untouched

        if (unuploadedTracks && unuploadedTracks.length > 0) {
          console.log('[MapTrackingScreen] Local has unuploaded background tracks -> syncing tracking first');
          try {
            // Sync tracking (this will upload pending background_tracks)
            await SyncEngine.syncTracking();
          } catch (err) {
            console.warn('[MapTrackingScreen] SyncEngine.syncTracking error:', err?.message || err);
          }
          // After syncing background tracks, fall through to fetch server and refresh local
        }

        // Fetch server records (always fetch when online after background sync)
        const serverList = await fetchGetRecord({ EmployeeName: employeeName });
        const srv = Array.isArray(serverList) ? serverList : serverList || [];

        // Replace local background_tracks & startstop with server data. For contract_checkins, do not remove local unuploaded rows; only remove uploaded ones and insert server ones.
        try {
          // Delete background and start/stop rows for this employee
          await Database.executeWithLog('runAsync', 'DELETE FROM background_tracks WHERE employee_name = ?;', [employeeName], false, true);
          await Database.executeWithLog('runAsync', 'DELETE FROM checkin_startstop WHERE employee_name = ?;', [employeeName], false, true);

          // Remove only uploaded contract_checkins (keep local unuploaded contract checkins)
          await Database.executeWithLog('runAsync', 'DELETE FROM contract_checkins WHERE employee_name = ? AND is_uploaded = 1;', [employeeName], false, true);

          // Insert server rows into DB (addCheckin/addCheckinStartStop/saveBackgroundLocation are idempotent/duplicate-protected)
          for (const sr of srv) {
            try {
              const tipe = (sr.tipechekin || '').toLowerCase();
              // normalize timestamp - server sometimes returns undefined
              const ts = sr.createdDate || sr.CreatedDate || new Date().toISOString();
              if (!sr.createdDate && !sr.CreatedDate) {
                console.warn('[MapTrackingScreen] server row missing createdDate, using fallback timestamp', { row: sr });
              }

              if (tipe === 'start' || tipe === 'stop') {
                await Database.addCheckinStartStop({
                  employee_name: sr.employeeName,
                  type: tipe,
                  latitude: sr.latitude,
                  longitude: sr.longitude,
                  timestamp: ts,
                });
              } else if (tipe === 'kontrak' || tipe === 'checkin' || tipe === 'contract') {
                await Database.addCheckin({
                  lease_no: sr.leaseNo || '_contract_',
                  employee_name: sr.employeeName,
                  latitude: sr.latitude,
                  longitude: sr.longitude,
                  timestamp: ts,
                  comment: sr.contractName || '',
                  address: sr.address || '',
                });
              } else {
                await Database.saveBackgroundLocation({
                  latitude: sr.latitude,
                  longitude: sr.longitude,
                  timestamp: ts,
                }, sr.employeeName);
              }
            } catch (e) {
              console.warn('[MapTrackingScreen] insert server row error:', e?.message || e);
            }
          }
        } catch (err) {
          console.warn('[MapTrackingScreen] replace local error:', err?.message || err);
        }

        // Reload local after applying server data
        const refreshed = await getLocalTrackings(employeeName);
        const mapped = refreshed.map(r => ({
          EmployeeName: r.employee_name,
          LeaseNo: r.lease_no || '',
          CustName: r.cust_name || '',
          LabelMap: r.label_map,
          Lattitude: String(r.latitude),
          Longtitude: String(r.longitude),
          CheckinDate: r.checkin_date,
        }));
        if (mounted) {
          setData(mapped);
          if (mapped.length === 0) setMessage('No tracking data available');
        }
        return;

        // No unuploaded local records: decide based on latest timestamp which source is newer
        const serverLatest = srv.reduce((acc, cur) => {
          const t = cur?.createdDate ? Date.parse(cur.createdDate) : 0;
          return Math.max(acc, isNaN(t) ? 0 : t);
        }, 0);

        const localLatest = localRows.reduce((acc, cur) => {
          const t = cur?.checkin_date ? Date.parse(cur.checkin_date) : 0;
          return Math.max(acc, isNaN(t) ? 0 : t);
        }, 0);

        // If server has newer data, replace local with server
        if (serverLatest > localLatest + 1000) {
          console.log('[MapTrackingScreen] Server data appears newer -> replace local');
          // Replace local employee data atomically
          // Delete existing rows for this employee and insert server rows.
          // Use Database helpers which manage their own transactions; avoid nested manual transactions.
          try {
            await Database.executeWithLog('runAsync', 'DELETE FROM background_tracks WHERE employee_name = ?;', [employeeName], false, true);
            await Database.executeWithLog('runAsync', 'DELETE FROM checkin_startstop WHERE employee_name = ?;', [employeeName], false, true);
            await Database.executeWithLog('runAsync', 'DELETE FROM contract_checkins WHERE employee_name = ?;', [employeeName], false, true);

            for (const sr of srv) {
              try {
                const tipe = (sr.tipechekin || '').toLowerCase();
                if (tipe === 'start' || tipe === 'stop') {
                  const ts = sr.createdDate || sr.CreatedDate || new Date().toISOString();
                  if (!sr.createdDate && !sr.CreatedDate) {
                    console.warn('[MapTrackingScreen] server row missing createdDate (replace branch), using fallback', { row: sr });
                  }
                  await Database.addCheckinStartStop({
                    employee_name: sr.employeeName,
                    type: tipe,
                    latitude: sr.latitude,
                    longitude: sr.longitude,
                    timestamp: ts,
                  });
                } else if (tipe === 'kontrak' || tipe === 'checkin' || tipe === 'contract') {
                  const ts = sr.createdDate || sr.CreatedDate || new Date().toISOString();
                  await Database.addCheckin({
                    lease_no: sr.leaseNo || '_contract_',
                    employee_name: sr.employeeName,
                    latitude: sr.latitude,
                    longitude: sr.longitude,
                    timestamp: ts,
                    comment: sr.contractName || '',
                    address: sr.address || '',
                  });
                } else {
                  const ts = sr.createdDate || sr.CreatedDate || new Date().toISOString();
                  await Database.saveBackgroundLocation({
                    latitude: sr.latitude,
                    longitude: sr.longitude,
                    timestamp: ts,
                  }, sr.employeeName);
                }
              } catch (e) {
                console.warn('[MapTrackingScreen] insert server row error:', e?.message || e);
              }
            }
          } catch (err) {
            console.warn('[MapTrackingScreen] replace local error:', err?.message || err);
          }

          // reload local after replace
          const refreshed = await getLocalTrackings(employeeName);
          const mapped = refreshed.map(r => ({
            EmployeeName: r.employee_name,
            LeaseNo: r.lease_no || '',
            CustName: r.cust_name || '',
            LabelMap: r.label_map,
            Lattitude: String(r.latitude),
            Longtitude: String(r.longitude),
            CheckinDate: r.checkin_date,
          }));
          if (mounted) {
            setData(mapped);
            if (mapped.length === 0) setMessage('No tracking data available');
          }
          return;
        }

        // Otherwise local is up-to-date (or equal). Use local data.
        const mappedLocal = localRows.map(r => ({
          EmployeeName: r.employee_name,
          LeaseNo: r.lease_no || '',
          CustName: r.cust_name || '',
          LabelMap: r.label_map,
          Lattitude: String(r.latitude),
          Longtitude: String(r.longitude),
          CheckinDate: r.checkin_date,
        }));
        if (mounted) {
          setData(mappedLocal);
          if (mappedLocal.length === 0) setMessage('No tracking data available');
        }
      } catch (err) {
        console.warn('[MapTrackingScreen] Error sync/load:', err?.message || err);
        if (mounted) setMessage('Failed to load tracking data');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    syncAndLoad();

    return () => { mounted = false; };
  }, [employeeName]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );

  if (!data || data.length === 0) return (
    <View style={styles.container}>
      <Text>{message || 'No data'}</Text>
    </View>
  );
  // Render map component and wire control handlers
  const handleExport = async () => {
    try {
      const rows = await getLocalTrackings(employeeName);
      const json = JSON.stringify(rows, null, 2);
      const fileUri = FileSystem.documentDirectory + `tracking_export_${employeeName}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Export saved', `File saved to ${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Export failed', String(err?.message || err));
    }
  };

  const handleDedup = async () => {
    try {
      const db = await Database.getDb();
      // remove exact-duplicate rows keeping the smallest id per (timestamp,latitude,longitude,employee_name)
      const sql = `DELETE FROM background_tracks WHERE id NOT IN (
        SELECT MIN(id) FROM background_tracks WHERE employee_name = ? GROUP BY timestamp, latitude, longitude
      ) AND employee_name = ?;`;
      await db.execAsync(sql, [employeeName, employeeName]);
      const refreshed = await getLocalTrackings(employeeName);
      setData(refreshed.map(r => ({
        EmployeeName: r.employee_name,
        LeaseNo: r.lease_no || '',
        CustName: r.cust_name || '',
        LabelMap: r.label_map,
        Lattitude: String(r.latitude),
        Longtitude: String(r.longitude),
        CheckinDate: r.checkin_date,
      })));
      Alert.alert('Deduplicate', 'Deduplication completed');
    } catch (err) {
      Alert.alert('Dedup failed', String(err?.message || err));
    }
  };

  const handleClear = async () => {
    Alert.alert('Confirm', 'Clear all local tracking rows for this employee? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: async () => {
        try {
          const db = await Database.getDb();
          await db.execAsync('DELETE FROM background_tracks WHERE employee_name = ?;', [employeeName]);
          await db.execAsync('DELETE FROM checkin_startstop WHERE employee_name = ?;', [employeeName]);
          await db.execAsync('DELETE FROM contract_checkins WHERE employee_name = ?;', [employeeName]);
          const refreshed = await getLocalTrackings(employeeName);
          setData(refreshed.map(r => ({
            EmployeeName: r.employee_name,
            LeaseNo: r.lease_no || '',
            CustName: r.cust_name || '',
            LabelMap: r.label_map,
            Lattitude: String(r.latitude),
            Longtitude: String(r.longitude),
            CheckinDate: r.checkin_date,
          })));
        } catch (err) {
          Alert.alert('Clear failed', String(err?.message || err));
        }
      } }
    ]);
  };

  return (
    <View style={styles.container}>
      <MapViewTracking data={data} onExport={handleExport} onDedup={handleDedup} onClear={handleClear} />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' } });
