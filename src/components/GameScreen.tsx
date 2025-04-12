import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useGame } from "@/contexts/GameContext";
import { motion, AnimatePresence } from "framer-motion";
import SearchTermCard from "./SearchTermCard";

const GameScreen = () => {
  const router = useRouter();
  const {
    gameState,
    currentPlayer,
    gameId,
    makeGuess,
    endGame,
    resetGame,
    error: gameError,
  } = useGame();

  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(null);
  const [isGuessing, setIsGuessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Display any errors from the game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  // Log current game state when it changes
  useEffect(() => {
    if (gameState) {
      console.log("GameScreen: Current game state:", {
        gameId,
        started: gameState.started,
        round: gameState.currentRound,
        category: gameState.category,
        knownTerm: gameState.knownTerm.term,
        hiddenTerm: gameState.hiddenTerm.term,
      });
    }
  }, [gameState, gameId]);

  // Attempt to recover from missing game state
  useEffect(() => {
    if (!gameState && !recoveryAttempted) {
      setRecoveryAttempted(true);

      if (
        process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
        typeof window !== "undefined"
      ) {
        console.log("Attempting to recover game state from session storage...");

        // Get the current game ID
        const currentGameId = sessionStorage.getItem("current_game_id");
        if (!currentGameId) {
          setError("Game session not found. Please start a new game.");
          return;
        }

        // Get the game data
        const gameData = sessionStorage.getItem(`game_${currentGameId}`);
        if (!gameData) {
          setError("Game data not found. Please start a new game.");
          return;
        }

        try {
          const parsedData = JSON.parse(gameData);
          if (
            !parsedData["__trendguesser.state"] ||
            !parsedData["__trendguesser.state"].started
          ) {
            setError("Game not properly initialized. Please start a new game.");
            return;
          }

          // If we found valid game data, suggest refreshing the page
          setError(
            "Game state disrupted. Please refresh the page to continue or start a new game."
          );
        } catch (e) {
          console.error("Error recovering game state:", e);
          setError("Error loading game data. Please start a new game.");
        }
      } else {
        setError("Game state not found. Please start a new game.");
      }
    }
  }, [gameState, recoveryAttempted]);

  // Get the next term that will be revealed (if available)
  const getNextTerm = useMemo(() => {
    if (!gameState || !gameState.terms || gameState.terms.length === 0) {
      return null;
    }
    return gameState.terms[0];
  }, [gameState]);

  // Handle correct guess animation
  const handleCorrectGuess = () => {
    // Show success notification
    setShowResult(true);
    
    // Start animation after a brief delay
    setTimeout(() => {
      setIsAnimating(true);
      
      // Hide success notification after 500ms
      setTimeout(() => {
        setShowResult(false);
      }, 500);
      
      // Complete animation and reset states after 1000ms
      setTimeout(() => {
        setIsAnimating(false);
        setLastGuessCorrect(null);
        setIsGuessing(false);
      }, 1000);
    }, 300);
  };

  // Handle player making a guess
  const handleGuess = async (isHigher: boolean) => {
    if (!gameState || isGuessing) return;

    setIsGuessing(true);
    setError(null);

    try {
      console.log(`Making ${isHigher ? "HIGHER" : "LOWER"} guess...`);

      // Process the guess
      const result = await makeGuess(isHigher);
      console.log("Guess result:", result);
      setLastGuessCorrect(result);

      if (result) {
        // Handle successful guess with new animation
        handleCorrectGuess();
      } else {
        // For incorrect guess, show the game over screen
        setShowResult(true);
      }
    } catch (err) {
      console.error("Error in handleGuess:", err);
      setError("Error processing guess. Please try again.");
      setIsGuessing(false);
    }
  };

  // Function to handle retry when an error occurs
  const handleRetry = useCallback(() => {
    if (
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
      typeof window !== "undefined"
    ) {
      const currentGameId = sessionStorage.getItem("current_game_id");
      if (currentGameId) {
        // Redirect to the game page to let it handle recovery
        router.push("/game");
      } else {
        resetGame();
        router.push("/game");
      }
    } else {
      resetGame();
      router.push("/game");
    }
  }, [resetGame, router]);

  // Handle player quitting the game
  const handleQuit = async () => {
    await endGame();
    resetGame();
    router.push("/game");
  };

  // No game state - show error
  if (!gameState) {
    return (
      <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-black/40 rounded-xl border border-white/20 p-6 text-center">
          <h2 className="text-2xl font-display text-game-neon-blue mb-4">
            Game Not Found
          </h2>
          <p className="text-white mb-4">
            Unable to load the game state. Please return to the categories and
            try again.
          </p>
          {error && (
            <div className="mb-4 p-3 bg-game-neon-red/20 border border-game-neon-red/40 rounded-lg text-white text-sm overflow-auto">
              {error}
            </div>
          )}
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-blue/30 text-game-neon-blue font-game-fallback hover:bg-black/50 hover:scale-105 transition-all duration-300"
          >
            Back to Categories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-game-bg flex flex-col">
      {/* Top bar with score */}
      <div className="p-4 bg-black/30 backdrop-blur-sm flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-white font-game-fallback">SCORE:</span>
          <span className="text-2xl text-game-neon-green font-bold font-game-fallback">
            {currentPlayer?.score || 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white/70 font-game-fallback text-sm">
            {gameState.category.toUpperCase()}
          </span>
          <button
            onClick={handleQuit}
            className="px-4 py-1 bg-black/40 rounded-full border border-game-neon-red/30 text-game-neon-red text-sm font-game-fallback hover:bg-black/60"
          >
            QUIT
          </button>
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 flex flex-col">
        {/* Known term - top half */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 relative overflow-hidden">
          <div className="w-full max-w-7xl mx-auto relative">
            {/* Current top card */}
            <SearchTermCard
              term={gameState.knownTerm}
              showVolume={true}
              position="top"
            />
            
            {/* Next top card (will be visible after animation) */}
            {isAnimating && getNextTerm && (
              <SearchTermCard
                term={gameState.hiddenTerm}
                showVolume={true}
                position="top"
                isNext={true}
              />
            )}
          </div>
        </div>

        {/* Higher/Lower buttons - middle */}
        <div className="py-6 flex justify-center items-center gap-6 relative z-10 bg-black/40 border-y border-white/10 backdrop-blur-sm">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleGuess(false)}
            disabled={isGuessing}
            className="px-8 py-4 bg-black/60 backdrop-blur-sm rounded-xl border-2 border-game-neon-blue/70 text-game-neon-blue font-bold font-game-fallback text-xl hover:bg-black/80 shadow-neon-blue-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            LOWER
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleGuess(true)}
            disabled={isGuessing}
            className="px-8 py-4 bg-black/60 backdrop-blur-sm rounded-xl border-2 border-game-neon-green/70 text-game-neon-green font-bold font-game-fallback text-xl hover:bg-black/80 shadow-neon-green-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            HIGHER
          </motion.button>
        </div>

        {/* Hidden term - bottom half */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 relative overflow-hidden">
          <div className="w-full max-w-7xl mx-auto relative">
            {/* Current bottom card */}
            <SearchTermCard
              term={gameState.hiddenTerm}
              showVolume={showResult}
              position="bottom"
            />
            
            {/* Next bottom card (preloaded) */}
            {!isAnimating && getNextTerm && (
              <SearchTermCard
                term={getNextTerm}
                showVolume={false}
                position="bottom"
                isNext={true}
              />
            )}
          </div>
        </div>
      </div>

      {/* Correct guess notification (smaller, less intrusive) */}
      <AnimatePresence>
        {showResult && lastGuessCorrect && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-4 bg-game-neon-green/20 backdrop-blur-md rounded-xl border border-game-neon-green/50 text-game-neon-green font-bold text-xl shadow-lg z-50"
          >
            CORRECT!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game over overlay */}
      <AnimatePresence>
        {showResult && lastGuessCorrect === false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="p-8 rounded-2xl bg-game-neon-red/20 border-2 border-game-neon-red/50 flex flex-col items-center justify-center text-center max-w-md mx-4"
            >
              <h2 className="text-4xl font-bold mb-4 text-game-neon-red">
                GAME OVER!
              </h2>

              <p className="text-white text-xl mb-6 font-game-fallback">
                Final score: {currentPlayer?.score || 0}
              </p>

              <div className="flex flex-col items-center mb-6">
                <p className="text-white text-lg mb-2 font-game-fallback">
                  <span className="text-game-neon-blue font-bold">
                    {gameState.knownTerm.term}:
                  </span>{" "}
                  {gameState.knownTerm.volume.toLocaleString()}
                </p>
                <p className="text-white text-lg font-game-fallback">
                  <span className="text-game-neon-yellow font-bold">
                    {gameState.hiddenTerm.term}:
                  </span>{" "}
                  {gameState.hiddenTerm.volume.toLocaleString()}
                </p>
              </div>

              <button
                onClick={() => {
                  // Reset the game and go back to game selection
                  endGame().then(() => {
                    resetGame();
                    router.push("/game");
                  });
                }}
                className="px-8 py-3 bg-black/60 rounded-xl border border-white/30 text-white font-game-fallback hover:bg-black/80 hover:scale-105 transition-all duration-300"
              >
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {error && !showResult && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-game-neon-red/20 border border-game-neon-red/50 rounded-lg text-white text-center max-w-xs">
          {error}
        </div>
      )}
    </div>
  );
};

export default GameScreen;