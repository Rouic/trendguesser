//GameScreen.tsx

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useGameContext } from "@/contexts/WebGameContextAdapter";
import { useAuth } from "@/contexts/AuthContext";
import type { SearchTerm } from "@/types";
import { TrendGuesserService } from "@/lib/trendGuesserService";
import Footer from "./layout/Footer";
import GameOver from "./GameOver";

// Helper to generate a term name based on category
function generateTermName(category: string): string {
  const categoryTerms = {
    snacks: [
      "Pretzels",
      "Potato Chips",
      "Chocolate Bar",
      "Cheese Puffs",
      "Trail Mix",
      "Popcorn",
      "Cookies",
    ],
    technology: [
      "Smartphone",
      "Smart Watch",
      "Tablet",
      "Laptop",
      "Drone",
      "Gaming Console",
      "Bluetooth Speaker",
    ],
    sports: [
      "Soccer Ball",
      "Tennis Racket",
      "Golf Clubs",
      "Basketball",
      "Football Helmet",
      "Running Shoes",
    ],
    entertainment: [
      "Movie Ticket",
      "Streaming Service",
      "Concert Ticket",
      "Video Game",
      "Board Game",
    ],
    landmarks: [
      "Eiffel Tower",
      "Statue of Liberty",
      "Great Wall",
      "Colosseum",
      "Taj Mahal",
      "Big Ben",
    ],
    fashion: [
      "Designer Bag",
      "Running Shoes",
      "Dress Shirt",
      "Jeans",
      "Sunglasses",
      "Watch",
      "Sweater",
    ],
  };

  // Get terms for this category or use generic terms
  const terms = categoryTerms[category as keyof typeof categoryTerms] || [
    "Product",
    "Item",
    "Brand",
    "Service",
  ];

  // Pick a random term from the list
  return terms[Math.floor(Math.random() * terms.length)];
}

// Helper to generate a realistic volume compared to the known term
function generateRandomVolume(knownVolume: number): number {
  // Generate a volume that's somewhat realistic compared to the known term
  // Either higher or lower by a reasonable margin (20%-200%)
  const multiplier =
    Math.random() < 0.5
      ? 0.2 + Math.random() * 0.8 // Lower: 20%-100% of known volume
      : 1 + Math.random(); // Higher: 100%-200% of known volume

  return Math.floor(knownVolume * multiplier);
}

