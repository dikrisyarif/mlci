import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';

export const ContractHeader = ({ 
  contractCount, 
  onSyncPress, 
  colors 
}) => (
  <View style={styles.container}>
    <Text style={[styles.countText, { color: colors.text }]}>
      Penugasan ({contractCount})
    </Text>
    <TouchableOpacity 
      style={[styles.syncButton, { backgroundColor: colors.button }]} 
      onPress={onSyncPress}
    >
      <Text style={styles.syncButtonText}>Sync All</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: wp('5%'),
    marginVertical: wp('1%'),
  },
  countText: {
    fontSize: wp('4.5%'),
    fontWeight: 'bold',
  },
  syncButton: {
    paddingHorizontal: 5,
    borderRadius: 5,
    alignItems: 'center',
    marginLeft: 10,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});