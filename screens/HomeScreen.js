// screens/HomeScreen.js
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, BackHandler } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import CustomAlert from '../components/CustomAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMap } from '../context/MapContext';
import * as Database from '../utils/database';

const HomeScreen = ({ navigation }) => {
  const [loggingContracts, setLoggingContracts] = React.useState(false);
  const [localContracts, setLocalContracts] = React.useState([]);
  const { state } = require('../context/AuthContext').useAuth();

  const handleLogContracts = async () => {
    setLoggingContracts(true);
    try {
      const userName = state?.userInfo?.UserName || 'unknown';
      console.log('[DEBUG][HomeScreen] userName:', userName);
      const contracts = await Database.getContracts(userName);
      setLocalContracts(contracts);
      console.log('[DummyButton] Local contracts for', userName, contracts.length);
      alert('Data kontrak lokal sudah ditampilkan di log.');
    } catch (e) {
      alert('Gagal mengambil data kontrak: ' + e.message);
    }
    setLoggingContracts(false);
  };
  // Otomatis ambil data kontrak lokal setiap kali HomeScreen difokuskan
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const fetchLocalContracts = async () => {
        try {
          const userName = state?.userInfo?.UserName || 'unknown';
          console.log('[DEBUG][HomeScreen] userName:', userName);
          // Add a retry mechanism
          let retryCount = 0;
          let contracts = [];
          while (retryCount < 3) {
            if (retryCount > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            contracts = await Database.getContracts(userName);
            // Debug: show raw rows
            try {
              const raw = await Database.getContractsRaw();
              console.log('[DEBUG][HomeScreen] raw contracts rows:', raw.length, raw.map(r => ({ id: r.id, employee_name: r.employee_name })));
            } catch (e) {
              console.error('[DEBUG][HomeScreen] failed to read raw rows:', e);
            }
            console.log('[HomeScreen][useFocusEffect] Attempt', retryCount + 1, 'contracts:', contracts.length);
            if (contracts.length > 0) {
              break;
            }
            retryCount++;
          }
          if (mounted) {
            setLocalContracts(contracts);
            console.log('[HomeScreen][useFocusEffect] Final contracts for', userName, contracts.length);
          }
        } catch (error) {
          console.error('[HomeScreen][useFocusEffect] Error:', error);
        }
      };
      fetchLocalContracts();
      
      return () => {
        mounted = false;
      };
    }, [state?.userInfo?.UserName])
  );
  const { resetDatabase } = Database;
  const [resetting, setResetting] = React.useState(false);

  const handleResetDatabase = async () => {
    setResetting(true);
    try {
      await resetDatabase();
      const userName = state?.userInfo?.UserName || 'unknown';
      const contracts = await Database.getContracts(userName);
      //console.log('[DummyButton][After Reset] Local contracts for', userName, contracts);
      alert('Database lokal berhasil direset! Data kontrak setelah reset sudah ditampilkan di log.');
    } catch (e) {
      alert('Gagal reset database: ' + e.message);
    }
    setResetting(false);
  };
  const { colors } = useTheme();
  const { clearCheckins } = useMap();
  const { signOut } = require('../context/AuthContext').useAuth();
  const [exitAlert, setExitAlert] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        setExitAlert(true);
        return true; // prevent default behavior
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const handleExit = async () => {
    setExitAlert(false);
    // Hapus semua token dan data lokasi
    await AsyncStorage.removeItem('locationLogs');
    await AsyncStorage.removeItem('CheckinLocations');
    if (clearCheckins) await clearCheckins();
    // Hapus SecureStore token
    if (typeof signOut === 'function') await signOut();
    // Tidak perlu navigation.reset, biarkan context Auth yang handle ke Login
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ListContract')}
      >
        <Icon name="list" size={40} color="#fff" />
        <Text style={styles.text}>List Contract</Text>
      </TouchableOpacity>
      {/* Dummy button for logging local contracts */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#4CAF50' }]}
        onPress={handleLogContracts}
        disabled={loggingContracts}
      >
        <Icon name="database" size={40} color="#fff" />
        <Text style={styles.text}>{loggingContracts ? 'Logging...' : 'Log Local Contracts'}</Text>
      </TouchableOpacity>
      {/* Dummy button for resetting local database */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#f44336' }]}
        onPress={handleResetDatabase}
        disabled={resetting}
      >
        <Icon name="trash" size={40} color="#fff" />
        <Text style={styles.text}>{resetting ? 'Resetting...' : 'Reset DB (Dummy)'}</Text>
      </TouchableOpacity>
      <CustomAlert
        visible={exitAlert}
        onClose={() => setExitAlert(false)}
        onConfirm={handleExit}
        message="Are you sure want to exit?"
        mode="confirm"
      />
      {/* Tombol Check-in dihilangkan, hanya List Contract */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexDirection: 'row',
    padding: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#007bff',
    padding: 20,
    borderRadius: 15,
  },
  text: {
    marginTop: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HomeScreen;
