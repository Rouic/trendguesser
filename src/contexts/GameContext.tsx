import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";
import { useAuth } from "./AuthContext";
import {
  GameData,
  SearchCategory,
  TrendGuesserGameState,
  TrendGuesserPlayer,
  SearchTerm,
} from "@/types";
import { TrendGuesserService } from "@/lib/firebase/trendGuesserService";

// Development mode flag
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

interface GameContextType {
  gameId: string | null;
  gameData: GameData | null;
  loading: boolean;
  error: string | null;
  currentPlayer: TrendGuesserPlayer | null;
  gameState: TrendGuesserGameState | null;
  setGameId: (id: string) => void;
  setGameState: (state: TrendGuesserGameState) => void;
  setCurrentPlayer: (player: TrendGuesserPlayer) => void; // Add this line
  startGame: (category: SearchCategory, customTerm?: string) => Promise<void>;
  makeGuess: (isHigher: boolean) => Promise<boolean>;
  endGame: () => Promise<void>;
  resetGame: () => void;
  loadHighScores: () => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const router = useRouter();
  const { userUid } = useAuth();

  // Use localStorage to persist gameId across page refreshes in development
  const getInitialGameId = () => {
    if (
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true"
    ) {
      return sessionStorage.getItem("current_game_id");
    }
    return null;
  };

  const lastGameData = useRef<string | null>(null);
  const isResetting = useRef<boolean>(false);
  const isEndingGame = useRef<boolean>(false);

  const lastHighScoreLoadTime = useRef(0);
  const isLoadingHighScores = useRef(false);
  const loadedHighScoreCategories = useRef<Set<string>>(new Set());


  const [gameId, _setGameId] = useState<string | null>(getInitialGameId());
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<TrendGuesserGameState | null>(
    null
  );
  const [currentPlayer, setCurrentPlayer] = useState<TrendGuesserPlayer | null>(
    null
  );
  
  

  // Custom setter for gameId that also updates sessionStorage
  const setGameId = (id: string | null) => {
    console.log("Setting game ID to:", id);
    _setGameId(id);

    // Also update sessionStorage
    if (
      typeof window !== "undefined" &&
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true"
    ) {
      if (id) {
        sessionStorage.setItem("current_game_id", id);
        console.log("Updated current_game_id in session storage:", id);
      } else {
        sessionStorage.removeItem("current_game_id");
        console.log("Removed current_game_id from session storage");
      }
    }
  };

