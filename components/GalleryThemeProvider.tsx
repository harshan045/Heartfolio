import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Colors } from '../constants/theme';

type ThemeType = 'light' | 'dark';

interface GalleryThemeContextType {
  theme: ThemeType;
  colors: typeof Colors.light;
  toggleTheme: () => void;
}

const GalleryThemeContext = createContext<GalleryThemeContextType | undefined>(undefined);

export const GalleryThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeType>('light');

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem('gallery_theme');
        if (t === 'dark' || t === 'light') setTheme(t as ThemeType);
      } catch (e) {
        console.error('Failed to load gallery theme', e);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem('gallery_theme', newTheme);
    } catch (e) {
      console.error('Failed to save gallery theme', e);
    }
  };

  const colors = Colors[theme];

  return (
    <GalleryThemeContext.Provider value={{ theme, colors, toggleTheme }}>
      {children}
    </GalleryThemeContext.Provider>
  );
};

export const useGalleryTheme = () => {
  const ctx = useContext(GalleryThemeContext);
  if (!ctx) throw new Error('useGalleryTheme must be used within GalleryThemeProvider');
  return ctx;
};

export default GalleryThemeProvider;
