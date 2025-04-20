//GameContext.tsx

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  GameData,
  SearchCategory,
  TrendGuesserGameState,
  TrendGuesserPlayer,
  SearchTerm,
} from "@/types";
import { useAuth } from "./AuthContext";
import { TrendGuesserService } from "@/lib/trendGuesserService";

interface GameContextType {
  gameId: string | null;
  gameData: GameData | null;
  loading: boolean;
  error: string | null;
  currentPlayer: TrendGuesserPlayer | null;
  gameState: TrendGuesserGameState | null;
  setGameId: (id: string) => void;
  setGameState: (state: TrendGuesserGameState) => void;
  setCurrentPlayer: React.Dispatch<
    React.SetStateAction<TrendGuesserPlayer | null>
  >;
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

  // Use localStorage to persist gameId across page refreshes
  const getInitialGameId = () => {
    if (typeof window !== "undefined") {
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
    if (typeof window !== "undefined") {
      if (id) {
        sessionStorage.setItem("current_game_id", id);
        console.log("Updated current_game_id in session storage:", id);
      } else {
        sessionStorage.removeItem("current_game_id");
        console.log("Removed current_game_id from session storage");
      }
    }
  };

  // Check for a stored game ID on initial load
  useEffect(() => {
    if (!gameId) {
      if (typeof window !== "undefined") {
        const storedGameId = sessionStorage.getItem("current_game_id");
        if (storedGameId) {
          console.log("Found stored game ID in session storage:", storedGameId);
          setGameId(storedGameId);
        }
      }
    }
  }, []);

  // Check for game ID and load local data if available
  useEffect(() => {
    if (!userUid) {
      setLoading(false);
      return;
    }

    // If game ID is not set, try to get it from session storage
    if (!gameId) {
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

    setLoading(true);
    setError(null);

    console.log(
      `Loading game data for game ID: ${gameId}, user: ${userUid}`
    );

    // Check for local game state in localStorage
    if (typeof window !== "undefined") {
      try {
        const localStateKey = `tg_local_state_${gameId}`;
        const localStateJson = localStorage.getItem(localStateKey);
        
        if (localStateJson) {
          try {
            const localStateData = JSON.parse(localStateJson);
            if (localStateData.gameState) {
              console.log(`Found local game state for ${gameId}`);
              
              // Set the game state from localStorage
              setGameState(localStateData.gameState);
              
              // Also try to load player data
              const playerDataKey = `tg_player_${userUid}`;
              const storedPlayerData = localStorage.getItem(playerDataKey);
              
              if (storedPlayerData) {
                try {
                  const playerData = JSON.parse(storedPlayerData);
                  setCurrentPlayer(playerData);
                  console.log(`Loaded player data for ${userUid}, score:`, playerData.score);
                } catch (e) {
                  console.error("Error parsing player data:", e);
                }
              }
              
              setLoading(false);
              return;
            }
          } catch (e) {
            console.error("Error parsing local game state:", e);
          }
        }
      } catch (e) {
        console.error("Error accessing localStorage:", e);
      }
    }
    
    // If no local state, try to fetch game data once from API
    const fetchGameData = async () => {
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (response.ok) {
          const data = await response.json() as GameData;
          
          console.log(
            `Found game data for ${gameId}:`,
            data.status,
            data["__trendguesser.state"] ? "has game state" : "no game state"
          );

          // Set game data
          setGameData(data);

          // Extract game state if it exists
          if (data["__trendguesser.state"]) {
            const gameState = data["__trendguesser.state"] as TrendGuesserGameState;
            setGameState(gameState);
            
            // Save to localStorage for future use
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(
                  `tg_local_state_${gameId}`,
                  JSON.stringify({
                    gameState,
                    lastUpdate: new Date().toISOString(),
                    pendingUpdates: false
                  })
                );
              } catch (e) {
                console.error("Error storing game state to localStorage:", e);
              }
            }
          }

          // Extract current player data
          if (data[userUid]) {
            setCurrentPlayer(data[userUid] as TrendGuesserPlayer);
            
            // Save player data to localStorage
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem(
                  `tg_player_${userUid}`,
                  JSON.stringify(data[userUid])
                );
              } catch (e) {
                console.error("Error storing player data to localStorage:", e);
              }
            }
            
            console.log(
              `Found player data for ${userUid}, score:`,
              data[userUid].score
            );
          }
          
          setLoading(false);
        } else {
          console.log("Game data not found or error:", response.status);
          setError("Game data not found");
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching game data:", err);
        setError("Error loading game data");
        setLoading(false);
      }
    };

