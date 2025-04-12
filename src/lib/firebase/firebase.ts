// src/lib/firebase.ts
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { getPerformance, FirebasePerformance } from 'firebase/performance';

const firebaseConfig = {
  apiKey: "AIzaSyAbIQ8B30KkE3CiVZ-6nNGAwiAz2Q5url8",
  authDomain: "trendguesser-332d4.firebaseapp.com",
  projectId: "trendguesser-332d4",
  storageBucket: "trendguesser-332d4.firebasestorage.app",
  messagingSenderId: "748886157474",
  appId: "1:748886157474:web:08ba697d25f6ec0b228ffb",
  measurementId: "G-BEQ3HXTMS3"
};

// Initialize Firebase based on consent
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | null = null;
const performance: FirebasePerformance | null = null;

// Lazy initialization function to be called after consent is given
export const initializeFirebase = (firebaseConsent = false, analyticsConsent = false) => {
  // Initialize core Firebase if not already done
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    // Connect to emulators if in development mode
    if (typeof window !== 'undefined' && 
        window.location.hostname === 'localhost' && 
        process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
      console.log("Connecting to Firebase Auth emulator");
      const { connectAuthEmulator } = require('firebase/auth');
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      
      const { connectFirestoreEmulator } = require('firebase/firestore');
      db = getFirestore(app);
      connectFirestoreEmulator(db, 'localhost', 8080);
    } else {
      db = getFirestore(app);
    }
  } else {
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  }

  // Only initialize analytics if consent is given and we're in browser
  if (analyticsConsent && typeof window !== 'undefined') {
    isSupported().then(yes => {
      if (yes) {
        analytics = getAnalytics(app);
      }
    });
  }

  return {
    app,
    auth,
    db,
    analytics,
    performance
  };
};

// Default export for backward compatibility
export { app, auth, db, analytics, performance };