# Dokumentasi Flow Data & Context

## 1. AuthContext
- **Tujuan:** Menyimpan dan mengelola status autentikasi user (login/logout, user info, token).
- **Penyimpanan:**
  - Token dan user info disimpan di SecureStore (`expo-secure-store`).
- **Akses:**
  - `useAuth()` untuk akses state, signIn, signOut di seluruh komponen.
- **Flow:**
  1. User login → signIn(token, userInfo) → simpan ke SecureStore & update context.
  2. Logout → signOut() → hapus SecureStore & reset context.

## 2. ApiContext
- **Tujuan:** Menyediakan fungsi API umum (login, getUserData) ke seluruh aplikasi.
- **Akses:**
  - `useApi()` untuk akses fungsi API di komponen.
- **Flow:**
  1. Komponen panggil `login`/`getUserData` → fetch ke API → return data/error ke komponen.

## 3. ThemeContext
- **Tujuan:** Mengelola tema aplikasi (light/dark) dan warna-warna global.
- **Akses:**
  - `useTheme()` untuk akses/mengubah tema dan warna di seluruh aplikasi.
- **Flow:**
  1. User ganti tema → setTheme('light'/'dark') → context update → seluruh UI ikut berubah.

## 4. MapContext
- **Tujuan:** Menyimpan dan mengelola data lokasi check-in user.
- **Penyimpanan:**
  - Data check-in disimpan di AsyncStorage (`CheckinLocations`).
- **Akses:**
  - `useMap()` untuk akses lokasi check-in, tambah, hapus, dan load ulang data.
- **Flow:**
  1. User check-in → addCheckin(location) → simpan ke AsyncStorage & update context.
  2. App load → loadCheckinsFromStorage() → context update dari AsyncStorage.
  3. User clear → clearCheckins() → hapus AsyncStorage & reset context.

## 5. Data Flow Umum
- **Login:**
  1. User input username/password → validasi → request token ke API → simpan token/userInfo ke context & SecureStore.
- **Check-in:**
  1. User tekan check-in → validasi izin lokasi → ambil lokasi → simpan ke AsyncStorage & context.
- **Komentar:**
  1. User input komentar → validasi → simpan ke state/context/AsyncStorage jika diperlukan.

## 6. Catatan
- Semua context provider membungkus komponen utama di `App.js`.
- Data yang disimpan di AsyncStorage/SecureStore selalu di-load ulang saat app start.
- Error handling dan notifikasi user sudah diperbaiki di fitur utama.

---

**Update dokumentasi ini jika ada perubahan besar pada flow data atau context!**
