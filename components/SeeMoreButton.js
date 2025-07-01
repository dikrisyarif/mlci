import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext'; // Impor useTheme

const SeeMoreButton = ({ onPress }) => {
  const { colors } = useTheme(); // Ambil warna dari tema
  return (
    <TouchableOpacity 
      style={[styles.seeMoreButton, { backgroundColor: colors.button, borderColor: colors.buttonborder, borderWidth: 1}]} 
      onPress={onPress}>
      <Text style={styles.seeMoreText}>See More</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  seeMoreButton: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#007bff',
    borderRadius: 5,
    margin: 10,
  },
  seeMoreText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default SeeMoreButton;