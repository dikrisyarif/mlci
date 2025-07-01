import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CustomAlert from './CustomAlert'; // import sesuai path mu

const Header = () => {
  const { state, signOut } = useAuth();
  const [imageUri, setImageUri] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      const storedImageUri = await AsyncStorage.getItem('imageUri');
      if (storedImageUri) {
        setImageUri(storedImageUri);
      }
    };
    loadImage();
  }, []);

  const updateImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert('Izin dibutuhkan untuk mengakses galeri!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setImageError(false);
      await AsyncStorage.setItem('imageUri', uri);
    }
  };

  const handleLogoutPress = () => {
    setShowLogoutAlert(true);
  };

  const onLogoutConfirm = () => {
    setShowLogoutAlert(false);
    signOut();
  };

  const onLogoutCancel = () => {
    setShowLogoutAlert(false);
  };

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={handleLogoutPress} style={styles.logoutButton}>
        <Icon name="logout" size={24} color="#d00" />
      </TouchableOpacity>

      <CustomAlert
        visible={showLogoutAlert}
        onClose={onLogoutCancel}
        onConfirm={onLogoutConfirm}
        message="Apakah Anda yakin ingin logout?"
        mode="confirm"
      />

      <TouchableOpacity onPress={updateImage}>
        {imageError || !imageUri ? (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>+</Text>
          </View>
        ) : (
          <Image
            source={{ uri: imageUri }}
            style={styles.avatar}
            onError={() => setImageError(true)}
          />
        )}
      </TouchableOpacity>

      <Text style={styles.name}>{state?.userInfo?.FullName || 'Full Name'}</Text>
      <Text style={styles.email}>{state?.userInfo?.UserName || 'username@example.com'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 25,
    position: 'relative',
  },
  logoutButton: {
    position: 'absolute',
    top: 0,
    right: 15,
    padding: 5,
    zIndex: 1,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 10,
    backgroundColor: '#ccc',
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 10,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    color: '#666',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  email: {
    fontSize: 14,
    color: '#555',
  },
});

export default Header;
