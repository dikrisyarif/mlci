import React, { createContext, useContext } from 'react';

const ApiContext = createContext();

export const ApiProvider = ({ children }) => {
  const login = async (username, password) => {
    try {
      const response = await fetch('https://your-api-url.com/login', { // Ganti dengan URL API Anda
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed! Please check your credentials.');
      }

      const data = await response.json();
      return data; // Kembalikan data pengguna
    } catch (error) {
      throw error; // Lempar error untuk ditangani di komponen yang memanggil
    }
  };

  const getUserData = async (token) => { // Pastikan nama fungsi ini konsisten
    try {
      const response = await fetch('https://your-api-url.com/userdata', { // Ganti dengan URL API Anda
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`, // Sertakan token dalam header
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data.');
      }

      const data = await response.json();
      return data; // Kembalikan data pengguna
    } catch (error) {
      throw error; // Lempar error untuk ditangani di komponen yang memanggil
    }
  };

  return (
    <ApiContext.Provider value={{ login, getUserData }}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = () => useContext(ApiContext);