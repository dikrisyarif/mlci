import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Header from '../components/Header';
import CustomAlert from '../components/CustomAlert';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const { state, logout } = useAuth();
  const profile = state.userInfo || {};

  const handleLogout = () => {
    setShowConfirm(false);
    logout();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Header title="Profile" />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Information</Text>

            {[
              { label: 'Username', value: profile.UserName || '-' },
              { label: 'Full Name', value: profile.FullName || '-' },
              {
                label: 'Branch',
                value: profile.BranchCode && profile.BranchName
                  ? `${profile.BranchCode} – ${profile.BranchName}`
                  : '-',
              },
              { label: 'Employee ID', value: profile.EmployeeId || '-' },
              {
                label: 'Position',
                value: profile.PositionId && profile.PositionName
                  ? `${profile.PositionId} – ${profile.PositionName}`
                  : '-',
              },
              {
                label: 'Division',
                value: profile.DivisionId && profile.DivisionName
                  ? `${profile.DivisionId} – ${profile.DivisionName}`
                  : '-',
              },
            ].map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value} numberOfLines={1}>
                  {item.value}
                </Text>
                {index < 5 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowConfirm(true)}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>

        <CustomAlert
          visible={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleLogout}
          message="Are you sure you want to logout?"
          mode="confirm"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  itemRow: {
    paddingVertical: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 12,
  },
  logoutBtn: {
    marginTop: 24,
    backgroundColor: '#EF4444', // Modern red (Tailwind-inspired)
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default ProfileScreen;