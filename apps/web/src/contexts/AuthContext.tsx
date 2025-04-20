// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

interface AuthContextType {
  user: { uid: string; isAnonymous: boolean } | null;
  userUid: string | null;
  playerName: string;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  updatePlayerName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<{
    uid: string;
    isAnonymous: boolean;
  } | null>(null);
  const [playerName, setPlayerName] = useState<string>("");
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

  // Generate a unique default player name with random numbers
  const generateDefaultPlayerName = (): string => {
    // Generate a random 4-digit number
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `Player ${randomNum}`;
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

        // Check for saved player name
        if (typeof window !== "undefined") {
          const savedName = localStorage.getItem("tg_player_name");
          if (savedName) {
            setPlayerName(savedName);
          } else {
            // Generate a new default name with random numbers and save it
            const defaultName = generateDefaultPlayerName();
            setPlayerName(defaultName);
            localStorage.setItem("tg_player_name", defaultName);
          }
        }

        console.log("User authenticated:", userId);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing auth:", error);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Update player name - now allows empty strings during editing
  const updatePlayerName = (name: string) => {
    setPlayerName(name);

    // Only save non-empty names to localStorage
    if (name.trim()) {
      // Save to localStorage for persistence
      if (typeof window !== "undefined") {
        localStorage.setItem("tg_player_name", name);

        // If we have a user, also update any existing player data
        if (user && user.uid) {
          try {
            // Update player data in localStorage
            const playerDataKey = `tg_player_${user.uid}`;
            const playerDataStr = localStorage.getItem(playerDataKey);

            if (playerDataStr) {
              const playerData = JSON.parse(playerDataStr);
              playerData.name = name;
              localStorage.setItem(playerDataKey, JSON.stringify(playerData));
            } else {
              // Create new player data
              localStorage.setItem(
                playerDataKey,
                JSON.stringify({
                  uid: user.uid,
                  name: name,
                  score: 0,
                })
              );
            }

            console.log(
              `Player name updated to "${name}" for user ${user.uid}`
            );
          } catch (e) {
            console.error("Error updating player data:", e);
          }
        }
      }
    }
  };

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

      // Generate a unique player name for this new user
      const defaultName = generateDefaultPlayerName();
      setPlayerName(defaultName);
      localStorage.setItem("tg_player_name", defaultName);

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

      // Generate a new default player name
      const defaultName = generateDefaultPlayerName();
      setPlayerName(defaultName);
      localStorage.setItem("tg_player_name", defaultName);

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
        playerName,
        loading,
        signInAnonymously,
        signOut,
        updatePlayerName,
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
