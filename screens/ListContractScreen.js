// ListContractScreen.js (FINAL REFACTORED)
import React, { useState, useEffect } from "react";
import { View, StyleSheet, Alert, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getContracts as dbGetContracts,
  saveContracts as dbSaveContracts,
  getContractsRaw as dbGetContractsRaw,
} from "../utils/database/contracts";

import { HeaderButtons } from "../components/HeaderButtons";
import { ContractHeader } from "../components/ContractHeader";
import SeeMoreButton from "../components/SeeMoreButton";
import CardList from "../components/CardList";
import CustomAlert from "../components/CustomAlert";
import GlobalLoading from "../components/GlobalLoading";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useMap } from "../context/MapContext";
import { useContractCheckIn } from "../hooks/useContractCheckIn";

// Services
import { ContractService } from "../services/ContractService";
import SyncEngine from "../services/sync/syncEngine";
import * as TrackingService from "../services/tracking";

// ===============================
// NEW → TrackingContext
// ===============================
import { useTracking } from "../context/TrackingContext";

const ListContractScreen = ({ navigation }) => {
  const { colors, theme, setTheme } = useTheme();
  const { signOut, state, logout } = useAuth();
  const profile = state.userInfo || {};

  const {
    addCheckin,
    addCheckinLocal,
    loadCheckinsFromStorage,
    checkinLocations,
  } = useMap();

  const { isStarted, setIsStarted } = useTracking();

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
  const [contracts, setContracts] = useState([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [isAlertVisible, setAlertVisible] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // ============================================================
  // Load saved comments
  // ============================================================
  useEffect(() => {
    const loadComments = async () => {
      const saved = await AsyncStorage.getItem("comments");
      if (saved) setComments(JSON.parse(saved));
    };
    loadComments();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("comments", JSON.stringify(comments));
  }, [comments]);

  // ============================================================
  // Back button block
  // ============================================================
  useEffect(() => {
    const backAction = () => {
      if (isLoadingContracts) {
        Alert.alert("Tunggu", "Sedang mengambil data kontrak...");
        return true;
      }
      if (navigation.canGoBack()) navigation.goBack();
      else setAlertVisible(true);
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, [navigation, isLoadingContracts]);

  // ============================================================
  // FETCH CONTRACTS
  // ============================================================
  const fetchContracts = async () => {
    if (isFetching) return;

    setIsFetching(true);
    setIsLoadingContracts(true);

    try {
      const netInfo = await import("@react-native-community/netinfo");
      const connection = await netInfo.default.fetch();

      let apiContracts = [];
      let localContracts = [];

      if (connection.isConnected) {
        apiContracts = await ContractService.fetchContracts(
          profile,
          addCheckinLocal,
          checkinLocations
        );

        localContracts = await dbGetContracts(profile.UserName);

        if (JSON.stringify(localContracts) !== JSON.stringify(apiContracts)) {
          await dbSaveContracts(apiContracts, profile.UserName);
        }

        const updated = await dbGetContracts(profile.UserName);
        setContracts(updated);
      } else {
        localContracts = await dbGetContracts(profile.UserName);
        setContracts(localContracts);
      }

      await loadCheckinsFromStorage();
    } catch (error) {
      // console.error("Error fetching contracts:", error);
      Alert.alert("Error", "Gagal memuat data kontrak.");
    } finally {
      setIsFetching(false);
      setIsLoadingContracts(false);
    }
  };

  const handleCardPress = (id) => {
    setSelectedId(selectedId === id ? null : id);
  };

  const handleDetailPress = (item) => {
    const commentText = item.comment?.trim()
      ? item.comment
      : comments[item.LeaseNo] || "";

    navigation.navigate("Detail Kontrak", {
      ...item,
      Comment: commentText,
    });
  };

  const handleCommentSubmit = (LeaseNo, newComment) => {
    setComments((prev) => ({ ...prev, [LeaseNo]: newComment }));

    setContracts((prevContracts) => {
      const updated = prevContracts.map((contract) =>
        contract.LeaseNo === LeaseNo
          ? { ...contract, comment: newComment }
          : contract
      );

      const updatedItem = updated.find((c) => c.LeaseNo === LeaseNo);
      if (updatedItem) handleCheckin(updatedItem, newComment);

      return updated;
    });
  };

  const handleSeeMore = () => setVisibleCount((prev) => prev + 4);

  // ============================================================
  // NEW → Toggle start-stop pakai TrackingContext
  // ============================================================
  const toggleStartStop = async () => {
    try {
      const newStatus = await TrackingService.toggleTrackingStatus(
        profile,
        isStarted
      );
      setIsStarted(newStatus); // only update context
    } catch (err) {
      // console.error("toggle error", err);
      Alert.alert("Error", "Failed to toggle tracking status.");
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("userToken");
    signOut();
    navigation.navigate("LoginScreen");
  };

  // ============================================================
  // FOCUS → Fetch contracts only (no tracking check!)
  // ============================================================
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", async () => {
      console.log("[FOCUS] ListContractScreen");

      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        setTimeout(() => {
          if (!isFetching) fetchContracts();
        }, 1200);
      } else {
        fetchContracts();
      }

      // offline checkins load
      try {
        const offlineCheckins = await ContractService.getUnuploadedCheckins();
        offlineCheckins.forEach((checkin) => {
          addCheckinLocal({
            contractId: checkin.lease_no,
            contractName: checkin.customer_name,
            remark: checkin.comment,
            latitude: checkin.latitude,
            longitude: checkin.longitude,
            timestamp: checkin.timestamp,
            tipechekin: "kontrak",
            isOffline: true,
          });
        });
      } catch (err) {
        // console.error("offline checkin load error:", err);
      }
    });

    return unsubscribe;
  }, [navigation, profile?.UserName]);

  // ============================================================
  // Sync All
  // ============================================================
  const handleSyncAll = async () => {
    try {
      await SyncEngine.syncCheckins();
      await fetchContracts();
    } catch (err) {
      // console.error("[SYNC ALL] Error:", err);
      Alert.alert("Error", "Gagal melakukan sync.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
      <GlobalLoading visible={isLoading || isLoadingContracts} />

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <HeaderButtons
          isStarted={isStarted} // from TrackingContext
          onStartStopPress={toggleStartStop}
          onMapPress={() => navigation.navigate("MapTrackingScreen")}
          onThemeToggle={() =>
            setTheme((prev) => (prev === "light" ? "dark" : "light"))
          }
          theme={theme}
          colors={colors}
          checkinLocations={checkinLocations}
          navigation={navigation}
        />

        <ContractHeader
          contractCount={contracts.length}
          onSyncPress={handleSyncAll}
          colors={colors}
        />

        <View style={styles.cardListContainer}>
          <CardList
            data={contracts.slice(0, visibleCount)}
            selectedId={selectedId}
            onCardPress={handleCardPress}
            onDetailPress={handleDetailPress}
            onCommentSubmit={handleCommentSubmit}
            isStarted={isStarted} // from context
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
    justifyContent: "flex-start",
    width: "100%",
    paddingTop: hp("5%"),
    paddingBottom: hp("5%"),
  },
  cardListContainer: {
    flex: 1,
    paddingHorizontal: wp("5%"),
  },
});

export default ListContractScreen;
