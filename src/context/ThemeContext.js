import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getColors } from '../constants/theme';

const STORAGE_KEY = '@malaw_dark_mode';

const ThemeContext = createContext({
  isDark: false,
  toggleTheme: () => {},
  Colors: getColors(false),
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (value !== null) setIsDark(value === 'true');
    });
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, Colors: getColors(isDark) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  return useContext(ThemeContext).Colors;
}
