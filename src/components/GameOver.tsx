import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useGame } from "@/contexts/GameContext";
import { motion } from "framer-motion";

const GameOver = () => {
  const router = useRouter();
  const { gameState, currentPlayer, resetGame } = useGame();

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

        <p className="text-white text-xl mb-8 font-game-fallback text-center">
          You scored
        </p>

        <div className="flex items-center justify-center mb-8">
          <span className="text-6xl font-bold text-game-neon-green animate-pulse">
            {currentPlayer?.score || 0}
          </span>
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
