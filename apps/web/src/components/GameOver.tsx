import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useGameContext } from "@/contexts/WebGameContextAdapter";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { TrendGuesserService } from "@/lib/trendGuesserService";
import type { TrendGuesserPlayer } from "@/types";

interface GameOverProps {
  onClose?: () => void; // Optional callback for when the component should be closed
}

const GameOver: React.FC<GameOverProps> = ({ onClose }) => {
  const router = useRouter();
  const { gameState, endGame } = useGameContext();
  const { userUid, playerName } = useAuth();
  const [currentPlayer, setCurrentPlayer] = useState<TrendGuesserPlayer | null>(null);
  const [highScore, setHighScore] = useState<number | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const hasLoadedHighScores = useRef(false);

  // Load high scores and ensure we have the most accurate game state
  useEffect(() => {
    if (gameState && userUid && !hasLoadedHighScores.current) {
      // Only try to load once
      hasLoadedHighScores.current = true;
      console.log("GameOver: Loading high scores and current player data");

      // IMPORTANT: First try to get the most up-to-date game state from localStorage
      // This ensures we have the correct final score
      if (typeof window !== 'undefined') {
        try {
          // Get current game ID from session storage
          const gameId = sessionStorage.getItem('current_game_id');
          if (gameId) {
            const localStateKey = `tg_local_state_${gameId}`;
            const localStateJson = localStorage.getItem(localStateKey);
            
            if (localStateJson) {
              const localStateData = JSON.parse(localStateJson);
              if (localStateData.gameState && localStateData.gameOver) {
                console.log("GameOver: Found preserved final game state in localStorage");
                
                // Use this game state's score for the current player if available
                const finalGameState = localStateData.gameState;
                if (finalGameState.score !== undefined) {
                  // Create a player object with this score
                  const playerWithFinalScore = {
                    uid: userUid,
                    name: sessionStorage.getItem('player_name') || 'Player',
                    score: finalGameState.score,
                    highScores: {}
                  };
                  setCurrentPlayer(playerWithFinalScore);
                  console.log("GameOver: Using final score from preserved game state:", finalGameState.score);
                }
              }
            }
          }
        } catch (e) {
          console.error("GameOver: Error accessing preserved game state:", e);
        }
        
        // As a fallback, still try to get player data from localStorage
        const playerDataKey = `tg_player_${userUid}`;
        const storedPlayerData = localStorage.getItem(playerDataKey);
        
        if (storedPlayerData && !currentPlayer) {
          try {
            const playerData = JSON.parse(storedPlayerData);
            setCurrentPlayer(playerData);
            console.log("GameOver: Using player data from localStorage:", playerData.score);
          } catch (e) {
            console.error("GameOver: Error parsing player data:", e);
          }
        }
      }
    }
  }, [gameState, userUid, currentPlayer]);

  // Set local high score state based on currentPlayer high scores
  useEffect(() => {
    if (gameState?.category && currentPlayer) {
      const category = gameState.category;
      const currentScore = currentPlayer.score || 0;
      const highScores = currentPlayer.highScores || {};
      const categoryHighScore = highScores[category] || 0;

      // Set state to trigger appropriate UI rendering
      setHighScore(categoryHighScore);
      setIsNewHighScore(currentScore > categoryHighScore);

      // Log high score comparison
      console.log(
        `Current score: ${currentScore}, Category high score: ${categoryHighScore}, Is new high score: ${
          currentScore > categoryHighScore
        }`
      );
    }
  }, [gameState, currentPlayer]);

  // Track if the game is finished and update high scores
  useEffect(() => {
    // Only run this effect when we have game state and current player
    if (
      gameState?.finished &&
      currentPlayer &&
      gameState.category &&
      typeof currentPlayer.score === "number"
    ) {
      const currentScore = currentPlayer.score;
      const category = gameState.category;

      // Get current high score for this category
      const currentHighScores = currentPlayer.highScores || {};
      const playerHighScore = currentHighScores[category] || 0;

      console.log(
        `Current score: ${currentScore}, Player high score: ${playerHighScore}`
      );

      // If current score is higher than high score, update high score
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
                gameState.category as any, // Cast for compatibility
                currentScore
              ).catch((err) =>
                console.error("Error updating high score from GameOver:", err)
              );
            }
          } catch (e) {
            console.error("Error updating local high scores:", e);
          }
        }
      }
    }
  }, [gameState, currentPlayer, userUid]);

  // Handle play again
  const handlePlayAgain = useCallback(async () => {
    console.log("Starting new game with same category");
    if (gameState) {
      try {
        // Always end the current game first to reset state
        await endGame();
        
        // Use onClose callback if provided, otherwise redirect
        if (onClose) {
          onClose();
        } else {
          router.push("/game");
        }
      } catch (error) {
        console.error("Error restarting game:", error);
        // Even if there's an error, try to navigate anyway
        if (onClose) {
          onClose();
        } else {
          router.push("/game");
        }
      }
    }
  }, [gameState, router, onClose, endGame]);

  // Handle go home
  const handleGoHome = async () => {
    console.log("Going home");
    
    // Save high score before going home if needed
    try {
      if (
        gameState?.category &&
        currentPlayer?.score &&
        currentPlayer.score > 0
      ) {
        console.log(
          `Ensuring high score is saved before going home: ${currentPlayer.score} in ${gameState.category}`
        );
        
        // Save to localStorage for persistence
        if (typeof window !== "undefined" && userUid) {
          try {
            const highScoresKey = `tg_highscores_${userUid}`;
            let existingScores = {};
            
            const storedScores = localStorage.getItem(highScoresKey);
            if (storedScores) {
              existingScores = JSON.parse(storedScores);
            }
            
            // Only update if current score is higher than existing high score
            const currentHighScore = existingScores[gameState.category] || 0;
            if (currentPlayer.score > currentHighScore) {
              existingScores[gameState.category] = currentPlayer.score;
              localStorage.setItem(
                highScoresKey,
                JSON.stringify(existingScores)
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
          const playerToUse = sessionStorage.getItem("mock_user_uid") || userUid;
          TrendGuesserService.updateHighScore(
            playerToUse,
            gameState.category as any, // Type cast for compatibility
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

    // Always end the current game to reset state
    try {
      await endGame();
      console.log("Game ended successfully before going home");
    } catch (error) {
      console.error("Error ending game before going home:", error);
    }

    // Use the callback to close the modal first, then navigate
    if (onClose) {
      onClose();
      setTimeout(() => router.push("/"), 100);
    } else {
      router.push("/");
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-white p-8 rounded-lg backdrop-filter backdrop-blur-md bg-black/40 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-center">Game not found</h1>
          <p className="mb-4">Sorry, we couldn't find the game data.</p>
          <button
            onClick={() => router.push("/")}
            className="w-full px-4 py-2 bg-gradient-to-r from-game-neon-blue to-game-neon-purple rounded-full text-white hover:opacity-90 transition-all duration-300"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const score = currentPlayer?.score || 0;
  const category = gameState.category;

  return (
    <div className="min-h-screen overflow-hidden relative flex flex-col items-center justify-center p-4">
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

      {/* Game over content */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="w-full max-w-md bg-black/40 backdrop-blur-lg rounded-3xl p-8 border border-white/10 flex flex-col items-center z-10"
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
            {score}
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
                Your high score for {category || "this category"}: {highScore}
              </span>
            </div>
          ) : (
            <div className="h-6"></div>
          )}
        </div>

        {gameState?.knownTerm && gameState?.hiddenTerm && (
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
            onClick={handleGoHome}
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