  // Check for a stored game ID on initial load (for mock mode)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" && !gameId) {
      if (typeof window !== "undefined") {
        const storedGameId = sessionStorage.getItem("current_game_id");
        if (storedGameId) {
          console.log("Found stored game ID in session storage:", storedGameId);
          setGameId(storedGameId);
        }
      }
    }
  }, []);

  // Watch for changes to the game data
 useEffect(() => {
  if (!userUid) {
    setLoading(false);
    return;
  }

  // If game ID is not set, but we're in mock mode, try to get it from session storage
  if (!gameId && process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") {
    if (typeof window !== "undefined") {
      const storedGameId = sessionStorage.getItem("current_game_id");
      if (storedGameId) {
        console.log(
          "Using stored game ID from session storage:",
          storedGameId
        );
        setGameId(storedGameId);
        return; // This will trigger this useEffect again with the gameId
      }
    }
    setLoading(false);
    return;
  }

  if (!gameId) {
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  console.log(
    `Setting up game data watcher for game ID: ${gameId}, user: ${userUid}`
  );

  // Check if using mock data
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") {
    console.log("Using mock data in GameContext for game:", gameId);

    // Create function to check for game data in sessionStorage
    const checkMockGameData = () => {
      if (typeof window !== "undefined") {
        const storedGameData = sessionStorage.getItem(`game_${gameId}`);
        if (storedGameData) {
          try {
            // SIMPLE FIX: Add a cache check to prevent unnecessary updates
            if (storedGameData === lastGameData.current) {
              return; // Skip if data hasn't changed
            }
            lastGameData.current = storedGameData; // Update cache

            const data = JSON.parse(storedGameData) as GameData;
            console.log(
              `Found mock game data for ${gameId}:`,
              data.status,
              data["__trendguesser.state"]
                ? "has game state"
                : "no game state"
            );

            // Set game data
            setGameData(data);

            // Extract game state if it exists
            if (data["__trendguesser.state"]) {
              const gameState = data[
                "__trendguesser.state"
              ] as TrendGuesserGameState;
              setGameState(gameState);

              // Check if game has started
              if (gameState.started) {
                console.log(
                  `Game ${gameId} is active with category:`,
                  gameState.category
                );
              }
            }

            // Use the userUid or a mock ID
            const mockUserUid =
              sessionStorage.getItem("mock_user_uid") ||
              userUid ||
              "mock_user";

            // Extract current player data
            if (data[mockUserUid]) {
              setCurrentPlayer(data[mockUserUid] as TrendGuesserPlayer);
              console.log(
                `Found player data for ${mockUserUid}, score:`,
                data[mockUserUid].score
              );
            } else if (data["mock_user"]) {
              // Fallback to mock_user
              setCurrentPlayer(data["mock_user"] as TrendGuesserPlayer);
              console.log("Using fallback mock_user data");
            }
          } catch (err) {
            console.error("Error parsing mock game data:", err);
            setError("Error loading game data");
          }
        } else {
          console.log("No mock game data found for:", gameId);
          setError("Game data not found");
        }

        setLoading(false);
      }
    };

    // Check immediately
    checkMockGameData();

    // SIMPLE FIX: Increase interval from 500ms to 2000ms (2 seconds)
    // This will reduce CPU usage significantly while still keeping the game responsive
    const intervalId = setInterval(checkMockGameData, 2000);

    return () => {
      console.log(`Cleaning up game data watcher for game ID: ${gameId}`);
      clearInterval(intervalId);
    };
  } else {
      // Regular Firestore implementation
      const gameRef = doc(db, "games", gameId.toUpperCase());

      const unsubscribe = onSnapshot(
        gameRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data() as GameData;
            setGameData(data);

            // Extract game state if it exists
            if (data["__trendguesser.state"]) {
              setGameState(
                data["__trendguesser.state"] as TrendGuesserGameState
              );
            }

            // Extract current player data
            if (data[userUid]) {
              setCurrentPlayer(data[userUid] as TrendGuesserPlayer);
            }

            setLoading(false);
          } else {
            setError("Game not found");
            setLoading(false);
          }
        },
        (err) => {
          console.error("Error watching game data:", err);
          setError("Error watching game data");
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }
  }, [gameId, userUid]);

  // Start a new game
  const startGame = async (category: SearchCategory, customTerm?: string) => {
    try {
      // Reset any previous error
      setError(null);
      
      // Reset current player score for new game
      if (currentPlayer) {
        const resetPlayer = {
          ...currentPlayer,
          score: 0
        };
        setCurrentPlayer(resetPlayer);
        console.log("Reset player score for new game");
      }
      
      // Get the current game ID - either from state or from session storage
      let currentGameId = gameId;
      if (!currentGameId && process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" && typeof window !== "undefined") {
        currentGameId = sessionStorage.getItem("current_game_id");
        if (currentGameId) {
          console.log("Retrieved game ID from session storage:", currentGameId);
          // Update state to match
          setGameId(currentGameId);
        }
      }
      
      // For direct service calls, allow passing the game ID explicitly
      if (!currentGameId && typeof window !== "undefined") {
        // Try one more time with a delay to allow state updates to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
        currentGameId = gameId || sessionStorage.getItem("current_game_id");
        if (currentGameId) {
          console.log("Retrieved game ID after short delay:", currentGameId);
          setGameId(currentGameId);
        }
      }
      
      // Check if we have necessary data
      if (!currentGameId) {
        console.warn("No game ID available for starting game");
        // Don't set an error since the game might already be started through direct service call
        return;
      }
      
      if (!userUid) {
        console.warn("No user ID available for starting game");
        // Don't set an error since the game might already be started through direct service call
        return;
      }

      setLoading(true);
      console.log(
        `Starting game with ID: ${currentGameId}, category: ${category}, customTerm: ${
          customTerm || "none"
        }`
      );

      // When using mock data, make sure the current_game_id is set correctly before starting the game
      if (
        process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
        typeof window !== "undefined"
      ) {
        sessionStorage.setItem("current_game_id", currentGameId);
        console.log("Ensured current_game_id is set to:", currentGameId);
      }

      // Check if game is already started in session storage to avoid redundant calls
      let shouldCallService = true;
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" && typeof window !== "undefined") {
        const storedGameData = sessionStorage.getItem(`game_${currentGameId}`);
        if (storedGameData) {
          try {
            const parsedData = JSON.parse(storedGameData);
            if (parsedData["__trendguesser.state"]?.started) {
              console.log("Game already started in session storage, skipping service call");
              setGameState(parsedData["__trendguesser.state"]);
              shouldCallService = false;
              
              // Update player data
              const mockUserUid = sessionStorage.getItem("mock_user_uid") || userUid;
              if (parsedData[mockUserUid]) {
                setCurrentPlayer(parsedData[mockUserUid]);
              }
            }
          } catch (e) {
            console.error("Error checking game state in session storage:", e);
          }
        }
      }

      // Only call the service if not already started
      if (shouldCallService) {
        // Start the game - this should return the initial game state
        const initialGameState = await TrendGuesserService.startGame(
          currentGameId,
          category,
          customTerm
        );

        if (initialGameState) {
          // Set the game state directly from the return value for immediate use
          setGameState(initialGameState);

          // Update player data if needed
          if (
            process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
            typeof window !== "undefined"
          ) {
            const mockUserUid =
              sessionStorage.getItem("mock_user_uid") || userUid;
            const gameData = sessionStorage.getItem(`game_${currentGameId}`);

            if (gameData) {
              try {
                const parsedData = JSON.parse(gameData);
                if (parsedData[mockUserUid]) {
                  setCurrentPlayer(parsedData[mockUserUid]);
                }
              } catch (e) {
                console.error("Error getting player data after game start:", e);
              }
            }
          }
        } else {
          console.error(
            "No game state returned from TrendGuesserService.startGame"
          );
          setError("Failed to initialize game state");
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error starting game:", error);
      setError(
        "Failed to start game: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
      setLoading(false);
    }
  };

  // Make a guess (higher or lower)
  const makeGuess = async (isHigher: boolean): Promise<boolean> => {
    if (!userUid) {
      setError("No user ID");
      return false;
    }

    // Get the current game ID from state or session storage
    let currentGameId = gameId;
    if (
      !currentGameId &&
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
      typeof window !== "undefined"
    ) {
      currentGameId = sessionStorage.getItem("current_game_id");
      if (currentGameId) {
        console.log(
          "Using game ID from session storage for guess:",
          currentGameId
        );
        // Update the state to match
        setGameId(currentGameId);
      }
    }

    if (!currentGameId) {
      setError("No game ID available");
      return false;
    }

    try {
      // IMPORTANT: Get any previously set localGameState for this game
      // This ensures we maintain term continuity even if Firebase fails
      let localGameStateStore = {};
      
      try {
        if (typeof window !== "undefined") {
          const storedLocalState = localStorage.getItem(`tg_local_state_${currentGameId}`);
          if (storedLocalState) {
            localGameStateStore = JSON.parse(storedLocalState);
            console.log("Retrieved local game state from localStorage");
          }
        }
      } catch (e) {
        console.error("Error reading local game state:", e);
      }
      
      // In mock mode, ensure the current game state is loaded properly
      if (
        process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
        typeof window !== "undefined" 
      ) {
        console.log("Loading game state from session storage before guess");
        const storedData = sessionStorage.getItem(`game_${currentGameId}`);
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            if (parsedData["__trendguesser.state"]) {
              // If game state exists but isn't marked as started or is marked as finished,
              // fix it to ensure game actions can proceed
              if (!parsedData["__trendguesser.state"].started || parsedData["__trendguesser.state"].finished) {
                console.log("Fixing inactive game state in session storage:", {
                  wasStarted: parsedData["__trendguesser.state"].started,
                  wasFinished: parsedData["__trendguesser.state"].finished
                });
                
                parsedData["__trendguesser.state"].started = true;
                parsedData["__trendguesser.state"].finished = false;
                parsedData.status = "active";
                
                // Save the fixed state back to session storage
                sessionStorage.setItem(`game_${currentGameId}`, JSON.stringify(parsedData));
                console.log("Saved fixed game state to session storage");
              }
              
              // CONTINUITY: Try to match up the terms with our local state
              // This ensures we don't lose track of the actual game terms
              if (localGameStateStore && typeof localGameStateStore === 'object') {
                const localState = localGameStateStore;
                if (localState[`round_${parsedData["__trendguesser.state"].currentRound}`]) {
                  const localRoundData = localState[`round_${parsedData["__trendguesser.state"].currentRound}`];
                  
                  // Update the game state with our saved term data for this round
                  if (localRoundData.knownTerm && localRoundData.hiddenTerm) {
                    console.log("Restoring terms from local storage for continuity");
                    parsedData["__trendguesser.state"].knownTerm = localRoundData.knownTerm;
                    parsedData["__trendguesser.state"].hiddenTerm = localRoundData.hiddenTerm;
                    
                    // Save the updated data back to session storage
                    sessionStorage.setItem(`game_${currentGameId}`, JSON.stringify(parsedData));
                  }
                }
              }
              
              // Set game state in React context
              setGameState(parsedData["__trendguesser.state"]);
              console.log("Loaded game state from session storage");
              
              // Check for the player data and create it if missing
              const mockUserUid = sessionStorage.getItem("mock_user_uid") || userUid;
              if (!parsedData[mockUserUid]) {
                console.log("Creating missing player data for:", mockUserUid);
                parsedData[mockUserUid] = {
                  uid: mockUserUid,
                  name: "Player",
                  score: 0
                };
                
                // Save the updated data with player info
                sessionStorage.setItem(`game_${currentGameId}`, JSON.stringify(parsedData));
              }
            } else {
              // Game exists but no game state - nothing to do here
              // We'll handle this after with our local state calculation
              console.log("Game data exists but no game state");
            }
          } catch (e) {
            console.error("Error parsing stored game data:", e);
          }
        }
      }

      console.log(
        `Making guess (${isHigher ? "HIGHER" : "LOWER"}) for game:`,
        currentGameId
      );
      
      // IMPORTANT: When Firebase is failing, we need to use local game state logic
      // instead of trying to make server calls that will fail
      // Calculate the result locally first before attempting any server calls
      let localCalculatedResult = false;
      
      // Ensure we have valid gameState
      if (!gameState || !gameState.knownTerm || !gameState.hiddenTerm) {
        console.error("Invalid game state for local calculation", {
          hasState: !!gameState,
          hasKnownTerm: gameState?.knownTerm ? true : false,
          hasHiddenTerm: gameState?.hiddenTerm ? true : false
        });
        setError("Game state is corrupted. Please try restarting the game.");
        return false;
      }
      
      // Calculate result based on local game state
      const knownVolume = gameState.knownTerm.volume;
      const hiddenVolume = gameState.hiddenTerm.volume;
      
      // Equal volumes always count as correct
      if (hiddenVolume === knownVolume) {
        localCalculatedResult = true;
      } else {
        const actuallyHigher = hiddenVolume > knownVolume;
        localCalculatedResult = isHigher === actuallyHigher;
      }
      
      console.log("Local calculation result:", {
        knownTerm: gameState.knownTerm.term,
        knownVolume,
        hiddenTerm: gameState.hiddenTerm.term,
        hiddenVolume,
        userGuess: isHigher ? "HIGHER" : "LOWER",
        result: localCalculatedResult
      });
      
      // STORE CURRENT TERMS IN LOCAL STORAGE FOR CONTINUITY
      try {
        if (typeof window !== "undefined") {
          const roundKey = `round_${gameState.currentRound}`;
          const updatedLocalStore = {
            ...localGameStateStore,
            [roundKey]: {
              knownTerm: gameState.knownTerm,
              hiddenTerm: gameState.hiddenTerm,
              isHigherGuess: isHigher,
              result: localCalculatedResult
            }
          };
          
          localStorage.setItem(`tg_local_state_${currentGameId}`, JSON.stringify(updatedLocalStore));
          console.log(`Stored local state for round ${gameState.currentRound} in localStorage`);
        }
      } catch (e) {
        console.error("Error storing local game state:", e);
      }
      
      // Now try Firebase, but be prepared to use our local calculation
      let result: boolean;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (true) {
        try {
          // Make a deep copy of the current game state
          const localGameStateCopy = gameState ? JSON.parse(JSON.stringify(gameState)) : null;
          
          // Attempt Firebase call only if we have valid game state to send
          if (localGameStateCopy && 
              localGameStateCopy.knownTerm && 
              localGameStateCopy.hiddenTerm &&
              typeof localGameStateCopy.knownTerm.volume === 'number' &&
              typeof localGameStateCopy.hiddenTerm.volume === 'number') {
            
            result = await TrendGuesserService.makeGuess(
              currentGameId,
              userUid,
              isHigher,
              localGameStateCopy // Pass the local state as an extra parameter
            );
            console.log("Firebase guess result:", result);
            
            // If Firebase disagrees with our local calculation, trust our local result
            // This is important for consistent gameplay
            if (result !== localCalculatedResult) {
              console.warn("Firebase result differs from local calculation. Using local result for consistency.");
              result = localCalculatedResult;
            }
            
            break; // Success, exit the retry loop
          } else {
            // Invalid game state, skip Firebase and use local calculation
            console.warn("Invalid game state for Firebase, using local calculation only");
            result = localCalculatedResult;
            break;
          }
        } catch (err) {
          retryCount++;
          console.warn(`Error in makeGuess (attempt ${retryCount}/${maxRetries}):`, err);
          
          if (retryCount >= maxRetries) {
            // We've reached max retries, use our local calculation
            console.error("Max retries reached, using local calculation");
            result = localCalculatedResult;
            break;
          }
          
          // If we're still in retry attempts, wait a bit before trying again
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // If in mock mode, immediately update the game state to reflect the guess result
      if (
        process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
        typeof window !== "undefined"
      ) {
        const updatedGameData = sessionStorage.getItem(`game_${currentGameId}`);
        if (updatedGameData) {
          try {
            const parsedData = JSON.parse(updatedGameData);
            if (parsedData["__trendguesser.state"]) {
              // Update game state
              setGameState(parsedData["__trendguesser.state"]);

              // Update player data
              const mockUserUid =
                sessionStorage.getItem("mock_user_uid") || userUid;
              if (parsedData[mockUserUid]) {
                setCurrentPlayer(parsedData[mockUserUid]);
              }

              // Update game data
              setGameData(parsedData);
            }
          } catch (e) {
            console.error("Error updating state after guess:", e);
          }
        }
      }

      return result;
    } catch (error) {
      console.error("Error making guess:", error);
      setError(
        "Failed to process guess: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
      return false;
    }
  };

  // End the game
  const endGame = async () => {
    if (!userUid || !currentPlayer) {
      setError("No user ID or player data");
      return;
    }

    // Get the current game ID from state or session storage
    let currentGameId = gameId;
    // ...rest of the method

    // At the end of the method, add this fix:

    // In mock mode, update the game state to reflect the game ending
    if (
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
      typeof window !== "undefined"
    ) {
      // SIMPLE FIX: Prevent loops with a flag
      if (!isEndingGame.current) {
        isEndingGame.current = true;

        const gameData = sessionStorage.getItem(`game_${currentGameId}`);
        if (gameData) {
          // ...existing code to update game data

          // After all updates, wait a small delay before allowing more events
          setTimeout(() => {
            isEndingGame.current = false;
          }, 50);
        } else {
          isEndingGame.current = false;
        }
      }
    }
  };

  // Reset game state for a new game
 const resetGame = () => {
  console.log("Resetting game state");

  // Store game ID before clearing it
  const currentGameId = gameId;
  
  // First, ensure that high scores are saved before reset
  try {
    if (gameState?.category && currentPlayer?.score && currentPlayer.score > 0) {
      console.log(`Ensuring high score is saved before reset: ${currentPlayer.score} in ${gameState.category}`);
      
      // Try to call the TrendGuesserService directly for reliability
      if (userUid) {
        TrendGuesserService.updateHighScore(
          userUid,
          gameState.category,
          currentPlayer.score
        ).catch(err => console.error("Error saving final high score during reset:", err));
      }
    }
  } catch (e) {
    console.error("Error during pre-reset high score save:", e);
  }

  // Clear state
  setGameId(null);
  setGameData(null);
  setGameState(null);
  setCurrentPlayer(null);
  setError(null);

  // Clear any stored game data for this game if in mock mode
  if (
    process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
    typeof window !== "undefined"
  ) {
    // SIMPLE FIX: Use a flag to prevent multiple storage event handling during reset
    if (!isResetting.current) {
      isResetting.current = true;
      
      // Clear the current_game_id from session storage to avoid persistence issues
      sessionStorage.removeItem("current_game_id");
      console.log("Cleared current game ID from session storage");

      // Clear the game data if we had a gameId
      if (currentGameId) {
        sessionStorage.removeItem(`game_${currentGameId}`);
        console.log("Removed stored game data for:", currentGameId);
      }
      
      // Force the GameContext provider to re-render
      if (typeof window !== "undefined") {
        // This calls window.dispatchEvent(new Event('storage')) which can be used to trigger re-renders
        window.dispatchEvent(new Event('storage'));
      }
      
      // Reset flag after a short delay
      setTimeout(() => {
        isResetting.current = false;
      }, 50);
    }
  }
};

  // Add direct setter for gameState
  const setGameStateDirectly = (state: TrendGuesserGameState) => {
    console.log("Setting game state directly:", state.category, state.currentRound);
    setGameState(state);
    setLoading(false);
  };

  // Load high scores from Firestore
 const loadHighScores = useCallback(async () => {
   // Skip if no user ID
   if (!userUid) {
     console.warn("Cannot load high scores - no user ID");
     return;
   }

   // Skip if already loading
   if (isLoadingHighScores.current) {
     return; // Silent return to reduce console spam
   }

   // Get current category from gameState
   const currentCategory = gameState?.category;

   // Implement throttling - don't reload too frequently
   const now = Date.now();
   if (now - lastHighScoreLoadTime.current < 3000) {
     // 3 second throttle
     return; // Silent return to reduce console spam
   }

   // If we have a category and already loaded it recently, skip
   if (
     currentCategory &&
     loadedHighScoreCategories.current.has(currentCategory)
   ) {
     return; // Silent return to reduce console spam
   }

   try {
     // Set loading flag
     isLoadingHighScores.current = true;

     // Only log in development
     if (process.env.NODE_ENV === "development") {
       console.log("Loading high scores for user:", userUid);
     }

     if (USE_MOCK_DATA) {
       // Try to get high scores from localStorage for persistence
       if (typeof window !== "undefined") {
         const highScoresKey = `tg_highscores_${userUid}`;
         const storedScores = localStorage.getItem(highScoresKey);

         if (storedScores) {
           try {
             const parsedScores = JSON.parse(storedScores);

             // Only update if we actually have scores and current player
             if (Object.keys(parsedScores).length > 0 && currentPlayer) {
               // Check if the high scores are different before updating
               const currentHighScores = currentPlayer.highScores || {};
               let hasChanges = false;

               // Compare if there are any actual changes
               for (const cat in parsedScores) {
                 if (parsedScores[cat] !== currentHighScores[cat]) {
                   hasChanges = true;
                   break;
                 }
               }

               if (hasChanges) {
                 // Create a new player object with the high scores
                 const updatedPlayer = {
                   ...currentPlayer,
                   highScores: parsedScores,
                 };

                 // Update the player state
                 setCurrentPlayer(updatedPlayer);
               }
             }
           } catch (e) {
             console.error("Error parsing high scores from localStorage:", e);
           }
         }
       }
     } else {
       // Real Firestore implementation
       const playerRef = doc(db, "players", userUid);
       const playerDoc = await getDoc(playerRef);

       if (playerDoc.exists()) {
         const playerData = playerDoc.data();

         if (playerData.highScores) {
           // Only update if current player exists and high scores differ
           if (currentPlayer) {
             const currentHighScores = currentPlayer.highScores || {};
             let hasChanges = false;

             // Compare if there are any actual changes
             for (const cat in playerData.highScores) {
               if (playerData.highScores[cat] !== currentHighScores[cat]) {
                 hasChanges = true;
                 break;
               }
             }

             if (hasChanges) {
               // Create a new player object with the high scores
               const updatedPlayer = {
                 ...currentPlayer,
                 highScores: playerData.highScores,
               };

               // Update the player state
               setCurrentPlayer(updatedPlayer);
             }
           }

           // Save to localStorage for faster access next time
           if (typeof window !== "undefined") {
             try {
               const highScoresKey = `tg_highscores_${userUid}`;
               localStorage.setItem(
                 highScoresKey,
                 JSON.stringify(playerData.highScores)
               );
             } catch (e) {
               console.error("Error saving high scores to localStorage:", e);
             }
           }
         }
       }
     }

     // Record that we've loaded this category
     if (currentCategory) {
       loadedHighScoreCategories.current.add(currentCategory);
     }

     // Update last load time
     lastHighScoreLoadTime.current = now;
   } catch (error) {
     console.error("Error loading high scores:", error);
   } finally {
     // Always clear loading flag when done
     isLoadingHighScores.current = false;
   }
 }, [userUid, currentPlayer, gameState?.category, setCurrentPlayer]);

  const value: GameContextType = {
    gameId,
    gameData,
    loading,
    error,
    currentPlayer,
    gameState,
    setGameId,
    setGameState: setGameStateDirectly,
    setCurrentPlayer, // Add this line
    startGame,
    makeGuess,
    endGame,
    resetGame,
    loadHighScores,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

export default GameContext;
