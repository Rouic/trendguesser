import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { useAuth } from "@/contexts/AuthContext";
import { useGameContext } from "@/contexts/WebGameContextAdapter";
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
    gameState,
    startGame,
    error: gameError,
    loading: gameLoading,
    playerName: gameName,
    setPlayerName
  } = useGameContext();

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

      console.log("Creating new game with category:", selectedCategory);
      
      // Start the game with selected category
      await startGame(selectedCategory);
      
      setIsCreatingGame(false);
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

      // Start game with custom term
      await startGame("custom", customTerm);
      
      setIsCreatingGame(false);
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
    const newName = e.target.value;
    setLocalName(newName);
    updatePlayerName(newName);
    setPlayerName(newName);
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
  if (gameState?.knownTerm && gameState?.hiddenTerm) {
    console.log(
      "Rendering game screen with game state:",
      gameState.category,
      gameState.round,
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
                value={playerName || localName}
                onChange={handleNameChange}
                placeholder="Enter your name..."
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-game-neon-blue/30 text-white font-game-fallback focus:outline-none focus:ring-2 focus:ring-game-neon-blue/50 pr-[100px]"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-white/40 font-game-fallback">
                {playerName || localName ? "" : "Optional"}
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