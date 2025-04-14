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
  const { userUid } = useAuth();
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

      // Get high score from currentPlayer after it's been loaded
      const playerHighScore = currentPlayer.highScores?.[category] || 0;

      // Update the local state
      setHighScore(playerHighScore);

      // Determine if this is a new high score
      setIsNewHighScore(currentScore > playerHighScore);

      // Also check localStorage as a backup source of truth
      if (typeof window !== "undefined" && userUid) {
        try {
          const highScoresKey = `tg_highscores_${userUid}`;
          const storedScores = localStorage.getItem(highScoresKey);

          if (storedScores) {
            const parsedScores = JSON.parse(storedScores);
            const storedHighScore = parsedScores[category] || 0;

            // If localStorage has a different (higher) value, use that instead
            if (storedHighScore > playerHighScore) {
              setHighScore(storedHighScore);
              setIsNewHighScore(currentScore > storedHighScore);
            }
          }
        } catch (e) {
          console.error("Error checking localStorage high scores:", e);
        }
      }

      // If the current score is higher than the high score we found,
      // this might be a case where the high score wasn't properly saved
      // Let's ensure it's properly reflected in UI
      if (currentScore > playerHighScore) {
        console.log(
          `Current score ${currentScore} is higher than recorded high score ${playerHighScore}`
        );
        setIsNewHighScore(true);
      }
    }
  }, [gameState?.category, currentPlayer, userUid]);

  // Handle return to category selection
  const handlePlayAgain = () => {
    // Ensure high score is saved before resetting
    try {
      if (gameState?.category && currentPlayer?.score && currentPlayer.score > 0) {
        console.log(`Ensuring high score is saved before play again: ${currentPlayer.score} in ${gameState.category}`);
        const mockUserUid = sessionStorage.getItem('mock_user_uid') || userUid;
        const playerToUse = mockUserUid || userUid;
        if (playerToUse) {
          // Import from trendGuesserService to call directly
          TrendGuesserService.updateHighScore(
            playerToUse,
            gameState.category,
            currentPlayer.score
          ).catch(err => console.error("Error saving final high score for play again:", err));
        }
      }
    } catch (e) {
      console.error("Error during pre-reset high score save for play again:", e);
    }
    
    resetGame();
    router.push("/game");
  };

  // Handle return to home
  const handleReturnHome = () => {
    // Ensure high score is saved before going home
    try {
      if (gameState?.category && currentPlayer?.score && currentPlayer.score > 0) {
        console.log(`Ensuring high score is saved before going home: ${currentPlayer.score} in ${gameState.category}`);
        const mockUserUid = sessionStorage.getItem('mock_user_uid') || userUid;
        const playerToUse = mockUserUid || userUid;
        if (playerToUse) {
          // Import from trendGuesserService to call directly
          TrendGuesserService.updateHighScore(
            playerToUse,
            gameState.category,
            currentPlayer.score
          ).catch(err => console.error("Error saving final high score before going home:", err));
        }
      }
    } catch (e) {
      console.error("Error during pre-reset high score save before going home:", e);
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
