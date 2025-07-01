import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, BackHandler, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import StartEndButton from '../components/StartEndButton';
import SeeMoreButton from '../components/SeeMoreButton';
import CardList from '../components/CardList';
import CustomAlert from '../components/CustomAlert'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons'; 
import { fetchListDtl, updateCheckin } from '../api/listApi';
import { useMap } from '../context/MapContext';
import * as Location from 'expo-location'; 

// Helper untuk waktu lokal (WIB)
function getLocalISOString(offsetHours = 7) {
  const now = new Date();
  now.setHours(now.getHours() + offsetHours);
  return now.toISOString().slice(0, 19); // yyyy-MM-ddTHH:mm:ss
}

const ListContractScreen = ({ navigation }) => {
  const { colors, theme, setTheme } = useTheme();
  const { signOut, state, logout } = useAuth();
  const profile = state.userInfo || {};
  const { addCheckin, loadCheckinsFromStorage } = useMap();

  const [selectedId, setSelectedId] = useState(null);
  const [comments, setComments] = useState({});
  const [visibleCount, setVisibleCount] = useState(4);
  const [isStarted, setIsStarted] = useState(false);
  const [isAlertVisible, setAlertVisible] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const backAction = () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        setAlertVisible(true);
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    fetchContracts();
    return () => backHandler.remove();
  }, [navigation]);

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

  const fetchContracts = async () => {
    try {
      setIsLoading(true);
      const response = await fetchListDtl({ EmployeeName: profile.UserName });

      if (response.Status === 1 && Array.isArray(response.Data)) {
        const formattedData = response.Data.map((item, index) => ({
          id: index + 1,
          CustName: item.CustName,
          CustAddress: item.CustAddress,
          LeaseNo: item.LeaseNo,
          PhoneNo: item.PhoneNo,
          PoliceNo: item.PoliceNo,
          EquipType: item.EquipType,
          Unit: item.Unit,
          AmountOd: item.AmountOd,
          Overdue: item.Overdue,
          DueDate: item.DueDate,
          LastCallDate: item.LastCallDate,
          LastCallName: item.LastCallName,
          LastNote: item.LastNote,
          comment: item.Comment,
          Latitude: item.Lattitude ? parseFloat(item.Lattitude) : null,
          Longitude: item.Longtitude ? parseFloat(item.Longtitude) : null,
          CheckIn: item.CheckinDate && item.CheckinDate !== "0001-01-01T00:00:00" ? item.CheckinDate : null,
          isCheckedIn: item.CheckinDate && item.CheckinDate !== "0001-01-01T00:00:00",
        }));

        setContracts(formattedData);

        const checkedInLocations = formattedData
          .filter(item => item.isCheckedIn && item.Latitude && item.Longitude)
          .map(item => {
            const loc = {
              contractId: item.LeaseNo,
              contractName: item.CustName,
              remark: item.comment,
              latitude: item.Latitude,
              longitude: item.Longitude,
              timestamp: item.CheckIn,
            };
            // ⬅️ Tambahkan ke MapContext
            addCheckin(loc);
            return loc;
          });

        await AsyncStorage.setItem('CheckinLocations', JSON.stringify(checkedInLocations));
        // console.log('[Storage] Lokasi check-in tersimpan:', checkedInLocations);
        await loadCheckinsFromStorage(); // ini dari useMap
      } else {
        console.warn('Gagal memuat data kontrak:', response.Message);
      }
    } catch (error) {
      console.error('Error saat fetch list contract:', error);
    } finally {
      setIsLoading(false);
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

  const toggleStartStop = () => {
    setIsStarted(prev => !prev);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    signOut();
    navigation.navigate('LoginScreen');
  };

  // Di dalam ListContractScreen.js
const handleCheckin = async (item, newComment) => {
  try {
    setIsLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Lokasi tidak diizinkan');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const timestamp = getLocalISOString();

    const checkinLocation = {
      contractId: item.LeaseNo,
      contractName: item.CustName,
      remark: item.comment,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: timestamp,
    };

    addCheckin(checkinLocation);

    const response = await updateCheckin({
      EmployeeName: profile.UserName,
      LeaseNo: item.LeaseNo,
      Comment: newComment,
      Latitude: location.coords.latitude,
      Longitude: location.coords.longitude,
      CheckIn: timestamp,
    });

    if (response.Status === 1) {
      fetchContracts();
      Alert.alert('Check-in berhasil', `Lokasi disimpan untuk ${item.CustName}.`);
    } else {
      Alert.alert('Check-in gagal', response.Message || 'Cek data atau jaringan Anda.');
    }
  } catch (error) {
    console.error('Check-in error:', error);
    if (error?.message?.includes('401')) {
      Alert.alert('Unauthorized', 'Sesi kadaluarsa. Silakan login ulang.');
      logout();
    } else {
      Alert.alert('Check-in gagal', 'Terjadi kesalahan saat check-in lokasi.');
    }
  } finally {
    setIsLoading(false);
  }
};

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchContracts();
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.buttonContainer}>
          <StartEndButton isStarted={isStarted} onPress={toggleStartStop} />
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.iconButton, { marginRight: 10 }]}
              onPress={() => navigation.navigate('MapTrackingScreen')}
            >
              <Icon name="my-location" size={24} color={colors.textblue} />
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.themeSwitchButton} 
                onPress={() => setTheme(prev => (prev === 'light' ? 'dark' : 'light'))}
              >
                <Icon 
                  name={theme === 'light' ? 'light-mode' : 'dark-mode'} 
                  size={24} 
                  color={colors.text} 
                />
              </TouchableOpacity>
          </View>
        </View>

        <View style={styles.syncContainer}>
          <Text style={[styles.countText, { color: colors.text }]}>Penugasan ({contracts.length})</Text>
          <TouchableOpacity 
            style={[styles.syncButton, { backgroundColor: colors.button }]} 
            onPress={fetchContracts} 
          >
            <Text style={styles.syncButtonText}>Sync All</Text>
          </TouchableOpacity>
        </View> 

        {isLoading && (
          <ActivityIndicator size="large" style={{ marginTop: 10 }} color={colors.primary} />
        )}

        <ScrollView contentContainerStyle={styles.cardListContainer}>
          <CardList
            data={contracts.slice(0, visibleCount)}
            selectedId={selectedId}
            onCardPress={handleCardPress}
            onDetailPress={handleDetailPress}
            onCommentSubmit={handleCommentSubmit}
            isStarted={isStarted}
          />
        </ScrollView>

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
    paddingTop: hp('5%'), // Tambahkan padding atas untuk memberi ruang pada header
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Mengatur jarak antara tombol dan ikon
    alignItems: 'center',
    // marginVertical: hp('2%'), // Margin vertikal responsif
    paddingHorizontal: wp('5%'), // Padding horizontal responsif
  },
  syncContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: wp('5%'), // Margin horizontal responsif
    marginVertical: hp('1%'), // Margin vertikal responsif
  },
  countText: {
    fontSize: wp('4.5%'), // Ukuran font responsif
    fontWeight: 'bold',
  }, 
  themeSwitchButton: {
    marginLeft: wp('2%'), // Jarak antara tombol dan ikon
  },
  cardListContainer: {
    paddingHorizontal: wp('5%'), // Tambahkan padding horizontal di sekitar CardList
    paddingBottom: hp('2%'), // Tambahkan padding bawah untuk memberi ruang di bawah
  },
  syncButton: {
    // paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 5,
    alignItems: 'center',
    marginLeft: 10, // Jarak antara teks dan tombol
  },
  syncButtonText: {
    color: '#fff', // Warna teks tombol
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  // checkinButton: {
  //   marginTop: 5,
  //   paddingVertical: 8,
  //   borderRadius: 5,
  // },
});

export default ListContractScreen;