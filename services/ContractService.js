import {
  getContracts,
  saveContracts,
  clearContracts,
  updateContractFlag,
} from "../utils/database/contracts";

import {
  getUnuploadedCheckins,
  markCheckinAsUploaded,
  addCheckin,
  getContractCheckinDetails,
  isContractCheckedIn,
} from "../utils/database/checkins";

import { getAppState, saveAppState } from "../utils/database/state";
import { isContractsStale } from "../utils/isStale";
import { fetchListDtl } from "../api/listApi";
import NetInfo from "@react-native-community/netinfo";
import { Alert } from "react-native";

export const ContractService = {
  /** ----------------------------------------------------------------------
   *  FETCH KONTRAK (AUTO STALE CHECK + OFFLINE MERGE)
   * -----------------------------------------------------------------------
   */
  async fetchContracts(profile, addCheckinLocal, checkinLocations) {
    const userName = profile?.UserName;
    const netInfo = await NetInfo.fetch();

    // ✅ Ambil last sync timestamp
    const lastSync = await getAppState("last_contract_sync");

    // ✅ Cek apakah stale (data bukan hari ini)
    if (isContractsStale(lastSync)) {
      console.log("[Contracts] Local cache is stale → clearing...");
      await clearContracts();
    }

    // ✅ Ambil local contracts
    let localContracts = await getContracts(userName);

    // ✅ Ambil data check-in lokal (belum upload)
    const offlineCheckins = await getUnuploadedCheckins();

    const today = new Date().toISOString().split("T")[0];
    const checkedToday = new Set(
      offlineCheckins
        .filter(
          (c) => new Date(c.timestamp).toISOString().split("T")[0] === today
        )
        .map((c) => c.lease_no)
    );

    let resultContracts = [];

    // ==========================================================
    // ✅ ONLINE MODE → FETCH API → MERGE → SIMPAN LOCAL
    // ==========================================================
    if (netInfo.isConnected) {
      try {
        const response = await fetchListDtl({ EmployeeName: userName });

        if (response.Status === 1 && Array.isArray(response.Data)) {
          let apiContracts = response.Data.map((item, idx) => ({
            id: idx + 1,
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
            CheckIn:
              item.CheckinDate && item.CheckinDate !== "0001-01-01T00:00:00"
                ? item.CheckinDate
                : null,

            isCheckedIn:
              checkedToday.has(item.LeaseNo) ||
              (item.CheckinDate && item.CheckinDate !== "0001-01-01T00:00:00"),
          }));

          // ✅ Merge comment & check-in offline
          if (localContracts.length > 0) {
            apiContracts = apiContracts.map((server) => {
              const local = localContracts.find(
                (x) => x.LeaseNo === server.LeaseNo
              );
              if (!local) return server;

              return {
                ...server,
                comment: local.comment ?? server.comment,
                isCheckedIn: local.isCheckedIn || server.isCheckedIn,
              };
            });
          }

          // ✅ Merge offline checkins (belum upload)
          offlineCheckins.forEach((off) => {
            const target = apiContracts.find((c) => c.LeaseNo === off.lease_no);
            if (target) {
              target.isCheckedIn = true;
              target.comment = off.comment || target.comment;
              target.CheckIn = off.timestamp;
              target.Latitude = off.latitude;
              target.Longitude = off.longitude;
            }
          });

          // ✅ Simpan ke lokal
          await saveContracts(apiContracts, userName);

          // ✅ Simpan timestamp sync → supaya tidak stale
          await saveAppState("last_contract_sync", new Date().toISOString());

          resultContracts = apiContracts;
        } else {
          resultContracts = localContracts;
        }
      } catch (err) {
        console.warn("[Contracts] ⚠️ API fetch error, fallback ke lokal:", err);
        resultContracts = localContracts;
      }
    }
    // ==========================================================
    // ✅ OFFLINE MODE → GABUNGKAN CHECKIN LOKAL DENGAN KONTRAK
    // ==========================================================
    else {
      console.log("[Contracts] Offline mode → merging local check-ins...");

      resultContracts = localContracts.map((c) => {
        const offline = offlineCheckins.find((o) => o.lease_no === c.LeaseNo);
        if (offline) {
          return {
            ...c,
            isCheckedIn: true,
            comment: offline.comment || c.comment,
            CheckIn: offline.timestamp,
            Latitude: offline.latitude,
            Longitude: offline.longitude,
          };
        }
        return c;
      });
    }

    // ✅ Fallback jika lokal kosong
    if (!resultContracts || resultContracts.length === 0) {
      if (!netInfo.isConnected) {
        Alert.alert("Offline", "Tidak ada data kontrak tersimpan.");
      }
    }

    // ✅ Kirim posisi checkin ke MapContext (agar muncul di map / marker)
    const mapCheckedIn = resultContracts
      .filter((c) => c.isCheckedIn && c.Latitude && c.Longitude)
      .map((c) => ({
        contractId: c.LeaseNo,
        contractName: c.CustName,
        remark: c.comment,
        latitude: c.Latitude,
        longitude: c.Longitude,
        timestamp: c.CheckIn,
        tipechekin: "kontrak",
      }));

    mapCheckedIn.forEach((loc) => {
      const exist = checkinLocations.some(
        (x) =>
          x.contractId === loc.contractId &&
          x.timestamp === loc.timestamp &&
          x.tipechekin === "kontrak"
      );
      if (!exist && typeof addCheckinLocal === "function") {
        addCheckinLocal(loc);
      }
    });

    return resultContracts;
  },
  async updateLocalContractFlag(leaseNo, isCheckedIn, employeeName) {
    try {
      const result = await updateContractFlag(
        leaseNo,
        isCheckedIn,
        employeeName
      );
      console.log(
        "[ContractService] ✅ Local contract flag updated:",
        leaseNo,
        isCheckedIn
      );
      return result;
    } catch (err) {
      // console.error(
      //   "[ContractService] ❌ Failed to update local contract flag:",
      //   err
      // );
      return false;
    }
  },
  // ------------------------------------------------------------------------
  // 🔹 Wrapper-method lain (dipakai hook lain)
  // ------------------------------------------------------------------------
  async getUnuploadedCheckins() {
    return await getUnuploadedCheckins();
  },

  async markCheckinAsUploaded(id) {
    return await markCheckinAsUploaded(id);
  },

  async addCheckin(data) {
    return await addCheckin(data);
  },

  async getContractCheckinDetails(leaseNo, employeeName) {
    return await getContractCheckinDetails(leaseNo, employeeName);
  },

  async isContractCheckedIn(leaseNo, employeeName) {
    return await isContractCheckedIn(leaseNo, employeeName);
  },
};
