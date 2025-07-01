import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons'; 
import CustomAlert from './CustomAlert'; 
import CommentModal from './CommentModal'; 
import { useTheme } from '../context/ThemeContext';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';

const Card = ({
  leaseNo,
  name,
  address,
  phone,
  onPress,
  isSelected,
  onDetailPress,
  onCommentSubmit,
  isStarted,
  comment,
  isCheckedIn
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(isCheckedIn || false);
  const [localComment, setLocalComment] = useState(comment || '');
  const { colors } = useTheme();

  useEffect(() => {
    setLocalComment(comment || '');
    setIsChecked(isCheckedIn || false);
  }, [comment, isCheckedIn]);

  const handleCheckboxPress = () => {
    setModalVisible(true);
  };

  const handleConfirm = () => {
    setIsChecked(true);
    setModalVisible(false);
    setCommentModalVisible(true);
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  const handleCommentSubmit = (newComment) => {
    setLocalComment(newComment);
    if (onCommentSubmit) {
      onCommentSubmit(newComment);
    }
    setCommentModalVisible(false);
  };

  return (
    <View style={[
      styles.card,
      isSelected && styles.selectedCard,
      {
        borderColor: colors.background === '#000000' ? '#fff' : '#007bff',
        backgroundColor: colors.card
      }
    ]}>
      <TouchableOpacity onPress={onPress}>
        <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.address, { color: colors.textsecond }]}>{address}</Text>
        <Text style={[styles.phone, { color: colors.textblue }]}>Telp: {phone}</Text>
      </TouchableOpacity>

      {/* Tampilkan komentar jika sudah check-in */}
      {isChecked && localComment ? (
        <Text style={styles.commentText}>{localComment}</Text>
      ) : null}

      {/* Tombol panah detail */}
      <TouchableOpacity
        style={[
          styles.arrowButton,
          {
            backgroundColor: colors.button,
            borderWidth: 1,
            borderColor: colors.buttonborder
          }
        ]}
        onPress={onDetailPress}
      >
        <Icon name="arrow-right" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Checkbox atau ikon bendera */}
      {isChecked ? (
        // ✅ Sudah check-in: tampilkan ikon bendera hijau
        <View style={styles.checkboxButton}>
          <Icon
            name="flag"
            size={24}
            style={[styles.checkbox, { color: 'green' }]}
          />
        </View>
      ) : isStarted ? (
        // ✅ Belum check-in dan isStarted: tampilkan checkbox
        <TouchableOpacity style={styles.checkboxButton} onPress={handleCheckboxPress}>
          <Icon
            name="check-box-outline-blank"
            size={24}
            style={[
              styles.checkbox,
              { color: colors.background === '#000000' ? colors.buttonborder : '#007bff' }
            ]}
          />
        </TouchableOpacity>
      ) : null}

      {/* Alert konfirmasi check-in */}
      <CustomAlert
        visible={modalVisible}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        message={`Do you want to select ${name}?`}
      />

      {/* Modal komentar */}
      <CommentModal
        visible={commentModalVisible}
        onClose={() => setCommentModalVisible(false)}
        onSubmit={handleCommentSubmit}
      />
    </View>
  );
};
const styles = StyleSheet.create({
  card: {
    padding: wp('4%'),
    borderRadius: 8,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    marginBottom: wp('3%'),
    width: '100%',
    position: 'relative', 
    borderWidth: 1,
  },
  selectedCard: {
    backgroundColor: '#007bff', 
  },
  name: {
    fontSize: wp('5%'),
    fontWeight: 'bold',
  },
  address: {
    fontSize: wp('3.5%'),
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 10
  },
  phone: {
    fontSize: wp('4%'),
    fontWeight: 'bold'
  },
  arrowButton: {
    position: 'absolute', 
    bottom: wp('2%'),
    right: wp('2%'),
    width: 30,
    height: 30,
    borderRadius: 25,
    backgroundColor: '#007bff', 
    zIndex: 1,
  },
  checkboxButton: {
    position: 'absolute', 
    top: wp('2%'),
    right: wp('2%'),
    backgroundColor: 'transparent', 
    zIndex: 1,
  },
  commentText: {
    marginTop: wp('2%'),
    fontStyle: 'italic',
    color: '#555',
  },
});

export default Card;