const GameScreen = () => {
  const router = useRouter();
  const { userUid } = useAuth();
  const {
    gameState,
    playerId,
    makeGuess,
    endGame,
    error: gameError,
  } = useGameContext();

  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(null);
  const [isGuessing, setIsGuessing] = useState(false);
  const [isInTransition, setIsInTransition] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false); // Add state to control game over dialog
  const [resultAnimationComplete, setResultAnimationComplete] = useState(true); // To track animation completion
  const [forceNotification, setForceNotification] = useState<"correct" | "wrong" | null>(null); // Force notification display
  
  // Refs to track state
  const currentGameRef = useRef<string | null>(null);
  const loadedCategoriesInScreen = useRef<Set<string>>(new Set());
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Display any errors from the game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  // Track categories seen 
  useEffect(() => {
    if (
      gameState?.category &&
      !loadedCategoriesInScreen.current.has(gameState.category)
    ) {
      // Only try to load each category once per component instance
      loadedCategoriesInScreen.current.add(gameState.category);

      // Only log in development
      if (process.env.NODE_ENV === "development") {
        console.log(
          "GameScreen: Tracking category:",
          gameState.category
        );
      }
    }
  }, [gameState?.category]);

  // Debug logging for current game state
  useEffect(() => {
    if (gameState) {
      console.log("[GameScreen] Current game state:", {
        playerId,
        finished: gameState.finished,
        category: gameState.category,
        knownTerm: gameState.knownTerm?.term,
        hiddenTerm: gameState.hiddenTerm?.term,
      });
    }
  }, [gameState, playerId]);

  // Show game over dialog when game is finished
  useEffect(() => {
    if (!gameState) {
      console.error("No game state available");
      router.push("/game");
      return;
    }

    if (gameState.finished) {
      // Wait for any result animations to complete, then show the game over dialog
      const timer = setTimeout(() => {
        console.log("Showing game over dialog");
        setShowGameOver(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [gameState, router]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clean up any notifications
      document.body.classList.remove("showing-correct");
      document.body.classList.remove("showing-equal");
      document.body.classList.remove("showing-wrong");
      
      // Clear timeouts
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Handle making a guess - completely rewritten to match legacy approach
  const handleGuess = async (isHigher: boolean) => {
    // Don't allow guesses during transitions or if already guessing
    if (!gameState || isGuessing || isTransitioning || !resultAnimationComplete) return;

    // Lock UI to prevent multiple guesses
    setIsGuessing(true);
    setError(null);
    setShowResult(false); // Reset previous results
    setResultAnimationComplete(false);

    try {
      console.log(
        `[handleGuess] Making ${isHigher ? "HIGHER" : "LOWER"} guess...`
      );

      // Store the current game state values for comparison
      const knownTermName = gameState.knownTerm?.term || "Unknown Term";
      const knownTermVolume = gameState.knownTerm?.volume ?? 0;
      const hiddenTermName = gameState.hiddenTerm?.term || "Unknown Term";
      const hiddenTermVolume = gameState.hiddenTerm?.volume ?? 0;

      console.log(`[handleGuess] Comparison:`, {
        category: gameState.category,
        knownTerm: knownTermName,
        knownVolume: knownTermVolume,
        hiddenTerm: hiddenTermName,
        hiddenVolume: hiddenTermVolume,
      });

      // Make the guess and get result
      const result = await makeGuess(isHigher);
      
      console.log("Guess result:", result ? "CORRECT" : "WRONG");
      
      // *** KEY DIFFERENCE FROM PREVIOUS CODE ***
      // Show the result to the user IMMEDIATELY with DOM state
      setLastGuessCorrect(result);
      setShowResult(true);
      console.log("Setting showResult to TRUE directly - actual value:", showResult);

      // Check if volumes are equal for special notification
      const isEqual = gameState.hiddenTerm?.volume === gameState.knownTerm?.volume;
      
      // For immediate visual feedback - force style changes directly in the DOM
      if (result) {
        if (isEqual) {
          document.body.classList.add("showing-equal");
        } else {
          document.body.classList.add("showing-correct");
        }
      } else {
        document.body.classList.add("showing-wrong");
      }

      // Wait to let user see the result for 2.5 seconds before transitioning
      if (result) {
        // For correct guesses - show notification then continue
        // Clear any existing timeout to avoid race conditions
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }

        notificationTimeoutRef.current = setTimeout(() => {
          console.log("Transition starting after showing notification");

          // Set transition flags to ensure hidden card volume is never visible
          setIsInTransition(true);
          setIsTransitioning(true);

          // Hide notification before transition
          setShowResult(false);
          document.body.classList.remove("showing-correct");
          document.body.classList.remove("showing-equal");

          // Wait for animation to complete, then allow next guess
          setTimeout(() => {
            setIsGuessing(false);
            setIsTransitioning(false);
            setIsInTransition(false);
            setResultAnimationComplete(true);
            console.log("Transition complete, ready for next guess");
          }, 600);
        }, 2500); // Show notification for 2.5 seconds
      } else {
        // Wrong guess - game over
        // Wait a moment to let user see the result, then show game over
        setTimeout(() => {
          console.log("Game over - showing game over screen");
          
          // Clean up all notification classes
          document.body.classList.remove("showing-wrong");
          document.body.classList.remove("showing-correct");
          document.body.classList.remove("showing-equal");
          
          // Show game over screen
          setShowGameOver(true);
          setIsGuessing(false);
          setResultAnimationComplete(true);
        }, 2500);
      }
    } catch (error) {
      console.error("Error making guess:", error);
      setError("Error processing your guess. Please try again.");
      setIsGuessing(false);
      setIsInTransition(false);
      setForceNotification(null); // Clear any notification
      setResultAnimationComplete(true); // Reset animation state in case of error
    }
  };

  // Handle game quit
  const handleQuit = async () => {
    try {
      await endGame();
      router.push("/game");
    } catch (error) {
      console.error("Error ending game:", error);
      setError("Error ending game. Please try again.");
    }
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white text-center p-8">
          <h1 className="text-2xl mb-4">Loading game...</h1>
          {error && (
            <p className="text-red-500 mt-4">{error}</p>
          )}
        </div>
      </div>
    );
  }

  const { knownTerm, hiddenTerm } = gameState;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="overflow-hidden absolute top-0 left-0 w-full h-full z-0">
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

      {/* Top bar with score */}
      <div className="p-4 z-10 bg-black/30 backdrop-blur-sm grid grid-cols-3 items-center border-b border-white/10">
        <div className="flex items-center justify-start gap-2 grow lg:shrink">
          <button
            onClick={handleQuit}
            className="px-4 py-1 bg-black/40 rounded-full border border-game-neon-red/30 text-game-neon-red text-sm font-game-fallback hover:bg-black/60"
          >
            QUIT
          </button>
          <span className="text-white/70 font-game-fallback text-sm">
            {(gameState.category || "technology").toUpperCase()}
          </span>
        </div>

        <div className="lg:flex justify-center hidden">
          <h1 className="text-xl font-display text-game-neon-yellow tracking-wider animate-glow font-display-fallback">
            TREND GUESSER
          </h1>
        </div>
        <div className="flex lg:hidden"></div>

        <div className="flex items-center justify-end gap-3">
          <span className="text-white font-game-fallback">SCORE:</span>
          <span className="text-2xl text-game-neon-green font-bold font-game-fallback">
            {gameState.score || 0}
          </span>
        </div>
      </div>

      {/* Main game container - simplified layout */}
      <div className="flex-1 z-10 grid grid-rows-[1fr_auto_1fr] mb-12 sm:mb-0 h-[calc(100vh-124px)] sm:h-[calc(100vh-64px)]">
        {/* Top card (known term) */}
        <div className="flex items-center justify-center py-2 px-4 md:py-4">
          <div
            className={`w-full max-w-lg card-transition-wrapper `}
            id="higher-card"
          >
            <div
              className="w-full rounded-xl overflow-hidden shadow-xl relative h-[175px] md:h-[250px]"
              style={{
                backgroundImage: `url("${
                  gameState?.knownTerm?.imageUrl || ""
                }")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

              {/* Content */}
              <div className="relative p-4 flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-4 font-game-fallback">
                  {gameState?.knownTerm?.term || "Loading..."}
                </h3>

                <div className="text-center">
                  <p className="text-sm text-white/70 font-game-fallback mb-1">
                    Monthly Search Volume
                  </p>
                  <p className="text-4xl font-bold text-white font-game-fallback font-display">
                    {gameState?.knownTerm?.volume !== undefined
                      ? gameState.knownTerm.volume.toLocaleString()
                      : "..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle ribbon with buttons */}
        <div className="flex items-center justify-center bg-black/70 border-y border-white/10 py-4">
          <div className="flex justify-center items-center gap-6 w-full max-w-lg">
            <button
              onClick={() => handleGuess(false)}
              disabled={isGuessing}
              className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-red/70 text-game-neon-red font-bold font-game-fallback text-xl 
      hover:bg-black/90 hover:scale-105 hover:border-game-neon-red hover:shadow-[0_0_15px_rgba(255,0,68,0.5)] 
      active:scale-95 active:bg-black/100 active:shadow-[0_0_20px_rgba(255,0,68,0.7)]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:bg-black/60
      flex-1 max-w-42 text-center transition-all duration-200 ease-in-out"
            >
              FEWER
            </button>

            <button
              onClick={() => handleGuess(true)}
              disabled={isGuessing}
              className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-green/70 text-game-neon-green font-bold font-game-fallback text-xl 
      hover:bg-black/90 hover:scale-105 hover:border-game-neon-green hover:shadow-[0_0_15px_rgba(0,255,85,0.5)] 
      active:scale-95 active:bg-black/100 active:shadow-[0_0_20px_rgba(0,255,85,0.7)]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:bg-black/60
      flex-1 max-w-42 text-center transition-all duration-200 ease-in-out"
            >
             GREATER
            </button>
          </div>
        </div>

        {/* Bottom card (hidden term) */}
        {/* 
          IMPORTANT GAME LOGIC:
          - The hidden term's NAME is always visible to the player
          - The hidden term's IMAGE is always visible to the player
          - Only the VOLUME (search trend level) is hidden until revealed
          - This is what the player is trying to guess: whether this term's volume is higher or lower than the known term
        */}
        <div className="flex items-center justify-center py-2 px-4 md:py-4">
          <div
            className={`w-full max-w-lg card-transition-wrapper`}
            id="lower-card"
          >
            <div
              className="w-full rounded-xl overflow-hidden shadow-xl relative h-[175px] md:h-[250px]"
              style={{
                backgroundImage: `url("${
                  gameState?.hiddenTerm?.imageUrl || ""
                }")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

              {/* Content */}
              <div className="relative p-4 flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-4 font-game-fallback">
                  {gameState?.hiddenTerm?.term || "Loading..."}
                </h3>

                {/* Only show volume when showResult is true AND not transitioning */}
                {showResult &&
                !isInTransition &&
                !isTransitioning &&
                lastGuessCorrect !== null ? (
                  <div className="text-center volume-reveal">
                    <p className="text-sm text-white/70 font-game-fallback mb-1">
                      Monthly Search Volume
                    </p>
                    <p className="text-4xl font-bold text-white font-game-fallback font-display">
                      {gameState?.hiddenTerm?.volume !== undefined
                        ? gameState.hiddenTerm.volume.toLocaleString()
                        : "..."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <p className="text-sm text-white/70 font-game-fallback mb-1">
                      Monthly Search Volume
                    </p>
                    <div className="w-16 h-16 rounded-full border-4 border-game-neon-yellow flex items-center justify-center">
                      <span className="text-3xl font-bold text-game-neon-yellow">
                        ?
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Footer mini={true} />

        {/* Error message */}
        {error && !showResult && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-game-neon-red/20 border border-game-neon-red/50 rounded-lg text-white text-center max-w-xs z-50">
            {error}
          </div>
        )}
      </div>

      {/* FORCED Correct guess notification - guaranteed to show */}
      {forceNotification === "correct" && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]" style={{pointerEvents: 'none'}}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
          <div className="relative px-12 py-10 bg-game-neon-green/40 backdrop-blur-xl rounded-xl border-4 border-game-neon-green shadow-[0_0_50px_rgba(0,255,85,0.8)] text-game-neon-green font-bold text-6xl animate-bounce">
            {gameState?.hiddenTerm?.volume === gameState?.knownTerm?.volume ? (
              <span className="flex flex-col items-center">
                <span className="text-game-neon-yellow text-5xl">EQUAL VALUES!</span>
                <span className="text-xl font-normal mt-2 text-white">
                  Both answers are correct
                </span>
              </span>
            ) : (
              <span className="animate-pulse tracking-wider">CORRECT!</span>
            )}
          </div>
        </div>
      )}

      {/* FORCED Wrong answer notification - guaranteed to show */}
      {forceNotification === "wrong" && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]" style={{pointerEvents: 'none'}}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
          <div className="relative px-12 py-10 bg-game-neon-red/40 backdrop-blur-xl rounded-xl border-4 border-game-neon-red shadow-[0_0_50px_rgba(255,50,85,0.8)] text-game-neon-red font-bold text-6xl animate-bounce">
            WRONG!
          </div>
        </div>
      )}
      
      {/* Game Over dialog as an overlay with reset functionality */}
      {showGameOver && gameState && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200]">
          <div className="w-full max-w-md">
            <GameOver onClose={async () => {
              try {
                // Clean up the game state
                await endGame();
                setShowGameOver(false);
                // Redirect to game page to start fresh
                router.push("/game");
              } catch (error) {
                console.error("Error resetting game state:", error);
                // Even if there was an error, still redirect
                setShowGameOver(false);
                router.push("/game");
              }
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GameScreen;