import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, Modal, StyleSheet, Animated, KeyboardAvoidingView, Platform } from 'react-native';

const CommentModal = ({ visible, onClose, onSubmit }) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // console.log("Comment Modal Visibility:", visible); // Log untuk memantau status modal
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, scaleAnim]);

  const handleSubmit = () => {
    if (!comment.trim()) {
      setError('Komentar tidak boleh kosong.');
      return;
    }
    setError('');
    onSubmit(comment);
    setComment('');
    onClose();
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardShouldPersistTaps="handled" // Menjaga input tetap aktif saat keyboard muncul
      >
        <Animated.View style={[styles.modalContainer, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.modalTitle}>Komentar</Text>
          <TextInput
            style={styles.input}
            placeholder="Masukkan komentar Anda"
            value={comment}
            onChangeText={text => {
              setComment(text);
              if (error) setError('');
            }}
            multiline
          />
          {error ? <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text> : null}
          <Button title="Kirim" onPress={handleSubmit} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    width: '100%',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10 , 
    marginBottom: 10,
    minHeight: 100,
  },
});

export default CommentModal;