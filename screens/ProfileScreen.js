import React, { useState } from 'react';
import { View, ScrollView, Text, StyleSheet, Button } from 'react-native';
import Header from '../components/Header';
import CustomAlert from '../components/CustomAlert';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const { state, logout } = useAuth();
  const profile = state.userInfo || {};

  const handleLogout = () => {
    setShowConfirm(false);
    logout(); // panggil fungsi logout dari context
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Header />

        <View style={styles.section}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>{profile.UserName || '-'}</Text>

          <Text style={styles.label}>Full Name</Text>
          <Text style={styles.value}>{profile.FullName || '-'}</Text>

          <Text style={styles.label}>Branch</Text>
          <Text style={styles.value}>
            {profile.BranchCode} - {profile.BranchName}
          </Text>

          <Text style={styles.label}>Employee ID</Text>
          <Text style={styles.value}>{profile.EmployeeId || '-'}</Text>

          <Text style={styles.label}>Position</Text>
          <Text style={styles.value}>
            {profile.PositionId} - {profile.PositionName}
          </Text>

          <Text style={styles.label}>Division</Text>
          <Text style={styles.value}>
            {profile.DivisionId} - {profile.DivisionName}
          </Text>
        </View> 
      </ScrollView>

      {/* Custom Alert */}
      <CustomAlert
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleLogout}
        message="Are you sure you want to logout?"
        mode="confirm"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
    backgroundColor: '#f5f5f5',
    marginTop: 30,
  },
  section: {
    marginTop: 10,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    color: '#888',
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 2,
  },
});

export default ProfileScreen;
