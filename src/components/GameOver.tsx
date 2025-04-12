import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useGame } from "@/contexts/GameContext";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const GameOver = () => {
  const router = useRouter();
  const { gameState, currentPlayer, resetGame, loadHighScores, endGame } =
    useGame();
  const { userUid } = useAuth();
  const [highScore, setHighScore] = useState<number | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Load high scores and check if current score is a new high score
  useEffect(() => {
    const loadScores = async () => {
      if (gameState && currentPlayer) {
        console.log("GameOver: Loading high scores first...");
        // Ensure high scores are loaded
        await loadHighScores();

        // Now check if we have high scores for this category
        if (typeof window !== "undefined" && userUid && gameState.category) {
          // Directly check localStorage for most up-to-date data
          const highScoresKey = `tg_highscores_${userUid}`;
          const storedScores = localStorage.getItem(highScoresKey);

          let loadedHighScore = 0;
          if (storedScores) {
            try {
              const parsedScores = JSON.parse(storedScores);
              loadedHighScore = parsedScores[gameState.category] || 0;
              console.log(
                `GameOver: Loaded high score from localStorage: ${loadedHighScore}`
              );
            } catch (e) {
              console.error(
                "GameOver: Error parsing high scores from localStorage:",
                e
              );
            }
          } else {
            console.log(
              "GameOver: No high scores found in localStorage, checking currentPlayer"
            );
            // Fallback to currentPlayer's high scores if available
            if (
              currentPlayer.highScores &&
              currentPlayer.highScores[gameState.category]
            ) {
              loadedHighScore =
                currentPlayer.highScores[gameState.category] || 0;
              console.log(
                `GameOver: Loaded high score from currentPlayer: ${loadedHighScore}`
              );
            }
          }

          const currentScore = currentPlayer.score || 0;
          console.log(
            `GameOver: Current score: ${currentScore}, High score: ${loadedHighScore}`
          );

          setHighScore(loadedHighScore);
          setIsNewHighScore(currentScore > loadedHighScore);

          // If this is a new high score, explicitly save it again to ensure it's properly saved
          if (currentScore > loadedHighScore) {
            console.log(
              `GameOver: New high score detected (${currentScore} > ${loadedHighScore}), performing direct update`
            );

            try {
              // Import the necessary Firestore functions
              const { getDoc, setDoc, updateDoc, doc } = await import(
                "firebase/firestore"
              );

              // Use the existing Firebase setup
              const { db } = await import("@/lib/firebase/firebase");

              if (!db) {
                console.error("GameOver: Firestore instance not available");
                return;
              }

              // Update the player document directly
              const playerRef = doc(db, "players", userUid);

              // First, try to get the current document
              console.log("GameOver: Getting current player document");
              const playerDoc = await getDoc(playerRef);

              if (playerDoc.exists()) {
                console.log(
                  "GameOver: Player document exists, updating high score"
                );
                const playerData = playerDoc.data();
                const existingHighScores = playerData.highScores || {};

                console.log(
                  "GameOver: Current high scores:",
                  existingHighScores
                );

                // Create updated high scores object with all existing scores preserved
                const updatedHighScores = {
                  ...existingHighScores,
                  [gameState.category]: currentScore,
                };

                console.log(
                  "GameOver: Updating with new high scores:",
                  updatedHighScores
                );

                // Update using updateDoc for an atomic update
                await updateDoc(playerRef, {
                  highScores: updatedHighScores,
                });

                console.log(
                  `GameOver: Successfully updated high score in Firestore to ${currentScore}`
                );

                // Verify the update
                const verifyDoc = await getDoc(playerRef);
                if (verifyDoc.exists()) {
                  console.log(
                    "GameOver: Verified updated high scores:",
                    verifyDoc.data().highScores
                  );
                }

                // Also update localStorage for immediate UI feedback
                const highScoresKey = `tg_highscores_${userUid}`;
                localStorage.setItem(
                  highScoresKey,
                  JSON.stringify(updatedHighScores)
                );
                console.log(
                  "GameOver: Updated localStorage with new high score"
                );

                // Trigger storage event to notify other components
                window.dispatchEvent(new Event("storage"));
              } else {
                console.log(
                  "GameOver: Player document doesn't exist, creating new one"
                );

                // Create a new player document with this high score
                await setDoc(playerRef, {
                  uid: userUid,
                  name: currentPlayer?.name || "Player",
                  highScores: {
                    [gameState.category]: currentScore,
                  },
                });

                console.log(
                  `GameOver: Created new player document with high score ${currentScore}`
                );

                // Update localStorage
                const highScoresKey = `tg_highscores_${userUid}`;
                localStorage.setItem(
                  highScoresKey,
                  JSON.stringify({
                    [gameState.category]: currentScore,
                  })
                );
              }
            } catch (err) {
              console.error(
                "GameOver: Error during direct Firestore update:",
                err
              );
            }
          }

          console.log(
            `GameOver: Is new high score: ${currentScore > loadedHighScore}`
          );
        } else {
          // If no high scores exist yet, any score is a new high score
          console.log(
            "GameOver: Missing required data - marking as new high score"
          );
          setIsNewHighScore(true);
        }
      }
    };

    loadScores();
  }, [gameState, currentPlayer, loadHighScores, userUid, endGame]);

  // Handle return to category selection
  const handlePlayAgain = () => {
    resetGame();
    router.push("/game");
  };

  // Handle return to home
  const handleReturnHome = () => {
    resetGame();
    router.push("/");
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
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
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
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
