import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import PropTypes from 'prop-types';

const CustomAlert = ({ visible, onClose, onConfirm, message, mode = 'confirm' }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsAnimating(false);
      });
    }
  }, [visible, fadeAnim]);

  const handleConfirm = () => {
    setIsAnimating(true);
    onConfirm();
  };

  return (
    <Modal transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
          <Text style={styles.modalTitle}>
            {mode === 'confirm' ? 'Confirm' : 'Alert'}
          </Text>
          <Text style={styles.modalMessage}>{message}</Text>

          {mode === 'confirm' ? (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={onClose}
                disabled={isAnimating}
              >
                <Text style={styles.buttonText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={handleConfirm}
                disabled={isAnimating}
              >
                <Text style={styles.buttonText}>Yes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.singleButtonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={onClose}
                disabled={isAnimating}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

CustomAlert.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func,
  message: PropTypes.string.isRequired,
  mode: PropTypes.oneOf(['confirm', 'alert']), // default: 'confirm'
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
    minHeight: 150,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalMessage: {
    marginVertical: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  singleButtonContainer: {
    marginTop: 15,
    width: '100%',
  },
  button: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#007bff',
    minHeight: 40, // tambahkan tinggi minimum
    borderRadius: 5,
    marginHorizontal: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,

  },
});

export default CustomAlert;