    fetchGameData();
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
          score: 0,
        };
        setCurrentPlayer(resetPlayer);
        console.log("Reset player score for new game");
      }

      // CRITICAL FIX: Always create a new game ID when starting a new game
      // This ensures we don't reuse game IDs between sessions
      const newGameId = await TrendGuesserService.createGame(
        userUid || "anonymous",
        currentPlayer?.name || "Player"
      );
      console.log("Game created with ID:", newGameId);
      setGameId(newGameId);

      // Explicitly update session storage with the new game ID
      if (typeof window !== "undefined") {
        sessionStorage.setItem("current_game_id", newGameId);
        console.log("Updated current_game_id in session storage:", newGameId);
      }

      setLoading(true);
      console.log(
        `Starting game with ID: ${newGameId}, category: ${category}, customTerm: ${
          customTerm || "none"
        }`
      );

      // Start the game using the new game ID (not getting it from state or storage)
      const initialGameState = await TrendGuesserService.startGame(
        newGameId,
        category,
        customTerm
      );

      if (initialGameState) {
        // Set the game state directly from the return value for immediate use
        setGameState(initialGameState);
      } else {
        console.error(
          "No game state returned from TrendGuesserService.startGame"
        );
        setError("Failed to initialize game state");
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
    if (!currentGameId && typeof window !== "undefined") {
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
      // This ensures we maintain term continuity even if the API fails
      let localGameStateStore = {};

      try {
        if (typeof window !== "undefined") {
          const storedLocalState = localStorage.getItem(
            `tg_local_state_${currentGameId}`
          );
          if (storedLocalState) {
            localGameStateStore = JSON.parse(storedLocalState);
            console.log("Retrieved local game state from localStorage");
          }
        }
      } catch (e) {
        console.error("Error reading local game state:", e);
      }

      console.log(
        `Making guess (${isHigher ? "HIGHER" : "LOWER"}) for game:`,
        currentGameId
      );

      // IMPORTANT: When API is failing, we need to use local game state logic
      // instead of trying to make server calls that will fail
      // Calculate the result locally first before attempting any server calls
      let localCalculatedResult = false;

      // Ensure we have valid gameState
      if (!gameState || !gameState.knownTerm || !gameState.hiddenTerm) {
        console.error("Invalid game state for local calculation", {
          hasState: !!gameState,
          hasKnownTerm: gameState?.knownTerm ? true : false,
          hasHiddenTerm: gameState?.hiddenTerm ? true : false,
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
        result: localCalculatedResult,
        currentRound: gameState.currentRound || 1,
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
              result: localCalculatedResult,
              currentRound: gameState.currentRound,
            },
          };

          localStorage.setItem(
            `tg_local_state_${currentGameId}`,
            JSON.stringify(updatedLocalStore)
          );
          console.log(
            `Stored local state for round ${gameState.currentRound} in localStorage`
          );
        }
      } catch (e) {
        console.error("Error storing local game state:", e);
      }

      // Now try API call
      let result: boolean;

      try {
        // Make a deep copy of the current game state
        const localGameStateCopy = gameState
          ? JSON.parse(JSON.stringify(gameState))
          : null;

        // Attempt API call only if we have valid game state to send
        if (
          localGameStateCopy &&
          localGameStateCopy.knownTerm &&
          localGameStateCopy.hiddenTerm &&
          typeof localGameStateCopy.knownTerm.volume === "number" &&
          typeof localGameStateCopy.hiddenTerm.volume === "number"
        ) {
          // CRITICAL FIX: If this is a correct guess, update player score before making the API call
          if (localCalculatedResult) {
            // Use the functional update to ensure the latest score is used
            setCurrentPlayer((prevPlayer) => {
              const prevScore = prevPlayer?.score || 0;
              const newScore = prevScore + 1;
              console.log(
                `[makeGuess] Updated player score from ${prevScore} to ${newScore} after API call confirmation`
              );
              const updatedPlayer = { ...prevPlayer, score: newScore };
              if (typeof window !== "undefined" && userUid) {
                const playerDataKey = `tg_player_${userUid}`;
                localStorage.setItem(
                  playerDataKey,
                  JSON.stringify(updatedPlayer)
                );
              }
              return updatedPlayer;
            });
          }

          // CRITICAL FIX: Ensure we're passing the EXACT current game state to the API
          if (!localGameStateCopy.currentRound) {
            localGameStateCopy.currentRound = gameState.currentRound || 1;
          }

          result = await TrendGuesserService.makeGuess(
            currentGameId,
            userUid,
            isHigher,
            localGameStateCopy
          );
          console.log("API guess result:", result);

          // If API disagrees with our local calculation, trust our local result
          if (result !== localCalculatedResult) {
            console.warn(
              "API result differs from local calculation. Using local result for consistency."
            );
            result = localCalculatedResult;
          }
        } else {
          // Invalid game state, skip API and use local calculation
          console.warn(
            "Invalid game state for API, using local calculation only"
          );
          result = localCalculatedResult;
        }
      } catch (err) {
        console.warn(`Error in makeGuess API call:`, err);
        console.warn("Using local calculation due to API error");
        result = localCalculatedResult;
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
    if (!currentGameId && typeof window !== "undefined") {
      currentGameId = sessionStorage.getItem("current_game_id");
      if (!currentGameId) {
        console.error("No game ID available for ending game");
        setError("No game ID available");
        return;
      }
    }

    try {
      // Store current player score before ending
      const finalScore = currentPlayer.score || 0;

      console.log(`Ending game ${currentGameId} with score ${finalScore}`);

      // Call the service to end the game
      await TrendGuesserService.endGame(currentGameId!, userUid, finalScore);

      console.log("Game ended successfully");
    } catch (error) {
      console.error("Error ending game:", error);
      setError("Failed to end game");
    }
  };

  // Reset game state for a new game
  const resetGame = () => {
    console.log("Resetting game state");

    // Store game ID before clearing it
    const currentGameId = gameId;

    // First, ensure that high scores are saved before reset
    try {
      if (
        gameState?.category &&
        currentPlayer?.score &&
        currentPlayer.score > 0
      ) {
        console.log(
          `Ensuring high score is saved before reset: ${currentPlayer.score} in ${gameState.category}`
        );

        // Try to call the TrendGuesserService directly for reliability
        if (userUid) {
          TrendGuesserService.updateHighScore(
            userUid,
            gameState.category,
            currentPlayer.score
          ).catch((err) =>
            console.error("Error saving final high score during reset:", err)
          );
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

    // Clear session storage
    if (typeof window !== "undefined") {
      // Use a flag to prevent multiple storage event handling during reset
      if (!isResetting.current) {
        isResetting.current = true;

        // Clear the current_game_id from session storage
        sessionStorage.removeItem("current_game_id");
        console.log("Cleared current game ID from session storage");

        // ADDED: Clear any local state for this game from localStorage
        if (currentGameId) {
          localStorage.removeItem(`tg_local_state_${currentGameId}`);
          console.log(
            "Cleared local state from localStorage for game:",
            currentGameId
          );
        }

        // Force re-render to update components
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("storage"));
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
    // VALIDATION: Ensure we have valid state before updating
    if (!state) {
      console.error("Attempted to set null/undefined game state");
      return;
    }

    // CRITICAL FIX: Check if we already have a state and if the incoming state has a lower round number
    // This prevents stale state updates from overriding newer states
    if (
      gameState &&
      typeof gameState.currentRound === "number" &&
      typeof state.currentRound === "number" &&
      state.currentRound < gameState.currentRound
    ) {
      console.warn(
        `Ignoring stale game state update (round ${state.currentRound} < ${gameState.currentRound})`
      );
      return;
    }

    // Ensure terms have valid structure to prevent crashes
    if (!state.knownTerm || typeof state.knownTerm !== "object") {
      console.warn(
        "Known term missing or invalid in state update, adding placeholder"
      );
      state.knownTerm = {
        id: `fallback-${Date.now()}-known`,
        term: "Term",
        volume: 500000,
        category: state.category || "technology",
        imageUrl: `/api/image?term=fallback-known`,
      };
    }

    if (!state.hiddenTerm || typeof state.hiddenTerm !== "object") {
      console.warn(
        "Hidden term missing or invalid in state update, adding placeholder"
      );
      state.hiddenTerm = {
        id: `fallback-${Date.now()}-hidden`,
        term: "Hidden Term",
        volume: 700000,
        category: state.category || "technology",
        imageUrl: `/api/image?term=fallback-hidden`,
      };
    }

    // Make sure volume properties exist and are numbers
    if (state.knownTerm && state.knownTerm.volume === undefined) {
      console.warn("Known term volume missing, setting default");
      state.knownTerm.volume = 500000;
    }

    if (state.hiddenTerm && state.hiddenTerm.volume === undefined) {
      console.warn("Hidden term volume missing, setting default");
      state.hiddenTerm.volume = 700000;
    }

    // Make sure arrays are initialized
    if (!Array.isArray(state.terms)) {
      state.terms = [];
    }

    if (!Array.isArray(state.usedTerms)) {
      state.usedTerms = [];
    }

    console.log(
      "Setting game state directly:",
      state.category,
      state.currentRound
    );
    setGameState(state);
    setLoading(false);
  };

  // Load high scores
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
    setCurrentPlayer,
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