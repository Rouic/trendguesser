import React, { createContext, useContext, useState, useEffect } from "react";
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

      // Set up interval to check for changes (simulating Firestore's onSnapshot)
      const intervalId = setInterval(checkMockGameData, 500);

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
            } else if (parsedData.id) {
              // Game data exists but no game state - create a minimal game state
              console.log("Game data exists but no game state - creating default state");
              
              // Create a default game state with proper SearchCategory type
              const defaultState: TrendGuesserGameState = {
                currentRound: 1,
                category: "technology" as SearchCategory,
                started: true,
                finished: false,
                knownTerm: { 
                  term: "Default Term 1", 
                  volume: 100, 
                  id: "default-1", 
                  category: "technology" as SearchCategory,
                  imageUrl: "https://via.placeholder.com/800x600?text=Default+Term+1",
                },
                hiddenTerm: { 
                  term: "Default Term 2", 
                  volume: 200, 
                  id: "default-2", 
                  category: "technology" as SearchCategory,
                  imageUrl: "https://via.placeholder.com/800x600?text=Default+Term+2", 
                },
                usedTerms: ["default-1", "default-2"],
                terms: [],
                customTerm: null
              };
              
              // Set the default state
              parsedData["__trendguesser.state"] = defaultState;
              parsedData.status = "active";
              
              // Make sure createdAt exists
              if (!parsedData.createdAt) {
                parsedData.createdAt = Timestamp.now();
              }
              
              // Create player data if missing
              const mockUserUid = sessionStorage.getItem("mock_user_uid") || userUid;
              if (!parsedData[mockUserUid]) {
                parsedData[mockUserUid] = {
                  uid: mockUserUid,
                  name: "Player",
                  score: 0
                };
              }
              
              // Save the updated data
              sessionStorage.setItem(`game_${currentGameId}`, JSON.stringify(parsedData));
              
              // Update React state
              setGameState(defaultState);
              setGameData(parsedData as GameData);
              setCurrentPlayer(parsedData[mockUserUid]);
              console.log("Created and loaded default game state");
            }
          } catch (e) {
            console.error("Error parsing stored game data:", e);
          }
        } else {
          // No stored game data for this ID - create a minimal game data object
          console.log("No game data found in session storage, creating minimal game data");
          
          // Create a default game state with proper SearchCategory type
          const defaultState: TrendGuesserGameState = {
            currentRound: 1,
            category: "technology" as SearchCategory,
            started: true,
            finished: false,
            knownTerm: { 
              term: "Default Term 1", 
              volume: 100, 
              id: "default-1", 
              category: "technology" as SearchCategory,
              imageUrl: "https://via.placeholder.com/800x600?text=Default+Term+1",
            },
            hiddenTerm: { 
              term: "Default Term 2", 
              volume: 200, 
              id: "default-2", 
              category: "technology" as SearchCategory, 
              imageUrl: "https://via.placeholder.com/800x600?text=Default+Term+2",
            },
            usedTerms: ["default-1", "default-2"],
            terms: [],
            customTerm: null
          };
          
          // Create minimal game data
          const mockUserUid = sessionStorage.getItem("mock_user_uid") || userUid;
          const minimalGameData = {
            id: currentGameId,
            status: "active",
            gameType: "trendguesser",
            createdBy: mockUserUid,
            createdAt: Timestamp.now(), // Add createdAt field
            "__trendguesser.state": defaultState,
            [mockUserUid]: {
              uid: mockUserUid,
              name: "Player",
              score: 0
            }
          } as GameData;
          
          // Save to session storage
          sessionStorage.setItem(`game_${currentGameId}`, JSON.stringify(minimalGameData));
          
          // Update React state
          setGameState(defaultState);
          setGameData(minimalGameData);
          setCurrentPlayer(minimalGameData[mockUserUid]);
          console.log("Created minimal game data with default state");
        }
      }

      console.log(
        `Making guess (${isHigher ? "HIGHER" : "LOWER"}) for game:`,
        currentGameId
      );
      
      // Make the guess with enhanced retry logic
      let result: boolean;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (true) {
        try {
          // Attempt to make the guess via Firebase service
          result = await TrendGuesserService.makeGuess(
            currentGameId,
            userUid,
            isHigher
          );
          console.log("Guess result:", result);
          break; // Success, exit the retry loop
        } catch (err) {
          retryCount++;
          console.warn(`Error in makeGuess (attempt ${retryCount}/${maxRetries}):`, err);
          
          if (retryCount >= maxRetries) {
            // We've reached max retries, let's calculate the result locally instead
            console.error("Max retries reached, falling back to local calculation");
            
            if (gameState) {
              // Calculate result based on local game state
              const knownVolume = gameState.knownTerm?.volume || 0;
              const hiddenVolume = gameState.hiddenTerm?.volume || 0;
              
              // Equal volumes always count as correct
              if (hiddenVolume === knownVolume) {
                result = true;
              } else {
                const actuallyHigher = hiddenVolume > knownVolume;
                result = isHigher === actuallyHigher;
              }
              
              console.log("Locally calculated result:", result);
              break; // Exit the retry loop with our local result
            } else {
              // No game state available, can't calculate locally
              throw new Error("Cannot make guess: game state unavailable");
            }
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
    if (
      !currentGameId &&
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
      typeof window !== "undefined"
    ) {
      currentGameId = sessionStorage.getItem("current_game_id");
      if (currentGameId) {
        console.log(
          "Using game ID from session storage for ending game:",
          currentGameId
        );
      }
    }

    if (!currentGameId) {
      console.warn(
        "No game ID available for ending game, will still proceed with reset"
      );
      return;
    }

    try {
      console.log(
        "Ending game:",
        currentGameId,
        "with score:",
        currentPlayer.score || 0
      );
      await TrendGuesserService.endGame(
        currentGameId,
        userUid,
        currentPlayer.score || 0
      );

      // In mock mode, update the game state to reflect the game ending
      if (
        process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
        typeof window !== "undefined"
      ) {
        const gameData = sessionStorage.getItem(`game_${currentGameId}`);
        if (gameData) {
          try {
            const parsedData = JSON.parse(gameData);
            if (parsedData["__trendguesser.state"]) {
              parsedData["__trendguesser.state"].finished = true;
              parsedData.status = "finished";
              sessionStorage.setItem(
                `game_${currentGameId}`,
                JSON.stringify(parsedData)
              );

              // Update game state
              setGameState(parsedData["__trendguesser.state"]);

              // Update game data
              setGameData(parsedData);

              // Save high score if applicable
              // Save high score if applicable
              if (
                typeof window !== "undefined" &&
                parsedData["__trendguesser.state"].category &&
                currentPlayer.score > 0
              ) {
                try {
                  const category = parsedData["__trendguesser.state"].category;
                  const score = currentPlayer.score;

                  console.log(
                    `Trying to save high score - Category: ${category}, Score: ${score}`
                  );

                  // Load existing high scores
                  const highScoresKey = `tg_highscores_${userUid}`;
                  let highScores = {};

                  const existingScores = localStorage.getItem(highScoresKey);
                  if (existingScores) {
                    try {
                      highScores = JSON.parse(existingScores);
                      console.log("Existing high scores found:", highScores);
                    } catch (parseErr) {
                      console.error(
                        "Error parsing existing high scores:",
                        parseErr
                      );
                      // Initialize with empty object if parsing fails
                      highScores = {};
                    }
                  } else {
                    console.log(
                      "No existing high scores found, creating new record"
                    );
                  }

                  // Check if there's an existing score
                  const existingScore = highScores[category] || 0;
                  console.log(
                    `Existing score for ${category}: ${existingScore}`
                  );

                  // Update high score if better than or equal to existing
                  // Changed: store the score even if it equals the current high score
                  if (score >= existingScore) {
                    highScores[category] = score;
                    localStorage.setItem(
                      highScoresKey,
                      JSON.stringify(highScores)
                    );
                    console.log(`High score saved for ${category}: ${score}`);
                  } else {
                    console.log(
                      `Score ${score} not higher than existing ${existingScore}, not saving`
                    );
                  }
                } catch (err) {
                  console.error("Error saving high score:", err);
                }
              }
            }
          } catch (e) {
            console.error("Error updating state after ending game:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error ending game:", error);
      setError("Failed to end game");
      // Still proceed with resetting local state even if there was an error
    }
  };

  // Reset game state for a new game
  const resetGame = () => {
    console.log("Resetting game state");

    // Store game ID before clearing it
    const currentGameId = gameId;

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
      // Clear the current_game_id from session storage to avoid persistence issues
      sessionStorage.removeItem("current_game_id");
      console.log("Cleared current game ID from session storage");

      // Clear the game data if we had a gameId
      if (currentGameId) {
        sessionStorage.removeItem(`game_${currentGameId}`);
        console.log("Removed stored game data for:", currentGameId);
      }
    }
    
    // Force the GameContext provider to re-render
    if (typeof window !== "undefined") {
      // This calls window.dispatchEvent(new Event('storage')) which can be used to trigger re-renders
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Add direct setter for gameState
  const setGameStateDirectly = (state: TrendGuesserGameState) => {
    console.log("Setting game state directly:", state.category, state.currentRound);
    setGameState(state);
    setLoading(false);
  };

  // Load high scores from Firestore
 const loadHighScores = async () => {
   if (!userUid) {
     console.warn("Cannot load high scores - no user ID");
     return;
   }

   try {
     console.log("Loading high scores for user:", userUid);

     if (USE_MOCK_DATA) {
       console.log("Using mock data for high scores");

       // Try to get high scores from localStorage for persistence
       if (typeof window !== "undefined") {
         const highScoresKey = `tg_highscores_${userUid}`;
         const storedScores = localStorage.getItem(highScoresKey);

         if (storedScores) {
           try {
             const parsedScores = JSON.parse(storedScores);
             console.log("Found high scores in localStorage:", parsedScores);

             // Create an immediately updated player with high scores
             // Deep clone to ensure we're creating a new reference
             const updatedPlayer = currentPlayer
               ? {
                   ...JSON.parse(JSON.stringify(currentPlayer)),
                   highScores: parsedScores,
                 }
               : null;

             if (updatedPlayer) {
               // Update the player state
               setCurrentPlayer(updatedPlayer);
               console.log(
                 "Updated current player with high scores:",
                 updatedPlayer
               );
             }
           } catch (e) {
             console.error("Error parsing high scores from localStorage:", e);
           }
         } else {
           console.log("No high scores found in localStorage");
         }
       }

       return;
     }

     // Real Firestore implementation
     const playerRef = doc(db, "players", userUid);
     const playerDoc = await getDoc(playerRef);

     if (playerDoc.exists()) {
       const playerData = playerDoc.data();

       if (playerData.highScores) {
         console.log("Found high scores in Firestore:", playerData.highScores);

         // Create an immediately updated player object with high scores
         const updatedPlayer = currentPlayer
           ? {
               ...JSON.parse(JSON.stringify(currentPlayer)),
               highScores: playerData.highScores,
             }
           : null;

         if (updatedPlayer) {
           // Update the player state with a completely new object to trigger re-renders
           setCurrentPlayer(updatedPlayer);
           console.log(
             "Updated current player with high scores from Firestore",
             updatedPlayer
           );
         }

         // Save to localStorage for faster access next time
         if (typeof window !== "undefined") {
           try {
             const highScoresKey = `tg_highscores_${userUid}`;
             localStorage.setItem(
               highScoresKey,
               JSON.stringify(playerData.highScores)
             );
             console.log("Saved high scores to localStorage for future use");

             // Trigger storage event for components to react
             window.dispatchEvent(new Event("storage"));
           } catch (e) {
             console.error("Error saving high scores to localStorage:", e);
           }
         }
       } else {
         console.log("Player document exists but has no high scores");
       }
     } else {
       console.log("No player document found in Firestore");
     }
   } catch (error) {
     console.error("Error loading high scores:", error);
   }
 };

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
