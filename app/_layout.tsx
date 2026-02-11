import { IndieFlower_400Regular } from "@expo-google-fonts/indie-flower";
import { PatrickHand_400Regular } from "@expo-google-fonts/patrick-hand";
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from "expo-font";
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet as RNStyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { auth } from '../firebaseConfig';
import AuthScreen from '../screens/AuthScreen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    PatrickHand_400Regular,
    IndieFlower_400Regular,
  });

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Set a timeout to prevent indefinite loading (5 seconds)
    const timeout = setTimeout(() => {
      console.log('Auth check timeout - proceeding without auth');
      setAuthLoading(false);
    }, 5000);

    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        console.log('Auth state changed:', currentUser ? 'User logged in' : 'No user');
        clearTimeout(timeout);
        setUser(currentUser);
        setAuthLoading(false);
      },
      (error) => {
        console.error('Auth state error:', error);
        clearTimeout(timeout);
        setAuthLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [loaded, authLoading]);

  if (!loaded || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6b9d" />
      </View>
    );
  }

  // If user is not logged in, show AuthScreen
  if (!user) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthScreen />
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  // If user is logged in, show your existing app navigation
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="diary-page" options={{ headerShown: false, title: 'Diary Page' }} />
        <Stack.Screen name="polaroid" options={{ headerShown: false, title: 'Polaroid' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = RNStyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
