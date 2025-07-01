import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons'; // Pastikan Anda mengimpor Icon

const SyncSection = ({ count, onSync }) => {
  return (
    <View style={styles.syncContainer}>
      <Text style={styles.countText}>Penugasan ({count})</Text>
      // <TouchableOpacity onPress={onSync} style={styles.syncButton}>
      //   <Icon name="synzc" size={24} color="#007bff" /> {/* Ganti dengan ikon yang diinginkan */}
      // </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  syncContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 10,
  },
  countText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  syncButton: {
    padding: 10, // Tambahkan padding untuk area klik yang lebih besar
  },
});

export default SyncSection;