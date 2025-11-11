import React, { useState, useEffect } from 'react';
import { View, Image, ScrollView, StyleSheet, Modal, TouchableOpacity, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const MultiImageUploader = ({ leaseNo }) => {
  const [images, setImages] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    const loadImages = async () => {
      if (!leaseNo) return;
      const saved = await AsyncStorage.getItem(`photos_${leaseNo}`);
      if (saved) {
        setImages(JSON.parse(saved));
      }
    };
    loadImages();
  }, [leaseNo]);

  const takePhoto = async () => {
    setPhotoLoading(true);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      alert('Izin kamera diperlukan!');
      setPhotoLoading(false);
      return;
    }
    const locationPerm = await Location.requestForegroundPermissionsAsync();
    if (!locationPerm.granted) {
      alert('Izin lokasi diperlukan!');
      setPhotoLoading(false);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled) {
      let coords = null;
      try {
        const loc = await Location.getCurrentPositionAsync({});
        coords = loc.coords;
      } catch {
        coords = null;
      }
      const newImage = result.assets ? result.assets[0] : result;
      setImages(prev => [...prev, { ...newImage, latitude: coords?.latitude, longitude: coords?.longitude }]);
    }
    setPhotoLoading(false);
  };

  const uploadImages = async () => {
    setLoading(true);
    try {
      const savedImages = [];
      for (const img of images) {
        const filename = img.uri.split('/').pop();
        const destPath = FileSystem.documentDirectory + leaseNo + '_' + filename;
        await FileSystem.copyAsync({
          from: img.uri,
          to: destPath,
        });
        savedImages.push({ ...img, localUri: destPath });
      }
      await AsyncStorage.setItem(`photos_${leaseNo}`, JSON.stringify(savedImages));
      setImages(savedImages);
      alert('Foto berhasil disimpan & terikat kontrak!');
    } catch (err) {
      alert('Gagal menyimpan foto: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeImage = async (idx) => {
    const newImages = images.filter((_, i) => i !== idx);
    setImages(newImages);
    await AsyncStorage.setItem(`photos_${leaseNo}`, JSON.stringify(newImages));
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={takePhoto} disabled={photoLoading}>
        <MaterialIcons name="add-a-photo" size={24} color="#fff" />
        <Text style={styles.addButtonText}>{photoLoading ? 'Mengambil Foto...' : 'Ambil Foto'}</Text>
      </TouchableOpacity>
      <ScrollView horizontal style={styles.previewContainer} showsHorizontalScrollIndicator={false}>
        {images.map((img, idx) => (
          <View key={idx} style={styles.imageWrapper}>
            <TouchableOpacity onPress={() => setPreviewImage(img.localUri || img.uri)}>
              <Image
                source={{ uri: img.localUri || img.uri }}
                style={styles.image}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(idx)}>
              <MaterialIcons name="cancel" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      {images.length > 0 && (
        <TouchableOpacity style={styles.uploadButton} onPress={uploadImages} disabled={loading}>
          <MaterialIcons name="cloud-upload" size={22} color="#fff" />
          <Text style={styles.uploadButtonText}>{loading ? 'Menyimpan...' : 'Upload Semua Foto'}</Text>
        </TouchableOpacity>
      )}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setPreviewImage(null)}>
            <Text style={{ color: '#fff', fontSize: 18 }}>Tutup</Text>
          </TouchableOpacity>
          {previewImage && (() => {
            const imgObj = images.find(img => (img.localUri || img.uri) === previewImage);
            return (
              <>
                <Image source={{ uri: previewImage }} style={styles.previewImage} />
                {(imgObj?.latitude && imgObj?.longitude) && (
                  <Text style={styles.locationPreviewText}>
                    Lokasi: {imgObj.latitude.toFixed(5)}, {imgObj.longitude.toFixed(5)}
                  </Text>
                )}
              </>
            );
          })()}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 10 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  previewContainer: { marginVertical: 10, minHeight: 90 },
  imageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007bff',
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
    zIndex: 2,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 2,
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
  },
  previewImage: {
    width: 300,
    height: 300,
    borderRadius: 12,
  },
  locationPreviewText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default MultiImageUploader;
