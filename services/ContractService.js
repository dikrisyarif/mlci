import * as Database from '../utils/database';
import { fetchListDtl } from '../api/listApi';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';

export const ContractService = {
  async fetchContracts(profile, addCheckinLocal, checkinLocations) {
    //console.log('[DEBUG] ContractService: fetchContracts called for', profile?.UserName);
    // Get list of checked in contracts for today from local database
    const checkedInContracts = new Set();
    const allCheckins = await Database.getUnuploadedCheckins();
    const today = new Date().toISOString().split('T')[0];
    
    allCheckins.forEach(checkin => {
      const checkinDate = new Date(checkin.timestamp).toISOString().split('T')[0];
      if (checkinDate === today) {
        checkedInContracts.add(checkin.lease_no);
      }
    });

    let contractData = [];
    const netInfo = await NetInfo.fetch();

    // Coba ambil data lokal terlebih dahulu
    let localData = await Database.getContracts(profile.UserName);
  //console.log('[DEBUG] ContractService: Data lokal yang tersedia:', localData.length, 'kontrak', localData);

    if (netInfo.isConnected) {
      try {
        //console.log('[DEBUG] ContractService: Online, mengambil data dari server...');
        const response = await fetchListDtl({ EmployeeName: profile.UserName });
        if (response.Status === 1 && Array.isArray(response.Data)) {
          contractData = response.Data.map((item, index) => ({
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
            isCheckedIn: checkedInContracts.has(item.LeaseNo) || 
                        (item.CheckinDate && item.CheckinDate !== "0001-01-01T00:00:00"),
          }));

          // Merge data server dengan data lokal untuk mempertahankan status lokal
          if (localData.length > 0) {
            contractData = contractData.map(serverItem => {
              const localItem = localData.find(local => local.LeaseNo === serverItem.LeaseNo);
              if (localItem) {
                return {
                  ...serverItem,
                  isCheckedIn: localItem.isCheckedIn || serverItem.isCheckedIn,
                  comment: localItem.comment || serverItem.comment
                };
              }
              return serverItem;
            });
          }

          //console.log('[ContractService] Menyimpan', contractData.length, 'kontrak ke database lokal');
          // Save to local database
          await Database.saveContracts(contractData, profile.UserName);
          
          // Verifikasi data tersimpan
          const verifyData = await Database.getContracts(profile.UserName);
          if (verifyData.length === 0) {
            // console.error('[ContractService] Data gagal tersimpan ke lokal! Mencoba sekali lagi...');
            await Database.saveContracts(contractData, profile.UserName);
            
            // Verifikasi kedua
            const secondVerify = await Database.getContracts(profile.UserName);
            if (secondVerify.length === 0) {
              console.error('[ContractService] Gagal menyimpan data ke lokal setelah percobaan kedua!');
              throw new Error('Failed to save contracts to local database');
            }
          } else {
            //console.log('[ContractService] Verifikasi: Data berhasil tersimpan,', verifyData.length, 'kontrak');
          }
        }
      } catch (error) {
        // console.error('[ContractService] Error mengambil data dari server:', error);
        if (localData.length > 0) {
    //console.log('[DEBUG] ContractService: Menggunakan data lokal karena error server', localData);
          contractData = localData;
        }
      }
    } else {
      if (localData.length > 0) {
  //console.log('[DEBUG] ContractService: Offline, menggunakan', localData.length, 'data dari lokal', localData);
        contractData = localData;
      }
    }

    // If no data from server or offline, get from local database
    if (contractData.length === 0) {
      contractData = await Database.getContracts(profile.UserName);
      //console.log('[DEBUG] ContractService: Fallback getContracts, result:', contractData);
      if (contractData.length === 0) {
        Alert.alert(
          'Mode Offline',
          'Tidak ada data kontrak tersimpan. Silakan sinkronkan saat online.'
        );
      }
    }

    // Update checked-in locations
    const checkedInLocations = contractData
      .filter(item => item.isCheckedIn && item.Latitude && item.Longitude)
      .map(item => ({
        contractId: item.LeaseNo,
        contractName: item.CustName,
        remark: item.comment,
        latitude: item.Latitude,
        longitude: item.Longitude,
        timestamp: item.CheckIn,
        tipechekin: 'kontrak',
      }));

    // Add to MapContext if not exists
    checkedInLocations.forEach(loc => {
      const isExist = checkinLocations.some(
        l => l.contractId === loc.contractId &&
             l.tipechekin === loc.tipechekin &&
             l.timestamp === loc.timestamp
      );
      if (!isExist && typeof addCheckinLocal === 'function') {
        //console.log('[DEBUG] ContractService: Adding checkin location to MapContext:', loc);
        addCheckinLocal(loc);
      }
    });

    return contractData;
  //console.log('[DEBUG] ContractService: Returning contractData:', contractData);
  },

  async getUnuploadedCheckins() {
    try {
      const checkins = await Database.getUnuploadedCheckins();
      //console.log('[Database] Getting unuploaded check-ins...');
      //console.log('[Database] Found unuploaded check-ins:', checkins.length);
      return checkins;
    } catch (error) {
      console.error('[ContractService] Error getting unuploaded check-ins:', error);
      return [];
    }
  },

  async markCheckinAsUploaded(id) {
    try {
      await Database.markCheckinAsUploaded(id);
    } catch (error) {
      console.error('[ContractService] Error marking check-in as uploaded:', error);
      throw error;
    }
  },

  async isContractCheckedIn(leaseNo, employeeName) {
    try {
      return await Database.isContractCheckedIn(leaseNo, employeeName);
    } catch (error) {
      console.error('[ContractService] Error checking contract check-in status:', error);
      return false;
    }
  },

  async addCheckin(checkinData) {
    try {
      return await Database.addCheckin(checkinData);
    } catch (error) {
      console.error('[ContractService] Error adding check-in:', error);
      throw error;
    }
  },

  async getContractCheckinDetails(leaseNo, employeeName) {
    try {
      return await Database.getContractCheckinDetails(leaseNo, employeeName);
    } catch (error) {
      console.error('[ContractService] Error getting contract check-in details:', error);
      throw error;
    }
  }
};