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

  const handleServerUpdate = async (item, location, timestamp, newComment, savedId) => {
    // First save the check-in location
    const saveResult = await saveCheckinToServer({
      EmployeeName: profile.UserName,
      Lattitude: location.coords.latitude,
      Longtitude: location.coords.longitude,
      CreatedDate: timestamp,
      tipechekin: 'kontrak',
      LeaseNo: item.LeaseNo,
      Comment: newComment
    });

    // Check save result
    if (saveResult?.Status !== 1) {
      console.error('[ListContract] Save failed:', saveResult);
      throw new Error(saveResult?.Message || 'Gagal menyimpan check-in ke server');
    }

    //console.log('[ListContract] Save successful, updating check-in status...');

    // Then update the check-in status
    const updateResult = await updateCheckin({
      EmployeeName: profile.UserName,
      LeaseNo: item.LeaseNo,
      Comment: newComment,
      Latitude: location.coords.latitude,
      Longitude: location.coords.longitude,
      CheckIn: timestamp
    });

    // Check update result
    if (updateResult?.Status !== 1) {
      console.error('[ListContract] Update failed:', updateResult);
      throw new Error(updateResult?.Message || 'Gagal mengupdate status check-in');
    }

    // Mark as uploaded in SQLite
    await ContractService.markCheckinAsUploaded(savedId);
    return { saveResult, updateResult };
  };

  const handleCheckin = async (item, newComment) => {
    try {
      setIsLoading(true);

      // 0. Check if contract is already checked in
      const isAlreadyCheckedIn = await ContractService.isContractCheckedIn(item.LeaseNo, profile.UserName);
      if (isAlreadyCheckedIn) {
        Alert.alert('Sudah Check-in', `Kontrak ${item.CustName} sudah di-check-in hari ini.`);
        return;
      }

      // 1. Check location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Lokasi tidak diizinkan');
        return;
      }

      // 2. Get current location
      const location = await Location.getCurrentPositionAsync({});
      const timestamp = getLocalISOString();

      // 3. Prepare check-in data
      const checkinData = {
        employee_name: profile.UserName,
        lease_no: item.LeaseNo,
        comment: newComment,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: timestamp,
        customer_name: item.CustName,
        is_uploaded: 0
      };

      // 4. Save to local SQLite database first
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

      // 5. Check internet connection
      const netInfo = await NetInfo.fetch();
      
      // 6. Try to upload if online
      if (netInfo.isConnected) {
        try {
          await handleServerUpdate(item, location, timestamp, newComment, savedId);
          
          // Update UI with new check-in
          const checkinLocation = {
            contractId: item.LeaseNo,
            contractName: item.CustName,
            remark: newComment,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: timestamp,
            tipechekin: 'kontrak',
          };
          addCheckin(checkinLocation);
          
          Alert.alert('Check-in berhasil', `Lokasi disimpan untuk ${item.CustName}.`);
        } catch (error) {
          console.error('[ListContract] Upload error:', error);
          Alert.alert(
            'Penyimpanan Offline',
            'Server tidak dapat dijangkau. Data disimpan secara offline dan akan disinkronkan nanti.'
          );
        }
      } else {
        Alert.alert(
          'Mode Offline',
          'Tidak ada koneksi internet. Data disimpan secara offline dan akan disinkronkan saat online.'
        );
      }

      // Update local UI regardless of online status
      const checkinLocation = {
        contractId: item.LeaseNo,
        contractName: item.CustName,
        remark: newComment,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: timestamp,
        tipechekin: 'kontrak',
        isOffline: !netInfo.isConnected
      };
      addCheckinLocal(checkinLocation);

    } catch (error) {
      console.error('[ListContract] Check-in error:', error);
      if (error?.message?.includes('401')) {
        Alert.alert('Unauthorized', 'Sesi kadaluarsa. Silakan login ulang.');
        logout();
      } else if (error?.message === 'Contract has already been checked in today') {
        Alert.alert('Sudah Check-in', `Kontrak sudah di-check-in hari ini.`);
      } else {
        Alert.alert(
          'Check-in gagal', 
          'Terjadi kesalahan saat check-in lokasi. ' + 
          (error?.message ? `\n\nDetail: ${error.message}` : '')
        );
      }

      // Try to get contract details to verify state
      try {
        const checkinDetails = await ContractService.getContractCheckinDetails(
          item.LeaseNo,
          profile.UserName
        );
        //console.log('[ListContract] Current contract check-in state:', checkinDetails);
      } catch (e) {
        console.error('[ListContract] Error getting contract details:', e);
      }
    } finally {
      setIsLoading(false);
      // Refresh the contract list to ensure UI is in sync
      await fetchContracts();
    }
  };

  return {
    isLoading,
    handleCheckin
  };
};