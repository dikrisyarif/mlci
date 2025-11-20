import React, { useContext, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { AuthContext } from "../context/AuthContext";
import NetInfo from "@react-native-community/netinfo";

// PAKAI ENGINE BARU
import SyncEngine from "../services/sync";

const SyncSection = ({ count }) => {
  const { user } = useContext(AuthContext);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected);
    });

    if (user) {
      SyncEngine.init() // mempersiapkan queue/offline data
        .then(() => SyncEngine.start()) // auto-sync worker
        .catch((err) => console.error("SyncEngine init error:", err));
    }

    return () => {
      unsubscribe();
      SyncEngine.stop();
    };
  }, [user]);

  const handleManualSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      await SyncEngine.syncAll(); // ganti syncData() → syncAll()
      setLastSync(new Date());
    } catch (error) {
      console.error("Manual sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <View style={styles.infoContainer}>
        <Text style={styles.countText}>Penugasan ({count})</Text>
        <Text style={[styles.statusText, !isOnline && styles.offlineText]}>
          {isOnline ? "Online" : "Offline"}
        </Text>
      </View>
      {lastSync && (
        <Text style={styles.syncText}>
          Last sync: {lastSync.toLocaleTimeString()}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.syncButton, !isOnline && styles.disabledButton]}
        onPress={handleManualSync}
        disabled={!isOnline || isSyncing}
      >
        <Icon
          name="sync"
          size={24}
          color="#fff"
          style={isSyncing && styles.rotating}
        />
        <Text style={styles.buttonText}>
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    margin: 16,
    elevation: 2,
  },
  infoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  countText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  statusText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  offlineText: {
    color: "#f44336",
  },
  syncText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  syncButton: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  rotating: {
    transform: [{ rotate: "360deg" }],
  },
});

export default SyncSection;
