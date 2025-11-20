import { Alert } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Database from "../../utils/database";
import { getLocalISOString, getBestAddress } from "./trackingUtils";
import { startBackgroundTracking } from "../../backgroundTrackingManager";

export const handleStartTracking = async ({
  authState,
  addCheckin,
  setStarted,
  setLoading,
  onPress,
}) => {
  setLoading(true);
  try {
    // 1️⃣ Minta izin lokasi
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin lokasi diperlukan untuk check-in.");
      return;
    }

    // 2️⃣ Ambil lokasi sekarang
    const loc = await Location.getCurrentPositionAsync({});
    if (!loc?.coords) {
      Alert.alert("Data lokasi tidak valid.");
      return;
    }

    // 3️⃣ Ambil nama user (dari AuthContext atau AsyncStorage)
    let employeeName = authState?.userInfo?.UserName || authState?.userInfo?.username;
    if (!employeeName) {
      const userInfoStr = await AsyncStorage.getItem("userInfo");
      const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
      employeeName = userInfo.UserName || userInfo.username;
    }

    if (!employeeName) {
      Alert.alert("User tidak ditemukan, silakan login ulang.");
      return;
    }

    // 4️⃣ Dapatkan alamat lokasi
    const address = await getBestAddress({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    }).catch(() => "");

    // 5️⃣ Buat data check-in
    const timestamp = getLocalISOString();
    const checkInData = {
      EmployeeName: employeeName,
      type: "start",
      tipechekin: "start",
      timestamp,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      Address: address,
    };

    // 6️⃣ Simpan ke SQLite
    await Database.saveAppState("isTracking", "true");
    await Database.addCheckin({
      employee_name: employeeName,
      lease_no: "_tracking_",
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp,
      comment: "Start tracking",
      is_uploaded: 0,
      tipechekin: "start",
    });

    // 7️⃣ Coba sync ke server
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      await addCheckin(checkInData).catch(() => {
        Alert.alert("Mode Offline", "Status start disimpan offline.");
      });
    } else {
      Alert.alert("Mode Offline", "Status start disimpan offline.");
    }

    // 8️⃣ Simpan ke AsyncStorage
    await AsyncStorage.setItem("lastCheckinStartTimestamp", timestamp);
    await AsyncStorage.setItem(
      "lastCheckinStartLoc",
      JSON.stringify({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      })
    );

    // 9️⃣ Mulai background tracking
    await startBackgroundTracking(authState?.userInfo);

    // 🔟 Update state UI
    setStarted(true);
    if (onPress) onPress(true);
  } catch (err) {
    // console.error("[trackingStart] Start error:", err);
    Alert.alert("Terjadi error saat memulai tracking.", err?.message || "");
  } finally {
    setLoading(false);
  }
};
