// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  getAuth,
} from "firebase/auth";
import { initializeFirebase, auth as firebaseAuth } from "../lib/firebase/firebase";
import { AuthContextType } from "../types";

// Create the Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // We don't need to initialize Firebase in AuthContext
  // as it's already initialized in _app.tsx
  useEffect(() => {
    console.log("AuthContext mounted");
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // If mock mode is enabled, skip Firebase auth
    if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
      console.log("Skipping Firebase auth in mock mode");
      // Set a mock user and mark as loaded
      const mockUid = 'mock-' + Math.random().toString(36).substring(2, 11);
      
      // Store the mock user ID in sessionStorage for use across components
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('mock_user_uid', mockUid);
        console.log('Stored mock user ID in session storage:', mockUid);
      }
      
      setUser({ uid: mockUid } as User);
      setUserUid(mockUid);
      setLoading(false);
      return () => {};
    }
    
    try {
      // Make sure Firebase is initialized
      const firebaseApp = initializeFirebase(true, false);
      // Use the auth instance from the initialized Firebase
      const auth = firebaseApp.auth;
      
      if (!auth) {
        console.error("Firebase auth is not initialized");
        return;
      }
      
      console.log("Setting up auth state listener");
      const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
        console.log("Auth state changed:", authUser ? `User: ${authUser.uid}` : "No user");
        
        if (authUser) {
          setUser(authUser);
          setUserUid(authUser.uid);
        
          try {
            // Initialize Firebase
            const { db } = initializeFirebase(true, false);
            
            // Check if user exists in Firestore, create if not
            if (db) {
              const { doc, getDoc, setDoc } = await import('firebase/firestore');
              const userRef = doc(db, 'players', authUser.uid);
              const userDoc = await getDoc(userRef);
              
              if (!userDoc.exists()) {
                // Create new user document
                await setDoc(userRef, {
                  uid: authUser.uid,
                  name: `Player_${authUser.uid.substring(0, 5)}`,
                  createdAt: new Date(),
                  highScores: {}
                });
                console.log("Created new user document in Firestore");
              }
            }
          } catch (error) {
            console.error('Error checking/creating user document:', error);
          }
        } else {
          setUser(null);
          setUserUid(null);
        }
        
        setLoading(false);
      });

      // Cleanup subscription
      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up auth state listener:", error);
      
      // Fallback to mock user if Firebase auth fails
      const mockUid = 'error-' + Math.random().toString(36).substring(2, 11);
      setUser({ uid: mockUid } as User);
      setUserUid(mockUid);
      setLoading(false);
      return () => {};
    }
  }, []);

  // Sign in anonymously
  const signInAnonymously = async () => {
    try {
      // Skip anonymous auth if it's not setup correctly to avoid errors
      if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
        console.log("Skipping anonymous auth (NEXT_PUBLIC_SKIP_AUTH=true)");
        // Mock a user instead
        const mockUid = 'temp-' + Math.random().toString(36).substring(2, 11);
        setUser({ uid: mockUid } as User);
        setUserUid(mockUid);
        setLoading(false);
        return;
      }
      
      // Make sure Firebase is initialized
      const firebaseApp = initializeFirebase(true, false);
      const auth = firebaseApp.auth;
      
      if (!auth) {
        throw new Error("Firebase auth is not initialized");
      }
      
      console.log("Attempting anonymous sign in");
      await firebaseSignInAnonymously(auth);
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      
      // If anonymous auth fails, mock a user to allow the app to function
      console.log("Auth failed, creating temporary user");
      const mockUid = 'temp-' + Math.random().toString(36).substring(2, 11);
      setUser({ uid: mockUid } as User);
      setUserUid(mockUid);
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      // If in mock mode, just clear the user state
      if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
        setUser(null);
        setUserUid(null);
        return;
      }
      
      // Make sure Firebase is initialized
      const firebaseApp = initializeFirebase(true, false);
      const auth = firebaseApp.auth;
      
      if (!auth) {
        throw new Error("Firebase auth is not initialized");
      }
      
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      // Reset user state regardless of error
      setUser(null);
      setUserUid(null);
    }
  };

  // Auto sign in anonymously if not signed in
  useEffect(() => {
    // Check if Firebase emulator is running
    const isEmulator = typeof window !== 'undefined' && 
      window.location.hostname === 'localhost' && 
      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
      
    if (!loading && !user) {
      console.log("Auto sign-in: No user detected, attempting anonymous sign in");
      if (isEmulator) {
        console.log("Using Firebase emulator for authentication");
      }
      signInAnonymously();
    }
  }, [loading, user]);

  // Context value
  const value: AuthContextType = {
    user,
    userUid,
    loading,
    signInAnonymously,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
