import { Alert } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Database from "../../utils/database";
import { getLocalISOString, getBestAddress } from "./trackingUtils";
import { stopBackgroundTracking } from "../../backgroundTrackingManager";

export const handleStopTracking = async ({
  authState,
  addCheckin,
  setStarted,
  setLoading,
  onPress,
  setShowAlert,
}) => {
  setShowAlert(false);
  setLoading(true);
  try {
    // 1️⃣ Minta izin lokasi
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Izin lokasi diperlukan untuk check-out.");
      return;
    }

    // 2️⃣ Ambil lokasi sekarang
    const loc = await Location.getCurrentPositionAsync({});
    if (!loc?.coords) {
      Alert.alert("Data lokasi tidak valid.");
      return;
    }

    // 3️⃣ Ambil nama user
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

    // 5️⃣ Buat data check-out
    const timestamp = getLocalISOString();
    const checkOutData = {
      type: "stop",
      tipechekin: "stop",
      timestamp,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      Address: address,
    };

    // 6️⃣ Simpan ke SQLite
    await Database.saveAppState("isTracking", "false");
    await Database.addCheckinStartStop({
      employee_name: employeeName,
      type: "stop",
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp,
    });

    // 7️⃣ Sync ke server (kalau online)
    const netInfo = await NetInfo.fetch();
    if (netInfo.isConnected) {
      await addCheckin(checkOutData).catch(() => {
        Alert.alert("Mode Offline", "Status stop disimpan offline.");
      });
    } else {
      Alert.alert("Mode Offline", "Status stop disimpan offline.");
    }

    // 8️⃣ Hentikan background tracking
    await stopBackgroundTracking();

    // 9️⃣ Update UI
    setStarted(false);
    if (onPress) onPress(false);
  } catch (err) {
    // console.error("[trackingStop] Stop error:", err);
    Alert.alert("Terjadi error saat menghentikan tracking.", err?.message || "");
  } finally {
    setLoading(false);
  }
};
