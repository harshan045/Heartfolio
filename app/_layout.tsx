import { IndieFlower_400Regular } from "@expo-google-fonts/indie-flower";
import { PatrickHand_400Regular } from "@expo-google-fonts/patrick-hand";
import { useFonts } from "expo-font";
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet as RNStyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ThemeProvider } from '../components/ThemeContext';
import { auth } from '../firebaseConfig';
import AuthScreen from '../screens/AuthScreen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [loaded] = useFonts({
    PatrickHand_400Regular,
    IndieFlower_400Regular,
  });

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(
    auth,
    (currentUser) => {
      console.log("AUTH CALLBACK FIRED");
      console.log("USER:", currentUser?.email);

      setUser(currentUser);
      setAuthLoading(false);
    },
    (error) => {
      console.error("AUTH ERROR:", error);
      setAuthLoading(false);
    }
  );

  return unsubscribe;
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
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthScreen />
          <StatusBar style="auto" />
        </GestureHandlerRootView>
      </ThemeProvider>
    );
  }

  // If user is logged in, show your existing app navigation
  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="diary-page" options={{ headerShown: false, title: 'Diary Page' }} />
          <Stack.Screen name="polaroid" options={{ headerShown: false, title: 'Polaroid' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
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
