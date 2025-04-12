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

interface GameContextType {
  gameId: string | null;
  gameData: GameData | null;
  loading: boolean;
  error: string | null;
  currentPlayer: TrendGuesserPlayer | null;
  gameState: TrendGuesserGameState | null;
  setGameId: (id: string) => void;
  startGame: (category: SearchCategory, customTerm?: string) => Promise<void>;
  makeGuess: (isHigher: boolean) => Promise<boolean>;
  endGame: () => Promise<void>;
  resetGame: () => void;
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
        typeof window !== "undefined" &&
        !gameState
      ) {
        console.log("Loading game state from session storage before guess");
        const storedData = sessionStorage.getItem(`game_${currentGameId}`);
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            if (parsedData["__trendguesser.state"]) {
              setGameState(parsedData["__trendguesser.state"]);
              console.log("Loaded game state from session storage");
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
      const result = await TrendGuesserService.makeGuess(
        currentGameId,
        userUid,
        isHigher
      );

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
  };

  const value: GameContextType = {
    gameId,
    gameData,
    loading,
    error,
    currentPlayer,
    gameState,
    setGameId,
    startGame,
    makeGuess,
    endGame,
    resetGame,
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
