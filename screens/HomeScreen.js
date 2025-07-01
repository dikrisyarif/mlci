// screens/HomeScreen.js
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '../context/ThemeContext';

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('CheckIn')}
      >
        <Icon name="map-marker" size={40} color="#fff" />
        <Text style={styles.text}>Check-in</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ListContract')}
      >
        <Icon name="list" size={40} color="#fff" />
        <Text style={styles.text}>List Contract</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexDirection: 'row',
    padding: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#007bff',
    padding: 20,
    borderRadius: 15,
  },
  text: {
    marginTop: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default HomeScreen;
