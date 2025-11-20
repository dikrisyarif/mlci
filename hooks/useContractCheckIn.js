import { useState } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { ContractService } from '../services/ContractService';
import { saveCheckinToServer, updateCheckin } from '../api/listApi';
import NetInfo from '@react-native-community/netinfo';

function getLocalISOString(offsetHours = 7) {
  const now = new Date();
  now.setHours(now.getHours() + offsetHours);
  return now.toISOString().slice(0, 19);
}

export const useContractCheckIn = (profile, addCheckin, addCheckinLocal, fetchContracts, logout) => {
  const [isLoading, setIsLoading] = useState(false);

  /** ✅ Kirim ke server (simpan dan update flag) */
  const handleServerUpdate = async (item, location, timestamp, newComment, savedId) => {
    const saveResult = await saveCheckinToServer({
      EmployeeName: profile.UserName,
      Lattitude: location.coords.latitude,
      Longtitude: location.coords.longitude,
      CreatedDate: timestamp,
      tipechekin: 'kontrak',
      LeaseNo: item.LeaseNo,
      Comment: newComment
    });

    if (saveResult?.Status !== 1) {
      // console.error('[Checkin] Save failed:', saveResult);
      throw new Error(saveResult?.Message || 'Gagal menyimpan check-in ke server');
    }

    const updateResult = await updateCheckin({
      EmployeeName: profile.UserName,
      LeaseNo: item.LeaseNo,
      Comment: newComment,
      Latitude: location.coords.latitude,
      Longitude: location.coords.longitude,
      CheckIn: timestamp
    });

    if (updateResult?.Status !== 1) {
      // console.error('[Checkin] Update failed:', updateResult);
      throw new Error(updateResult?.Message || 'Gagal mengupdate status check-in');
    }

    // ✅ Tandai sebagai sudah di-upload
    await ContractService.markCheckinAsUploaded(savedId);

    // ✅ Update local cache agar tidak bisa dicekin lagi
    await ContractService.updateLocalContractFlag(item.LeaseNo, {
      isCheckedIn: true,
      comment: newComment,
      CheckIn: timestamp
    });

    return { saveResult, updateResult };
  };

  /** ✅ Main function */
  const handleCheckin = async (item, newComment) => {
    try {
      setIsLoading(true);

      // Cegah double check-in
      const isAlreadyCheckedIn = await ContractService.isContractCheckedIn(item.LeaseNo, profile.UserName);
      if (isAlreadyCheckedIn) {
        Alert.alert('Sudah Check-in', `Kontrak ${item.CustName} sudah di-check-in hari ini.`);
        return;
      }

      // Cek izin lokasi
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Lokasi tidak diizinkan');
        return;
      }

      // Ambil lokasi
      const location = await Location.getCurrentPositionAsync({});
      const timestamp = getLocalISOString();

      // Siapkan data check-in
      const checkinData = {
        employee_name: profile.UserName,
        lease_no: item.LeaseNo,
        comment: newComment,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp,
        customer_name: item.CustName,
        is_uploaded: 0
      };

      // Simpan ke SQLite dulu
      let savedId;
      try {
        savedId = await ContractService.addCheckin(checkinData);
      } catch (error) {
        if (error.message === 'Contract has already been checked in today') {
          Alert.alert('Sudah Check-in', `Kontrak ${item.CustName} sudah di-check-in hari ini.`);
          return;
        }
        throw error;
      }

      const netInfo = await NetInfo.fetch();

      if (netInfo.isConnected) {
        try {
          await handleServerUpdate(item, location, timestamp, newComment, savedId);
          Alert.alert('Check-in berhasil', `Lokasi disimpan untuk ${item.CustName}.`);
        } catch (error) {
          // console.error('[Checkin] Upload error:', error);
          Alert.alert('Penyimpanan Offline', 'Server tidak dapat dijangkau. Data disimpan secara offline.');
        }
      } else {
        Alert.alert('Mode Offline', 'Tidak ada koneksi internet. Data disimpan secara offline.');
      }

      // ✅ Update local contract agar langsung reflect di UI
      await ContractService.updateLocalContractFlag(item.LeaseNo, {
        isCheckedIn: true,
        comment: newComment,
        CheckIn: timestamp
      });

      // ✅ Update map/local state UI
      const checkinLocation = {
        contractId: item.LeaseNo,
        contractName: item.CustName,
        remark: newComment,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp,
        tipechekin: 'kontrak',
        isOffline: !netInfo.isConnected
      };

      addCheckinLocal(checkinLocation);
      if (netInfo.isConnected) addCheckin(checkinLocation);

    } catch (error) {
      // console.error('[Checkin] Error:', error);
      if (error?.message?.includes('401')) {
        Alert.alert('Unauthorized', 'Sesi kadaluarsa. Silakan login ulang.');
        logout();
      } else if (error?.message === 'Contract has already been checked in today') {
        Alert.alert('Sudah Check-in', `Kontrak sudah di-check-in hari ini.`);
      } else {
        Alert.alert('Check-in gagal', 'Terjadi kesalahan saat check-in lokasi.\n\n' + (error?.message || ''));
      }
    } finally {
      setIsLoading(false);
      await fetchContracts(); // Refresh list biar flag dan comment update
    }
  };

  return { isLoading, handleCheckin };
};
