import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useGame } from '@/contexts/GameContext';
import { motion } from 'framer-motion';

const GameOver = () => {
  const router = useRouter();
  const { gameState, currentPlayer, resetGame } = useGame();
  
  // Handle return to category selection
  const handlePlayAgain = () => {
    resetGame();
    router.push('/game');
  };
  
  // Handle return to home
  const handleReturnHome = () => {
    resetGame();
    router.push('/');
  };
  
  if (!gameState) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
      {/* Game over content */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 15 }}
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
        
        <p className="text-white/80 text-center mb-8 font-game-fallback">
          {gameState.knownTerm.term} has {gameState.knownTerm.volume.toLocaleString()} searches, while {gameState.hiddenTerm.term} has {gameState.hiddenTerm.volume.toLocaleString()} searches.
        </p>
        
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