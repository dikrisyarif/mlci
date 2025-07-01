import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import CommentModal from '../components/CommentModal';
import { updateCheckin, updateComment } from '../api/listApi';
import { useAuth } from '../context/AuthContext';

const DetailScreen = ({ route, navigation }) => {
  const {
    CustName,
    CustAddress,
    LeaseNo,
    PhoneNo,
    PoliceNo,
    EquipType,
    Unit,
    AmountOd,
    Overdue,
    DueDate,
    LastCallDate,
    LastCallName,
    LastNote,
    Comment
  } = route.params;

  const { state } = useAuth();
  const profile = state?.userInfo || {};
  const isCheckedIn = !!route.params?.isCheckedIn || !!route.params?.CheckIn;
  const checkInTime = route.params?.CheckIn;
  const latitude = route.params?.Latitude || route.params?.latitude;
  const longitude = route.params?.Longitude || route.params?.longitude;

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [comment, setComment] = useState(Comment || '');
  const [loading, setLoading] = useState(false);

  // Helper untuk dapatkan tanggal ISO string
  function getIsoDateString() {
    return new Date().toISOString();
  }

  const handleCommentSubmit = async (newComment) => {
    setComment(newComment);
    setCommentModalVisible(false);
    if (isCheckedIn) {
      setLoading(true);
      try {
        await updateComment({
          EmployeeName: profile.UserName,
          LeaseNo,
          Comment: newComment,
          CreatedDate: getIsoDateString(),
        });
        // Optional: tampilkan notifikasi sukses
      } catch (e) {
        // Optional: tampilkan notifikasi error
        alert('Gagal update komentar ke server.');
      } finally {
        setLoading(false);
      }
    }
  };

  const renderRow = (label, value) => (
    <View style={styles.row} key={label}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '-'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f2f2f2', marginTop: -20}} >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.iconCircle}>
            <Icon name="file-text-o" size={30} color="#fff" />
          </View>
          <Text style={styles.name}>{CustName}</Text>
          <Text style={styles.address}>{CustAddress}</Text>
        </View>

        <View style={styles.detailCard}>
          {renderRow('Contract No.', LeaseNo)}
          {renderRow('Contact Person', CustName)}
          {renderRow('Telp.', PhoneNo)}
          {renderRow('Plat No.', PoliceNo)}
          {renderRow('Equip Type', EquipType)}
          {renderRow('Unit', Unit)}
          {renderRow('Amount OD', AmountOd)}
          {renderRow('Overdue', Overdue)}
          {renderRow('Jadwal Jatuh Tempo', DueDate)}
          {LastCallDate && renderRow('Last Call', LastCallDate)}
          {LastCallName && renderRow('Last Call Name', LastCallName)}
          {LastNote && renderRow('Last Note', LastNote)}

          <View style={{ marginTop: 20 }}>
            <Text style={styles.label}>Comment</Text>

            {/* Komentar yang ditampilkan */}
            <View style={styles.commentDisplay}>
              <Text style={styles.commentText}>{comment || '-'}</Text>
              {/* Tombol edit komentar hanya jika sudah check-in */}
              {isCheckedIn && (
                <TouchableOpacity onPress={() => setCommentModalVisible(true)} disabled={loading}>
                  <Icon name="edit" size={20} color="#007bff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View> 
        <CommentModal
          visible={commentModalVisible}
          onClose={() => setCommentModalVisible(false)}
          onSubmit={handleCommentSubmit}
        />

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingLeft: 20,
    paddingRight: 20, 
  },
  headerCard: {
    backgroundColor: '#007bff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    backgroundColor: '#005bb5',
    padding: 15,
    borderRadius: 50,
    marginBottom: 10,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  address: {
    fontSize: 14,
    color: '#e0e0e0',
    marginTop: 5,
    textAlign: 'center',
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  label: {
    width: 130,
    fontWeight: 'bold',
    fontSize: 14,
    color: '#333',
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  // commentInput: {
  //   borderWidth: 1,
  //   borderColor: '#ccc',
  //   borderRadius: 10,
  //   padding: 10,
  //   marginTop: 8,
  //   fontSize: 14,
  //   minHeight: 60,
  //   backgroundColor: '#f9f9f9',
  // },
  // button: {
  //   backgroundColor: '#007bff',
  //   padding: 12,
  //   borderRadius: 6,
  //   alignItems: 'center',
  // },
  // buttonText: {
  //   color: '#fff',
  //   fontWeight: 'bold',
  // },
});

export default DetailScreen;
