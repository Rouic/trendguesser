import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useGame } from "@/contexts/GameContext";
import { motion, AnimatePresence } from "framer-motion";
import { useWindowSize } from "@/hooks/useWindowSize";

const GameScreen = () => {
  const router = useRouter();
  const windowSize = useWindowSize();
  const {
    gameState,
    currentPlayer,
    gameId,
    makeGuess,
    endGame,
    resetGame,
    startGame,
    error: gameError,
  } = useGame();

  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(
    null
  );
  const [isGuessing, setIsGuessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);

  // Display any errors from the game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  // Debug logging for current game state
  useEffect(() => {
    if (gameState) {
      console.log("[GameScreen] Current game state:", {
        gameId,
        started: gameState.started,
        finished: gameState.finished,
        round: gameState.currentRound,
        category: gameState.category,
        knownTerm: gameState.knownTerm.term,
        hiddenTerm: gameState.hiddenTerm.term,
        remainingTerms: gameState.terms.length,
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

  // Handle player making a guess
  const handleGuess = async (isHigher: boolean) => {
    if (!gameState || isGuessing) return;

    setIsGuessing(true);
    setError(null);

    try {
      console.log(
        `[handleGuess] Making ${isHigher ? "HIGHER" : "LOWER"} guess...`
      );

      // Store the current game state values for comparison
      const currentRound = gameState.currentRound;
      const knownTermName = gameState.knownTerm.term;
      const knownTermVolume = gameState.knownTerm.volume;
      const hiddenTermName = gameState.hiddenTerm.term;
      const hiddenTermVolume = gameState.hiddenTerm.volume;

      console.log(`[handleGuess] Before makeGuess - Round ${currentRound}:`, {
        knownTerm: knownTermName,
        knownVolume: knownTermVolume,
        hiddenTerm: hiddenTermName,
        hiddenVolume: hiddenTermVolume,
      });

      // Determine if the guess should be correct for verification
      const actuallyHigher = hiddenTermVolume > knownTermVolume;
      const actuallyEqual = hiddenTermVolume === knownTermVolume;
      const shouldBeCorrect = actuallyEqual
        ? true
        : isHigher === actuallyHigher;

      console.log(`[handleGuess] Expected result:`, {
        actuallyHigher,
        actuallyEqual,
        userGuessedHigher: isHigher,
        shouldBeCorrect,
      });

      // Process the guess
      const result = await makeGuess(isHigher);

      console.log(`[handleGuess] After makeGuess:`, {
        result,
        isCorrect: result === true,
        newRound: gameState?.currentRound,
        gameFinished: gameState?.finished,
      });

      // Use the determined correct/incorrect status rather than trusting result directly
      if (result && shouldBeCorrect) {
        // Correct guess
        setLastGuessCorrect(true);
        setShowResult(true);

        // Simple delay before showing the next round
        setTimeout(() => {
          // First verify we still have a valid game state before hiding result
          if (gameState && !gameState.finished) {
            setShowResult(false);
            setLastGuessCorrect(null);
            setIsGuessing(false);
          }
        }, 1500);
      } else {
        // Wrong guess - game over
        setLastGuessCorrect(false);
        setShowResult(true);
      }
    } catch (err) {
      console.error("Error in handleGuess:", err);
      setError("Error processing guess. Please try again.");
      setIsGuessing(false);
      setShowResult(false);
      setLastGuessCorrect(null);
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

  const isDesktop = windowSize.width >= 768;

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

      {/* Main game container - simplified layout */}
      <div className="flex-1 grid grid-rows-[1fr_auto_1fr] h-[calc(100vh-64px)]">
        {/* Top card (known term) */}
        <div className="flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div
              className="w-full rounded-xl overflow-hidden shadow-xl relative h-[250px]"
              style={{
                backgroundImage: `url("${gameState.knownTerm.imageUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

              {/* Content */}
              <div className="relative p-4 flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-4 font-game-fallback">
                  {gameState.knownTerm.term}
                </h3>

                <div className="text-center">
                  <p className="text-sm text-white/70 font-game-fallback mb-1">
                    Monthly Search Volume
                  </p>
                  <p className="text-xl font-bold text-game-neon-blue font-game-fallback">
                    {gameState.knownTerm.volume.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle ribbon with buttons */}
        <div className="flex items-center justify-center bg-black/70 border-y border-white/10 py-4">
          <div className="flex justify-center items-center gap-6 w-full max-w-md">
            <button
              onClick={() => handleGuess(false)}
              disabled={isGuessing}
              className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-blue/70 text-game-neon-blue font-bold font-game-fallback text-xl hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed flex-1 max-w-36 text-center"
            >
              LOWER
            </button>

            <button
              onClick={() => handleGuess(true)}
              disabled={isGuessing}
              className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-green/70 text-game-neon-green font-bold font-game-fallback text-xl hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed flex-1 max-w-36 text-center"
            >
              HIGHER
            </button>
          </div>
        </div>

        {/* Bottom card (hidden term) */}
        <div className="flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div
              className="w-full rounded-xl overflow-hidden shadow-xl relative h-[250px]"
              style={{
                backgroundImage: `url("${gameState.hiddenTerm.imageUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

              {/* Content */}
              <div className="relative p-4 flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-4 font-game-fallback">
                  {gameState.hiddenTerm.term}
                </h3>

                {showResult ? (
                  <div className="text-center">
                    <p className="text-sm text-white/70 font-game-fallback mb-1">
                      Monthly Search Volume
                    </p>
                    <p className="text-xl font-bold text-game-neon-blue font-game-fallback">
                      {gameState.hiddenTerm.volume.toLocaleString()}
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
      </div>

      {/* Correct guess notification */}
      {showResult && lastGuessCorrect === true && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-4 bg-game-neon-green/20 backdrop-blur-md rounded-xl border border-game-neon-green/50 text-game-neon-green font-bold text-xl shadow-lg z-50">
          {gameState.hiddenTerm.volume === gameState.knownTerm.volume ? (
            <span>
              EQUAL VALUES!
              <br />
              <span className="text-sm font-normal">
                Both answers are correct
              </span>
            </span>
          ) : (
            "CORRECT!"
          )}
        </div>
      )}

      {/* Game over overlay */}
      {showResult && lastGuessCorrect === false && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-xl mx-4 overflow-hidden">
            {/* Game over header */}
            <div className="bg-game-neon-red/30 border-b-2 border-game-neon-red/50 p-6 text-center rounded-t-2xl">
              <h2 className="text-4xl font-bold text-game-neon-red font-game-fallback">
                GAME OVER!
              </h2>
              <p className="text-white text-xl mt-2 font-game-fallback">
                Final score: {currentPlayer?.score || 0}
              </p>
            </div>

            {/* Card comparison */}
            <div className="bg-black/60 flex flex-col gap-3 p-6">
              {/* Known term card */}
              <div className="rounded-xl overflow-hidden shadow-xl relative p-4 bg-black/40">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-white font-game-fallback">
                    {gameState.knownTerm.term}
                  </h3>
                  <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <p className="text-sm text-white/70 font-game-fallback">
                      Search Volume
                    </p>
                    <p className="text-xl font-bold text-game-neon-blue font-game-fallback text-center">
                      {gameState.knownTerm.volume.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparison indicator */}
              <div className="flex items-center justify-center gap-4 my-1">
                <div className="flex-1 h-px bg-white/20"></div>
                <div className="bg-game-neon-red/20 border border-game-neon-red/40 rounded-full px-5 py-2 font-bold text-white flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {/* Show what the correct answer would have been */}
                  {(() => {
                    const knownVolume = gameState.knownTerm.volume;
                    const hiddenVolume = gameState.hiddenTerm.volume;

                    if (hiddenVolume === knownVolume) {
                      return "EQUAL (either choice is correct)";
                    } else if (hiddenVolume > knownVolume) {
                      return "HIGHER was correct";
                    } else {
                      return "LOWER was correct";
                    }
                  })()}
                </div>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>

              {/* Hidden term card */}
              <div className="rounded-xl overflow-hidden shadow-xl relative p-4 bg-black/40">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-white font-game-fallback">
                    {gameState.hiddenTerm.term}
                  </h3>
                  <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <p className="text-sm text-white/70 font-game-fallback">
                      Search Volume
                    </p>
                    <p className="text-xl font-bold text-game-neon-yellow font-game-fallback text-center">
                      {gameState.hiddenTerm.volume.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Play again and category buttons */}
            <div className="p-6 bg-black/40 flex justify-center gap-4 rounded-b-2xl border-t border-white/10">
              <button
                onClick={() => {
                  endGame().then(() => {
                    // Restart the same category
                    const currentCategory = gameState.category;
                    resetGame();
                    setTimeout(() => {
                      startGame(currentCategory);
                    }, 100);
                  });
                }}
                className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-green/40 text-game-neon-green font-game-fallback hover:bg-black/80 hover:scale-105 transition-all duration-300"
              >
                Play Again
              </button>

              <button
                onClick={() => {
                  endGame().then(() => {
                    resetGame();
                    router.push("/game");
                  });
                }}
                className="px-6 py-3 bg-black/40 rounded-xl border border-white/30 text-white font-game-fallback hover:bg-black/80 hover:scale-105 transition-all duration-300"
              >
                Change Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && !showResult && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-game-neon-red/20 border border-game-neon-red/50 rounded-lg text-white text-center max-w-xs z-50">
          {error}
        </div>
      )}
    </div>
  );
};

export default GameScreen;
