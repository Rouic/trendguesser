import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import { TrendGuesserService } from "@/lib/firebase/trendGuesserService";
import { SearchCategory, TrendGuesserGameState } from "@/types";
import CategorySelection from "@/components/CategorySelection";
import GameScreen from "@/components/GameScreen";
import GameOver from "@/components/GameOver";
import CustomTermInput from "@/components/CustomTermInput";
import LoadingScreen from "@/components/LoadingScreen";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const GamePage = () => {
  const router = useRouter();
  const { user, userUid, loading: authLoading, signInAnonymously } = useAuth();
  const {
    gameId,
    setGameId,
    gameState,
    currentPlayer,
    startGame,
    loading: gameLoading,
    resetGame,
  } = useGame();

  const [localName, setLocalName] = useState("");
  const [category, setCategory] = useState<SearchCategory | null>(null);
  const [customTerm, setCustomTerm] = useState("");
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initRetryCount, setInitRetryCount] = useState(0);

  // Handle auth on page load
  useEffect(() => {
    if (!user && !authLoading) {
      signInAnonymously();
    }
  }, [user, authLoading, signInAnonymously]);

  // Create a new game when user selects a category
  const handleCategorySelect = async (selectedCategory: SearchCategory) => {
    if (selectedCategory === "custom") {
      setCategory(selectedCategory);
      return;
    }

    try {
      // Show loading screen
      setIsCreatingGame(true);
      setError(null);

      // Reset any existing game state first
      if (gameState) {
        resetGame();
      }

      // Create a new game
      console.log("Creating new game...");
      const newGameId = await TrendGuesserService.createGame(
        userUid || "anonymous",
        localName || "Player"
      );

      console.log("Game created with ID:", newGameId);

      // The game ID must be set before calling startGame to ensure state tracking consistency
      console.log("Setting game ID in context:", newGameId);
      setGameId(newGameId);

      // Wait to ensure game ID is set in the context
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start game with selected category - this sets up the game state and returns it
      console.log(
        "Starting game with category:",
        selectedCategory,
        "for game ID:",
        newGameId
      );
      const initialGameState = await TrendGuesserService.startGame(
        newGameId,
        selectedCategory
      );

      if (initialGameState) {
        console.log(
          "Game started successfully with initial state:",
          initialGameState
        );

        // Update the context with the game state
        await startGame(selectedCategory);

        // In mock mode, ensure consistent state across sources
        if (
          process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
          typeof window !== "undefined"
        ) {
          // Double-check that current_game_id is set correctly
          sessionStorage.setItem("current_game_id", newGameId);

          // Verify the game data exists in session storage
          const gameData = sessionStorage.getItem(`game_${newGameId}`);
          if (!gameData) {
            console.warn("Game data missing from session storage, creating it");
            const mockUserUid =
              sessionStorage.getItem("mock_user_uid") || userUid || "mock_user";

            // Create minimal game data with the initial state
            const mockGameData = {
              id: newGameId,
              status: "active",
              createdBy: mockUserUid,
              gameType: "trendguesser",
              "__trendguesser.state": initialGameState,
              [mockUserUid]: {
                uid: mockUserUid,
                name: localName || "Player",
                score: 0,
              },
            };

            // Save to session storage
            sessionStorage.setItem(
              `game_${newGameId}`,
              JSON.stringify(mockGameData)
            );
          }
        }

        setIsCreatingGame(false);
      } else {
        throw new Error("Failed to initialize game state");
      }
    } catch (error) {
      console.error("Error creating game:", error);

      // Check if we've reached the maximum retry attempts
      if (initRetryCount < MAX_RETRIES) {
        setInitRetryCount((prev) => prev + 1);
        console.log(
          `Retrying game initialization (${
            initRetryCount + 1
          }/${MAX_RETRIES})...`
        );

        // Wait and try again
        setTimeout(() => {
          handleCategorySelect(selectedCategory);
        }, RETRY_DELAY);
      } else {
        setError(
          "Failed to create game after multiple attempts. Please try again."
        );
        setIsCreatingGame(false);
        setInitRetryCount(0);
      }
    }
  };

  // Handle custom term submission
  const handleCustomTermSubmit = async () => {
    if (!customTerm.trim()) {
      setError("Please enter a search term");
      return;
    }

    try {
      // Show loading screen
      setIsCreatingGame(true);
      setError(null);
      setInitRetryCount(0);

      // Reset any existing game state first
      if (gameState) {
        resetGame();
      }

      // Create a new game
      console.log("Creating new custom game...");
      const newGameId = await TrendGuesserService.createGame(
        userUid || "anonymous",
        localName || "Player"
      );

      console.log("Game created with ID:", newGameId);

      // The game ID must be set before calling startGame
      console.log("Setting game ID in context for custom term:", newGameId);
      setGameId(newGameId);

      // Wait to ensure game ID is set in the context
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start game with custom term - this directly returns the initial game state
      console.log(
        "Starting game with custom term:",
        customTerm,
        "for game ID:",
        newGameId
      );
      const initialGameState = await TrendGuesserService.startGame(
        newGameId,
        "custom",
        customTerm
      );

      if (initialGameState) {
        console.log(
          "Custom game started successfully with initial state:",
          initialGameState
        );

        // Update the context with the game state
        await startGame("custom", customTerm);

        // In mock mode, ensure consistent state across sources
        if (
          process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
          typeof window !== "undefined"
        ) {
          // Double-check that current_game_id is set correctly
          sessionStorage.setItem("current_game_id", newGameId);

          // Verify the game data exists in session storage
          const gameData = sessionStorage.getItem(`game_${newGameId}`);
          if (!gameData) {
            console.warn("Game data missing from session storage, creating it");
            const mockUserUid =
              sessionStorage.getItem("mock_user_uid") || userUid || "mock_user";

            // Create minimal game data with the initial state
            const mockGameData = {
              id: newGameId,
              status: "active",
              createdBy: mockUserUid,
              gameType: "trendguesser",
              "__trendguesser.state": initialGameState,
              [mockUserUid]: {
                uid: mockUserUid,
                name: localName || "Player",
                score: 0,
              },
            };

            // Save to session storage
            sessionStorage.setItem(
              `game_${newGameId}`,
              JSON.stringify(mockGameData)
            );
          }
        }

        setIsCreatingGame(false);
      } else {
        throw new Error("Failed to initialize custom game state");
      }
    } catch (error) {
      console.error("Error creating custom game:", error);

      // Check if we've reached the maximum retry attempts
      if (initRetryCount < MAX_RETRIES) {
        setInitRetryCount((prev) => prev + 1);
        console.log(
          `Retrying custom game initialization (${
            initRetryCount + 1
          }/${MAX_RETRIES})...`
        );

        // Wait and try again
        setTimeout(() => {
          handleCustomTermSubmit();
        }, RETRY_DELAY);
      } else {
        setError(
          "Failed to create custom game after multiple attempts. Please try again."
        );
        setIsCreatingGame(false);
        setInitRetryCount(0);
      }
    }
  };

  // Handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  };

  // Recovery function for game crashes
  const handleGameRecovery = async () => {
    try {
      setError(null);
      console.log("Attempting to recover game state...");

      // In mock mode, check for any existing game data
      if (
        process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
        typeof window !== "undefined"
      ) {
        const currentGameId = sessionStorage.getItem("current_game_id");

        if (currentGameId) {
          console.log(
            "Found current game ID in session storage:",
            currentGameId
          );
          const gameData = sessionStorage.getItem(`game_${currentGameId}`);

          if (gameData) {
            try {
              const parsedData = JSON.parse(gameData);

              if (
                parsedData["__trendguesser.state"] &&
                parsedData["__trendguesser.state"].started
              ) {
                // Game state exists and is started - update context
                console.log("Found valid game state, applying to context");
                setGameId(currentGameId);
                return true;
              } else {
                // Game exists but not properly started - reset and start over
                console.log("Game exists but not started, resetting");
                resetGame();
                return false;
              }
            } catch (e) {
              console.error("Error parsing game data during recovery:", e);
            }
          }
        }

        // If we get here, no valid game was found
        console.log("No valid game found during recovery, resetting");
        resetGame();
      }

      return false;
    } catch (e) {
      console.error("Error in game recovery:", e);
      return false;
    }
  };

  // Show loading screen while auth is loading
  if (authLoading) {
    return <LoadingScreen message="Connecting to game" />;
  }

  // Show loading screen while game is being created or loaded
  if (isCreatingGame || gameLoading) {
    return <LoadingScreen message="Setting up your game" />;
  }

  // Show game over screen if game is finished
  if (gameState?.finished) {
    return <GameOver />;
  }

  // Show game screen if game is active
  if (gameState?.started) {
    console.log(
      "Rendering game screen with game state:",
      gameState.category,
      gameState.currentRound,
      "Known Term:",
      gameState.knownTerm.term,
      "Hidden Term:",
      gameState.hiddenTerm.term
    );
    return <GameScreen />;
  }

  // Show custom term input if custom category selected
  if (category === "custom") {
    return (
      <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
        <Head>
          <title>TrendGuesser - Custom Term</title>
        </Head>

        <CustomTermInput
          value={customTerm}
          onChange={(e) => setCustomTerm(e.target.value)}
          onSubmit={handleCustomTermSubmit}
          error={error}
        />

        <button
          onClick={() => setCategory(null)}
          className="mt-4 px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-red/30 text-game-neon-red font-game-fallback hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-red-sm"
        >
          Back to Categories
        </button>
      </div>
    );
  }

  // Show category selection by default
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
      <Head>
        <title>TrendGuesser - Choose Category</title>
      </Head>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-display text-game-neon-blue tracking-wider mb-2 animate-glow font-display-fallback">
            TRENDGUESSER
          </h1>
          <p className="text-xl text-white mb-6 font-game-fallback">
            Choose a category to start
          </p>

          <div className="mb-6">
            <input
              type="text"
              value={localName}
              onChange={handleNameChange}
              placeholder="Your Name (optional)"
              className="w-full px-4 py-2 rounded-lg bg-black/40 border border-game-neon-blue/30 text-white font-game-fallback focus:outline-none focus:ring-2 focus:ring-game-neon-blue/50"
            />
          </div>
        </div>

        <CategorySelection onSelect={handleCategorySelect} />

        {error && (
          <div className="mt-4 p-3 bg-game-neon-red/20 border border-game-neon-red/40 rounded-lg text-white text-center">
            <div className="mb-2">{error}</div>
            <button
              onClick={handleGameRecovery}
              className="px-4 py-1 bg-black/40 rounded-full border border-white/20 text-white text-sm hover:bg-black/60 mt-2"
            >
              Try to Recover Game
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-yellow/30 text-game-neon-yellow font-game-fallback hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-yellow-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
