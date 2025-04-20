import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useGame } from "@/contexts/GameContext";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { TrendGuesserService } from "@/lib/trendGuesserService";

const GameOver = () => {
  const router = useRouter();
  const { gameState, currentPlayer, resetGame, loadHighScores, endGame } =
    useGame();
  const { userUid, playerName } = useAuth();
  const [highScore, setHighScore] = useState<number | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const hasLoadedHighScores = useRef(false);

  // Load high scores
  useEffect(() => {
    if (gameState && currentPlayer && !hasLoadedHighScores.current) {
      // Only try to load once
      hasLoadedHighScores.current = true;
      console.log("GameOver: Loading high scores");

      // Call the optimized loadHighScores
      loadHighScores();
    }
  }, [gameState, currentPlayer, loadHighScores]);

  // Set local high score state based on currentPlayer high scores
useEffect(() => {
  if (gameState?.category && currentPlayer) {
    const category = gameState.category;
    const currentScore = currentPlayer.score || 0;

    console.log(
      `GameOver: Checking high score for ${category} with current score ${currentScore}`
    );

    // IMPROVED APPROACH: First check localStorage directly for the most up-to-date data
    if (typeof window !== "undefined" && userUid) {
      try {
        const highScoresKey = `tg_highscores_${userUid}`;
        const storedScores = localStorage.getItem(highScoresKey);

        if (storedScores) {
          const parsedScores = JSON.parse(storedScores);
          const storedHighScore = parsedScores[category] || 0;

          // Use this as our primary source of truth
          setHighScore(storedHighScore);
          setIsNewHighScore(currentScore > storedHighScore);
          console.log(
            `Found high score in localStorage: ${storedHighScore} for category ${category}. Is new high score: ${
              currentScore > storedHighScore
            }`
          );
          return; // Exit early if we found data in localStorage
        }
      } catch (e) {
        console.error("Error checking localStorage high scores:", e);
      }
    }

    // Fall back to checking currentPlayer if localStorage didn't have data
    const playerHighScore = currentPlayer.highScores?.[category] || 0;
    setHighScore(playerHighScore);
    setIsNewHighScore(currentScore > playerHighScore);
    console.log(
      `Using player state high score: ${playerHighScore}. Is new high score: ${
        currentScore > playerHighScore
      }`
    );

    // If the current score is higher than the high score we found, ensure it's saved
    if (currentScore > playerHighScore) {
      console.log(
        `Current score ${currentScore} is higher than recorded high score ${playerHighScore}. Updating...`
      );

      // Update high score in localStorage to ensure UI is consistent
      if (typeof window !== "undefined" && userUid) {
        try {
          const highScoresKey = `tg_highscores_${userUid}`;
          let existingScores = {};

          const storedScores = localStorage.getItem(highScoresKey);
          if (storedScores) {
            existingScores = JSON.parse(storedScores);
          }

          existingScores[category] = currentScore;
          localStorage.setItem(highScoresKey, JSON.stringify(existingScores));
          console.log(`Updated high score in localStorage to ${currentScore}`);

          // Manually update our state to reflect this
          setHighScore(currentScore);
          setIsNewHighScore(true);

          // Also ensure it's saved to the server via the service
          const playerToUse =
            sessionStorage.getItem("mock_user_uid") || userUid;
          if (playerToUse) {
            console.log(
              `Saving high score to server for player ${playerToUse}`
            );
            TrendGuesserService.updateHighScore(
              playerToUse,
              gameState.category,
              currentScore
            ).catch((err) =>
              console.error("Error updating high score from GameOver:", err)
            );
          }
        } catch (e) {
          console.error("Error updating localStorage high scores:", e);
        }
      }
    }
  }
}, [gameState?.category, currentPlayer, userUid]);

  // Handle return to category selection
  const handlePlayAgain = async () => {
    // Ensure high score is saved before resetting
    try {
      if (
        gameState?.category &&
        currentPlayer?.score &&
        currentPlayer.score > 0
      ) {
        console.log(
          `Ensuring high score is saved before play again: ${currentPlayer.score} in ${gameState.category}`
        );
        const mockUserUid = sessionStorage.getItem("mock_user_uid") || userUid;
        const playerToUse = mockUserUid || userUid;

        if (playerToUse) {
          // Try both localStorage and API update to ensure consistency

          // 1. Force update local high scores in localStorage first (for immediate UI feedback)
          const highScoresKey = `tg_highscores_${playerToUse}`;
          let existingScores = {};

          try {
            // Get existing high scores
            const storedScores = localStorage.getItem(highScoresKey);
            if (storedScores) {
              existingScores = JSON.parse(storedScores);
            }

            // Only update if new score is higher
            const currentHighScore = existingScores[gameState.category] || 0;
            if (currentPlayer.score > currentHighScore) {
              // Update with new high score
              const updatedScores = {
                ...existingScores,
                [gameState.category]: currentPlayer.score,
              };

              // Save to localStorage immediately
              localStorage.setItem(
                highScoresKey,
                JSON.stringify(updatedScores)
              );
              console.log(
                `Updated local high score for ${gameState.category} to ${currentPlayer.score}`
              );

              // Trigger storage event for other components to react
              window.dispatchEvent(new Event("storage"));
            }
          } catch (e) {
            console.error("Error updating local high scores:", e);
          }

          // 2. Also make the API call to update server-side - make sure to await it
          await TrendGuesserService.updateHighScore(
            playerToUse,
            gameState.category,
            currentPlayer.score,
            playerName // Pass the player name from auth context
          ).catch((err) =>
            console.error("Error saving final high score for play again:", err)
          );
        }
      }
    } catch (e) {
      console.error(
        "Error during pre-reset high score save for play again:",
        e
      );
    }

    resetGame();
    router.push("/game");
  };

  // Handle return to home
  const handleReturnHome = () => {
    // Ensure high score is saved before going home
    try {
      if (
        gameState?.category &&
        currentPlayer?.score &&
        currentPlayer.score > 0
      ) {
        console.log(
          `Ensuring high score is saved before going home: ${currentPlayer.score} in ${gameState.category}`
        );
        const mockUserUid = sessionStorage.getItem("mock_user_uid") || userUid;
        const playerToUse = mockUserUid || userUid;
        if (playerToUse) {
          // Force update local high scores in localStorage first (for immediate UI feedback)
          const highScoresKey = `tg_highscores_${playerToUse}`;
          let existingScores = {};

          try {
            // Get existing high scores
            const storedScores = localStorage.getItem(highScoresKey);
            if (storedScores) {
              existingScores = JSON.parse(storedScores);
            }

            // Only update if new score is higher
            const currentHighScore = existingScores[gameState.category] || 0;
            if (currentPlayer.score > currentHighScore) {
              // Update with new high score
              const updatedScores = {
                ...existingScores,
                [gameState.category]: currentPlayer.score,
              };

              // Save to localStorage immediately
              localStorage.setItem(
                highScoresKey,
                JSON.stringify(updatedScores)
              );
              console.log(
                `Updated local high score for ${gameState.category} to ${currentPlayer.score}`
              );

              // Trigger storage event for other components to react
              window.dispatchEvent(new Event("storage"));
            }
          } catch (e) {
            console.error("Error updating local high scores:", e);
          }

          // Also make the API call to update server-side
          TrendGuesserService.updateHighScore(
            playerToUse,
            gameState.category,
            currentPlayer.score,
            playerName
          ).catch((err) =>
            console.error(
              "Error saving final high score before going home:",
              err
            )
          );
        }
      }
    } catch (e) {
      console.error(
        "Error during pre-reset high score save before going home:",
        e
      );
    }

    resetGame();
    router.push("/");
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-black/40 rounded-xl border border-white/20 p-6 text-center">
          <h2 className="text-2xl font-display text-game-neon-red mb-4">
            Game Data Not Found
          </h2>
          <p className="text-white mb-4">
            Unable to load game data. Please return to the categories and try
            again.
          </p>
          <button
            onClick={() => {
              resetGame();
              router.push("/game");
            }}
            className="px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-blue/30 text-game-neon-blue font-game-fallback hover:bg-black/50 hover:scale-105 transition-all duration-300"
          >
            Back to Categories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Game over content */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="w-full max-w-md bg-black/40 backdrop-blur-lg rounded-3xl p-8 border border-white/10 flex flex-col items-center"
      >
        <h1 className="text-4xl text-game-neon-red font-display mb-2 animate-glow">
          GAME OVER
        </h1>

        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-game-neon-red/50 to-transparent mb-6"></div>

        <p className="text-white text-xl mb-2 font-game-fallback text-center">
          You scored
        </p>

        <div className="flex items-center justify-center mb-4">
          <span className="text-6xl font-bold text-game-neon-green animate-pulse">
            {currentPlayer?.score || 0}
          </span>
        </div>

        {/* High score section */}
        <div className="flex flex-col items-center justify-center mb-8">
          {isNewHighScore ? (
            <div className="bg-game-neon-yellow/20 border border-game-neon-yellow/50 rounded-xl px-4 py-2 text-game-neon-yellow mb-2">
              <span className="text-xl font-bold">NEW HIGH SCORE!</span>
            </div>
          ) : highScore !== null ? (
            <div className="text-white/80 font-game-fallback">
              <span>
                Your high score for {gameState?.category}: {highScore}
              </span>
            </div>
          ) : (
            <div className="h-6"></div>
          )}
        </div>

        {gameState.knownTerm && gameState.hiddenTerm && (
          <div className="w-full bg-black/30 p-4 rounded-xl border border-white/10 mb-8">
            <h3 className="text-xl text-game-neon-yellow font-game-fallback mb-3 text-center">
              Final Comparison
            </h3>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-white font-game-fallback">
                  {gameState.knownTerm.term}
                </span>
                <span className="text-game-neon-blue font-game-fallback">
                  {gameState.knownTerm.volume.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white font-game-fallback">
                  {gameState.hiddenTerm.term}
                </span>
                <span className="text-game-neon-blue font-game-fallback">
                  {gameState.hiddenTerm.volume.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col w-full gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePlayAgain}
            className="w-full py-3 bg-game-neon-blue/20 backdrop-blur-sm rounded-xl border border-game-neon-blue/50 text-game-neon-blue font-game-fallback hover:bg-game-neon-blue/30 transition-colors shadow-neon-blue-sm"
          >
            Play Again
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReturnHome}
            className="w-full py-3 bg-black/40 backdrop-blur-sm rounded-xl border border-white/20 text-white/80 font-game-fallback hover:bg-black/60 transition-colors"
          >
            Return Home
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default GameOver;
