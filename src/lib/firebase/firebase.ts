// src/lib/firebase.ts
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
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
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let analytics: Analytics | null = null;
let performance: FirebasePerformance | null = null;
let isInitialized = false;

// Lazy initialization function to be called after consent is given
export const initializeFirebase = (firebaseConsent = false, analyticsConsent = false) => {
  // Return existing Firebase instance if already initialized
  if (isInitialized && app) {
    return {
      app,
      auth,
      db,
      analytics,
      performance
    };
  }
  
  // Initialize core Firebase
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    // Get Auth and Firestore instances
    if (app) {
      auth = getAuth(app);
      db = getFirestore(app);
      
      // Connect to emulators if in development mode
      if (typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && 
          process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
        
        // Add a global flag to indicate we're using emulators
        if (typeof window !== 'undefined') {
          window.__USING_FIREBASE_EMULATOR = true;
        }
        
        try {
          if (auth) {
            console.log("Connecting to Firebase Auth emulator");
            connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
          }
          
          if (db) {
            console.log("Connecting to Firestore emulator");
            connectFirestoreEmulator(db, 'localhost', 8080);
          }
          
          console.log("✓ Successfully connected to Firebase emulators");
        } catch (err) {
          console.error("Failed to connect to Firebase emulators:", err);
          console.log("⚠️ Fallback to mock data mode");
        }
      } else if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
        console.log("Using mock data mode (Firebase emulators not enabled)");
      }
    }
    
    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }

  // Only initialize analytics if consent is given and we're in browser
  if (analyticsConsent && typeof window !== 'undefined' && app) {
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