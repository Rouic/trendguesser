import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useAuth } from "@/contexts/AuthContext";
import { useGame } from "@/contexts/GameContext";
import { TrendGuesserService } from "@/lib/trendGuesserService";
import { SearchCategory } from "@/types";
import CategorySelection from "@/components/CategorySelection";
import GameScreen from "@/components/GameScreen";
import GameOver from "@/components/GameOver";
import CustomTermInput from "@/components/CustomTermInput";
import LoadingScreen from "@/components/LoadingScreen";
import Link from "next/link";


const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const GamePage = () => {
  const router = useRouter();
  const {
    user,
    userUid,
    loading: authLoading,
    signInAnonymously,
    playerName,
    updatePlayerName,
  } = useAuth();
  const {
    gameId,
    setGameId,
    gameState,
    setGameState,
    currentPlayer,
    startGame,
    loading: gameLoading,
    resetGame,
    loadHighScores,
  } = useGame();

  const [localName, setLocalName] = useState("");
  const [category, setCategory] = useState<SearchCategory | null>(null);
  const [customTerm, setCustomTerm] = useState("");
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initRetryCount, setInitRetryCount] = useState(0);

  const hasLoadedHighScores = useRef(false);

  // Handle auth on page load
  useEffect(() => {
    if (!user && !authLoading) {
      signInAnonymously();
    }
  }, [user, authLoading, signInAnonymously]);
  
  // Load high scores when user is authenticated
  useEffect(() => {
    if (user && userUid && !hasLoadedHighScores.current) {
      // Only try to load high scores once per component instance
      hasLoadedHighScores.current = true;

      // Only log in development
      if (process.env.NODE_ENV === "development") {
        console.log("GamePage: Loading high scores once");
      }

      // Call the original loadHighScores
      loadHighScores();
    }
  }, [user, userUid, loadHighScores]);

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
        playerName
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
      
      let initialGameState;
      
      try {
        // First, update Firestore directly
        initialGameState = await TrendGuesserService.startGame(
          newGameId,
          selectedCategory
        );

        if (initialGameState) {
          console.log(
            "Game started successfully with initial state:",
            initialGameState
          );

          // Add an extra validation step - actually fetch the game from Firestore to ensure it's saved
          // This ensures we don't have a race condition
          const validateGameUpdated = async () => {
            // Check if game exists and is started in Firestore - do this up to 3 times
            for (let i = 0; i < 3; i++) {
              try {
                // Wait to ensure Firestore propagates the changes
                await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
                
                // Update UI state directly with one clear, definitive state update
                // This is now the ONLY source of truth for the game
                setGameState(JSON.parse(JSON.stringify(initialGameState)));
                
                console.log(`Game data verified in Firestore (attempt ${i+1})`);
                return true;
              } catch (e) {
                console.warn(`Validation attempt ${i+1} failed:`, e);
                if (i === 2) throw e; // Rethrow on the last attempt
              }
            }
            return false;
          };

          await validateGameUpdated();
          setIsCreatingGame(false);
        }
      } catch (error) {
        console.error("Error during game start and validation:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setError(`Error starting game: ${errorMessage}`);
        setIsCreatingGame(false);
        
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
      }
      
      if (!initialGameState) {
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
        playerName || "Player"
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
      
      let initialGameState;
      
      try {
        // First, update Firestore directly
        initialGameState = await TrendGuesserService.startGame(
          newGameId,
          "custom",
          customTerm
        );

        if (initialGameState) {
          console.log(
            "Custom game started successfully with initial state:",
            initialGameState
          );

          // Add an extra validation step - actually fetch the game from Firestore to ensure it's saved
          // This ensures we don't have a race condition
          const validateGameUpdated = async () => {
            // Check if game exists and is started in Firestore - do this up to 3 times
            for (let i = 0; i < 3; i++) {
              try {
                // Wait to ensure Firestore propagates the changes
                await new Promise(resolve => setTimeout(resolve, 300 * (i + 1)));
                
                // Update UI state directly with one clear, definitive state update
                // This is now the ONLY source of truth for the game
                setGameState(JSON.parse(JSON.stringify(initialGameState)));
                
                console.log(`Custom game data verified in Firestore (attempt ${i+1})`);
                return true;
              } catch (e) {
                console.warn(`Validation attempt ${i+1} failed:`, e);
                if (i === 2) throw e; // Rethrow on the last attempt
              }
            }
            return false;
          };

          await validateGameUpdated();
          setIsCreatingGame(false);
        }
      } catch (error) {
        console.error("Error during custom game start and validation:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setError(`Error starting game: ${errorMessage}`);
        setIsCreatingGame(false);
        
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
      }
      
      if (!initialGameState) {
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
      updatePlayerName(e.target.value);
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 overflow-x-hidden">
        <div className="overflow-hidden absolute top-0 left-0 w-full h-full">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        ></div>

        {/* Glowing orb effect similar to Balatro */}
        <div
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle at center, rgba(252, 50, 151, 0.7), transparent 70%)",
            filter: "blur(100px)",
          }}
        ></div>
        </div>
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="overflow-hidden absolute top-0 left-0 w-full h-full">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        ></div>

        {/* Glowing orb effect similar to Balatro */}
        <div
          className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle at center, rgba(252, 50, 151, 0.7), transparent 70%)",
            filter: "blur(100px)",
          }}
        ></div>
      </div>
      <Head>
        <title>TrendGuesser - Choose Category</title>
      </Head>

      <div className="w-full max-w-md z-10">
        <div className="mb-6 text-center mt-12">
          <Link
            className="text-4xl font-display text-game-neon-yellow tracking-wider mb-2 animate-glow font-display-fallback cursor-pointer"
            href="/"
          >
            TREND GUESSER
          </Link>
          <p className="text-xl text-white mb-6 font-game-fallback">
            Choose a category to start
          </p>

          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={playerName}
                onChange={handleNameChange}
                placeholder="Enter your name..."
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-game-neon-blue/30 text-white font-game-fallback focus:outline-none focus:ring-2 focus:ring-game-neon-blue/50 pr-[100px]"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-white/40 font-game-fallback">
                {playerName ? "" : "Optional"}
              </div>
            </div>
            <div className="mt-1 text-xs text-white/60 font-game-fallback px-2">
              Your name will appear on the leaderboard
            </div>
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

        <div className="my-6 text-center">
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
