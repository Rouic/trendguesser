// src/lib/firebase.ts
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { getPerformance, FirebasePerformance } from 'firebase/performance';

const firebaseConfig = {
  apiKey: "AIzaSyC18HxW9nK5aYz0BMPTEsRQUl8FvGwRGJM",
  authDomain: "trendguesser-app.firebaseapp.com",
  projectId: "trendguesser-app",
  storageBucket: "trendguesser-app.appspot.com",
  messagingSenderId: "276589395759",
  appId: "1:276589395759:web:3a95fc5e71178a86c34825",
  measurementId: "G-TNLY6X1TBG"
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
    db = getFirestore(app);
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