// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

interface AuthContextType {
  user: { uid: string; isAnonymous: boolean } | null;
  userUid: string | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<{ uid: string; isAnonymous: boolean } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Generate a stable user ID that persists across app sessions
  const generateUserId = (): string => {
    // First, try to get an existing user ID from localStorage for persistence
    if (typeof window !== "undefined") {
      const existingId = localStorage.getItem("user_uid");
      if (existingId) {
        return existingId;
      }

      // If no existing ID, generate a new one
      const newId = uuidv4();

      // Store it in localStorage for future use
      localStorage.setItem("user_uid", newId);
      
      // Also store in sessionStorage for other components
      sessionStorage.setItem("mock_user_uid", newId);

      return newId;
    }

    // Fallback for SSR
    return uuidv4();
  };

  // Initialize auth
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        
        // Check for existing user ID in localStorage
        const userId = generateUserId();
        
        // Set up user with the ID
        setUser({ uid: userId, isAnonymous: true });
        
        console.log("User authenticated:", userId);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing auth:", error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Sign in anonymously
  const signInAnonymously = async () => {
    try {
      setLoading(true);
      
      // Generate a new UUID for anonymous user
      const newUserId = uuidv4();
      
      // Store in localStorage
      localStorage.setItem("user_uid", newUserId);
      
      // Also store in sessionStorage for other components
      sessionStorage.setItem("mock_user_uid", newUserId);
      
      // Update state
      setUser({ uid: newUserId, isAnonymous: true });
      
      console.log("Anonymous user signed in:", newUserId);
      setLoading(false);
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      setLoading(false);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      
      // Remove user ID from localStorage
      localStorage.removeItem("user_uid");
      
      // Remove from sessionStorage too
      sessionStorage.removeItem("mock_user_uid");
      
      // Clear user state
      setUser(null);
      
      console.log("User signed out");
      setLoading(false);
    } catch (error) {
      console.error("Error signing out:", error);
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userUid: user ? user.uid : null,
        loading,
        signInAnonymously,
        signOut,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;