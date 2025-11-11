import React, { useState } from 'react';
import {
  View,
  TextInput,
  Alert,
  StyleSheet,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Text,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/FontAwesome';
import { loginToMitsui } from '../api/authApi';
import CustomAlert from '../components/CustomAlert';
import Constants from 'expo-constants';
import GlobalLoading from '../components/GlobalLoading';

const MITSUI_CLIENT_ID = Constants.expoConfig?.extra?.MITSUI_CLIENT_ID || process.env.MITSUI_CLIENT_ID;
const MITSUI_CLIENT_SECRET = Constants.expoConfig?.extra?.MITSUI_CLIENT_SECRET || process.env.MITSUI_CLIENT_SECRET;

const LoginScreen = ({ navigation }) => {
  const { colors, setTheme } = useTheme();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');


  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setAlertMessage('Username dan password tidak boleh kosong.');
      setAlertVisible(true);
      return;
    }
    setLoading(true);
    try {
      const { result, accessToken, clientId } = await loginToMitsui({ username, password });
      if (result.Status === 0) {
        setAlertMessage(result.Message || 'Username atau password salah.');
        setAlertVisible(true);
        return;
      }
      if (result.Status === 1 && Array.isArray(result.Data) && result.Data.length > 0) {
        const user = result.Data[0];
        signIn(accessToken, {
          UserName: user.UserName,
          FullName: user.FullName,
          BranchCode: user.BranchCode,
          BranchName: user.BranchName,
          EmployeeId: user.EmployeeId,
          PositionId: user.PositionId,
          PositionName: user.PositionName,
          DivisionId: user.DivisionId,
          DivisionName: user.DivisionName,
        });
        try {
          import('../backgroundTrackingManager').then(({ startBackgroundTracking }) => {
            startBackgroundTracking();
          }).catch((err) => {
            //console.log('[LoginScreen] Error starting background tracking:', err);
          });
        } catch (err) {}
      } else {
        setAlertMessage('Data user tidak ditemukan.');
        setAlertVisible(true);
      }
    } catch (err) {
      let msg = err?.message || 'Terjadi kesalahan saat login.';
      if (msg.includes('Network')) msg = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      setAlertMessage(msg);
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (text) => {
    setUsername(text);
    if (text === password) {
      setPassword('');
    }
  };

  return (
    <View style={styles.container}>
      <GlobalLoading visible={loading} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <SafeAreaView style={styles.safeArea}>
            <TouchableOpacity
              style={styles.themeSwitchButton}
              onPress={() => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'))}
            >
              <Icon name="adjust" size={24} color={colors.text} />
            </TouchableOpacity>

            <Image source={require('../assets/MLCI.png')} style={styles.logo} />

            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="Username"
                placeholderTextColor={colors.text}
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
              />
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
                  placeholder="Password"
                  placeholderTextColor={colors.text}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={{ marginBottom: 30 }} onPress={() => setShowPassword(!showPassword)}>
                  <Icon name={showPassword ? 'eye' : 'eye-slash'} size={20} color="#888" style={styles.eyeIcon} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: colors.button, borderColor: colors.buttonborder, borderWidth: 1 }]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.loginButtonText}>Login</Text>
              </TouchableOpacity>
            </View>

            <CustomAlert
              visible={alertVisible}
              onClose={() => setAlertVisible(false)}
              message="Login failed. Please try again."
              mode="alert"
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: 16,
  },
  logo: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginTop: 100,
  },
  inputContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 15,
    marginBottom: 10,
    fontSize: 16,
    width: '100%',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
  },
  loginButton: {
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  themeSwitchButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
  },
});

export default LoginScreen;
