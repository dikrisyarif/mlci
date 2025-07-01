import React, { createContext, useState, useContext } from 'react';

const ThemeContext = createContext();

const COLORS = {
  light: {
    background: '#FFFFFF',
    text: '#000000',
    button: '#007bff', // Warna tombol untuk tema terang 
    buttonborder: '#FFFFFF',
    textsecond: 'grey',
    textblue: '#007bff',
  },
  dark: {
    background: '#000000',
    text: '#FFFFFF',
    button: '#000000', // Warna tombol untuk tema gelap
    buttonborder: '#f28404',
    textsecond: 'grey',
    textblue: '#007bff',
  },
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light'); // Default ke tema terang

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors: COLORS[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return useContext(ThemeContext);
};