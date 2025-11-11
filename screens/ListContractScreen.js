import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Database from '../utils/database';

// Components
import { HeaderButtons } from '../components/HeaderButtons';
import { ContractHeader } from '../components/ContractHeader';
import SeeMoreButton from '../components/SeeMoreButton';
import CardList from '../components/CardList';
import CustomAlert from '../components/CustomAlert';
import GlobalLoading from '../components/GlobalLoading';

// Hooks & Context
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useMap } from '../context/MapContext';
import { useContractCheckIn } from '../hooks/useContractCheckIn';

// Services
import { ContractService } from '../services/ContractService';
import * as TrackingService from '../services/trackingService';

const ListContractScreen = ({ navigation }) => {
  const { colors, theme, setTheme } = useTheme();
  const { signOut, state, logout } = useAuth();
  const profile = state.userInfo || {};
  const { addCheckin, addCheckinLocal, loadCheckinsFromStorage, checkinLocations } = useMap();
  // Log path database saat screen mount
  React.useEffect(() => {
    (async () => {
      if (Database.getDb) {
        const db = await Database.getDb();
        if (db && db._db && db._db.filename) {
          console.log('[DEBUG][ListContractScreen] DB path:', db._db.filename);
        } else if (db && db.filename) {
          console.log('[DEBUG][ListContractScreen] DB path:', db.filename);
        } else {
          console.log('[DEBUG][ListContractScreen] DB path: [unknown]');
        }
      }
    })();
  }, []);
  
  // Custom hooks
  const { isLoading, handleCheckin } = useContractCheckIn(
    profile, 
    addCheckin, 
    addCheckinLocal, 
    () => fetchContracts(),
    logout
  );

  const [selectedId, setSelectedId] = useState(null);
  const [comments, setComments] = useState({});
  const [visibleCount, setVisibleCount] = useState(4);
  const [isStarted, setIsStarted] = useState(false);
  const [isAlertVisible, setAlertVisible] = useState(false);
  const [contracts, setContracts] = useState([]);
  // Log jumlah kontrak setiap kali contracts berubah
  useEffect(() => {
    console.log('[LOG] STATE contracts berubah, jumlah:', Array.isArray(contracts) ? contracts.length : 0);
  }, [contracts]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);

  // Initialize database when component mounts
  // Database sudah diinisialisasi di App.js, tidak perlu init ulang di sini

  // Blok navigasi back selama loading kontrak
  useEffect(() => {
    const backAction = () => {
      if (isLoadingContracts) {
        Alert.alert('Tunggu', 'Sedang mengambil data kontrak, mohon tunggu hingga selesai.');
        return true;
      }
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        setAlertVisible(true);
      }
      return true;
    };

  const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
  return () => backHandler.remove();
  }, [navigation, isLoadingContracts]);

  useEffect(() => {
    AsyncStorage.setItem('comments', JSON.stringify(comments));
  }, [comments]);

  useEffect(() => {
    const loadComments = async () => {
      const saved = await AsyncStorage.getItem('comments');
      if (saved) {
        setComments(JSON.parse(saved));
      }
    };
    loadComments();
  }, []);

  // Perbaikan: fetch dari API, bandingkan dan sync ke lokal, fallback ke lokal jika offline
  const fetchContracts = async () => {
  setIsLoadingContracts(true);
  console.log('[LOG] fetchContracts dipanggil');
    try {
  const netInfo = await import('@react-native-community/netinfo');
  const connection = await netInfo.default.fetch();
  let apiContracts = [];
  let localContracts = [];
  console.log('[LOG] Koneksi:', connection.isConnected ? 'ONLINE' : 'OFFLINE');
  if (connection.isConnected) {
        // Fetch dari API
  apiContracts = await ContractService.fetchContracts(profile, addCheckinLocal, checkinLocations);
  console.log('[LOG] Jumlah kontrak dari API:', Array.isArray(apiContracts) ? apiContracts.length : 0);
  // Ambil data lokal
  localContracts = await Database.getContracts(profile.UserName);
  console.log('[LOG] Jumlah kontrak lokal (setelah online):', Array.isArray(localContracts) ? localContracts.length : 0);
        // Bandingkan dan sync
        let needUpdate = false;
        if (!localContracts || localContracts.length === 0) {
          // Insert semua data API ke lokal
          await Database.saveContracts(apiContracts, profile.UserName);
          needUpdate = true;
        } else {
          // Cek apakah data API berbeda dengan lokal
          const localJson = JSON.stringify(localContracts);
          const apiJson = JSON.stringify(apiContracts);
          if (localJson !== apiJson) {
            // Timpa data lokal dengan data API
            await Database.saveContracts(apiContracts, profile.UserName);
            needUpdate = true;
          }
        }
        // Ambil data terbaru dari lokal
  const updatedContracts = await Database.getContracts(profile.UserName);
  console.log('[LOG] Jumlah kontrak yang di-set (ONLINE):', Array.isArray(updatedContracts) ? updatedContracts.length : 0);
  setContracts(updatedContracts);
      } else {
        // Offline: gunakan data lokal
  localContracts = await Database.getContracts(profile.UserName);
  console.log('[LOG] Jumlah kontrak lokal (OFFLINE):', Array.isArray(localContracts) ? localContracts.length : 0);
  setContracts(localContracts);
      }
      await loadCheckinsFromStorage();
    } catch (error) {
      console.error('Error fetching contracts:', error);
      Alert.alert('Error', 'Failed to fetch contracts. Please try again.');
    } finally {
      setIsLoadingContracts(false);
    }
  };

  const handleCardPress = (id) => {
    setSelectedId(selectedId === id ? null : id);
  };

  const handleDetailPress = (item) => {
    const commentText = item.comment?.trim()
      ? item.comment
      : (comments[item.LeaseNo] || '');
    navigation.navigate('Detail Kontrak', {
      ...item,
      Comment: commentText,
    });
  };

  const handleCommentSubmit = (LeaseNo, newComment) => {
    setComments(prev => ({ ...prev, [LeaseNo]: newComment }));
    setContracts(prevContracts => {
      const updated = prevContracts.map(contract =>
        contract.LeaseNo === LeaseNo ? { ...contract, comment: newComment } : contract
      );
      const updatedItem = updated.find(c => c.LeaseNo === LeaseNo);
      if (updatedItem) {
        handleCheckin(updatedItem, newComment);
      }
      return updated;
    });
  };

  const handleSeeMore = () => {
    setVisibleCount(prev => prev + 4);
  };

  const toggleStartStop = async () => {
    try {
      const newStatus = await TrackingService.toggleTrackingStatus(profile, isStarted);
      setIsStarted(newStatus);
    } catch (error) {
      console.error('Error toggling tracking status:', error);
      Alert.alert('Error', 'Failed to toggle tracking status');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    signOut();
    navigation.navigate('LoginScreen');
  };

  // Load and sync tracking status
  useEffect(() => {
    const loadTrackingStatus = async () => {
      try {
        const status = await TrackingService.loadTrackingStatus(profile);
        setIsStarted(status);
      } catch (error) {
        console.error('Error loading tracking status:', error);
      }
    };
    
    loadTrackingStatus();
  }, [profile?.UserName]);

  // Load offline check-ins when screen is focused
  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        const offlineCheckins = await ContractService.getUnuploadedCheckins();
        
        // Add offline check-ins to MapContext
        offlineCheckins.forEach(checkin => {
          const checkinLocation = {
            contractId: checkin.lease_no,
            contractName: checkin.customer_name,
            remark: checkin.comment,
            latitude: checkin.latitude,
            longitude: checkin.longitude,
            timestamp: checkin.timestamp,
            tipechekin: 'kontrak',
            isOffline: true
          };
          addCheckinLocal(checkinLocation);
        });
      } catch (error) {
        console.error('Error loading offline check-ins:', error);
      }
    };

    const unsubscribe = navigation.addListener('focus', () => {
  console.log('[LOG] NAVIGATION FOCUS: ListContractScreen');
  fetchContracts();
  loadOfflineData();
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <GlobalLoading visible={isLoading || isLoadingContracts} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <HeaderButtons
          isStarted={isStarted}
          onStartStopPress={toggleStartStop}
          onMapPress={() => navigation.navigate('MapTrackingScreen')}
          onThemeToggle={() => setTheme(prev => (prev === 'light' ? 'dark' : 'light'))}
          theme={theme}
          colors={colors}
          checkinLocations={checkinLocations}
          navigation={navigation}
        />

        <ContractHeader
          contractCount={contracts.length}
          onSyncPress={fetchContracts}
          colors={colors}
        />

        <View style={styles.cardListContainer}>
          <CardList
            data={contracts.slice(0, visibleCount)}
            selectedId={selectedId}
            onCardPress={handleCardPress}
            onDetailPress={handleDetailPress}
            onCommentSubmit={handleCommentSubmit}
            isStarted={isStarted}
          />
        </View>

        {visibleCount < contracts.length && (
          <SeeMoreButton onPress={handleSeeMore} />
        )}

        <CustomAlert 
          visible={isAlertVisible}
          onClose={() => setAlertVisible(false)}
          onConfirm={handleLogout}
          message="Are you sure you want to exit?"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    width: '100%',
    paddingTop: hp('5%'),
    paddingBottom: hp('5%'),
  },
  cardListContainer: {
    flex: 1,
    paddingHorizontal: wp('5%'),
  }
});

export default ListContractScreen;