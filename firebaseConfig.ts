import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// @ts-ignore - getReactNativePersistence is available in React Native builds
import { getReactNativePersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAEwAc4IMtwzioipaggKAihttg0PzeqSeI",
  authDomain: "heartfolio-045.firebaseapp.com",
  projectId: "heartfolio-045",
  storageBucket: "heartfolio-045.firebasestorage.app",
  messagingSenderId: "584388941681",
  appId: "1:584388941681:web:4c35c2c15ebe06210308d0",
  measurementId: "G-3XY5BEWSZK"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);
