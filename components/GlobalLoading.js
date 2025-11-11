import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const GlobalLoading = ({ visible, text = 'Loading...' }) => {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  const timerRef = useRef();
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer;
    if (visible) {
      setShow(true);
      timer = setTimeout(() => {}, 1000); // minimal tampil 1 detik
      spinAnim.setValue(0);
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000, // 2 detik rotasi
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else if (show) {
      timer = setTimeout(() => setShow(false), 1000); // delay hide 1 detik
    }
    return () => {
      clearTimeout(timer);
    };
  }, [visible]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!show) return null;
  return (
    <View style={styles.overlay}>
      <Animated.Image
        source={require('../assets/MLCI.png')}
        style={[
          styles.logo,
          { tintColor: colors.primary, transform: [{ rotate: spin }] },
        ]}
        resizeMode="contain"
      />
      <Text style={[styles.text, { color: colors.primary }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff', // putih
    zIndex: 99,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 18,
  },
  text: {
    marginTop: 0,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default GlobalLoading;
