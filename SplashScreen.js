// SplashScreen.js
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const SplashScreenComponent = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prepare = async () => {
      await SplashScreen.preventAutoHideAsync(); // Mencegah splash screen otomatis tersembunyi
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }).start();

      // Menunggu beberapa detik sebelum menyembunyikan splash screen
      setTimeout(async () => {
        await SplashScreen.hideAsync(); // Menyembunyikan splash screen
        onFinish(); // Memanggil fungsi untuk melanjutkan ke screen berikutnya
      }, 2000); // Durasi tampilan splash screen
    };

    prepare();
  }, [fadeAnim, onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Image 
        source={require('./assets/32MLCI.jpg')} // Ganti dengan path ke GIF Anda
        style={styles.logo} 
        resizeMode="cover" // Mengatur mode tampilan
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logo: {
    width: '100%', // Atur lebar sesuai kebutuhan
    height: '100%', // Atur tinggi sesuai kebutuhan
  },
});

export default SplashScreenComponent;