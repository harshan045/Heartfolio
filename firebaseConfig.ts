import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
// @ts-ignore - getReactNativePersistence is available in React Native builds


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


export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
