import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useGame } from '@/contexts/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import SearchTermCard from './SearchTermCard';

const GameScreen = () => {
  const router = useRouter();
  const { gameState, currentPlayer, gameId, makeGuess, endGame, resetGame, error: gameError } = useGame();
  
  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(null);
  const [isGuessing, setIsGuessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Display any errors from the game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);
  
  // Log current game state when it changes
  useEffect(() => {
    if (gameState) {
      console.log('GameScreen: Current game state:', 
        { 
          gameId, 
          started: gameState.started,
          round: gameState.currentRound,
          category: gameState.category,
          knownTerm: gameState.knownTerm.term,
          hiddenTerm: gameState.hiddenTerm.term
        }
      );
    }
  }, [gameState, gameId]);
  
  // Handle player making a guess
  const handleGuess = async (isHigher: boolean) => {
    if (!gameState || isGuessing) return;
    
    setIsGuessing(true);
    setError(null);
    
    try {
      console.log(`Making ${isHigher ? 'HIGHER' : 'LOWER'} guess...`);
      
      // Process the guess
      const result = await makeGuess(isHigher);
      console.log('Guess result:', result);
      setLastGuessCorrect(result);
      
      // Show the result animation
      setShowResult(true);
      
      // Hide result after 2 seconds if guess was correct
      if (result) {
        setTimeout(() => {
          setShowResult(false);
          setLastGuessCorrect(null);
          setIsGuessing(false);
        }, 2000);
      }
    } catch (err) {
      console.error('Error in handleGuess:', err);
      setError('Error processing guess. Please try again.');
      setIsGuessing(false);
    }
  };
  
  // Handle player quitting the game
  const handleQuit = async () => {
    await endGame();
    resetGame();
    router.push('/game');
  };
  
  if (!gameState) {
    return (
      <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-black/40 rounded-xl border border-white/20 p-6 text-center">
          <h2 className="text-2xl font-display text-game-neon-blue mb-4">Game Not Found</h2>
          <p className="text-white mb-4">
            Unable to load the game state. Please return to the categories and try again.
          </p>
          {error && (
            <div className="mb-4 p-3 bg-game-neon-red/20 border border-game-neon-red/40 rounded-lg text-white text-sm overflow-auto">
              {error}
            </div>
          )}
          <button
            onClick={() => {
              resetGame();
              router.push('/game');
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
          <SearchTermCard 
            term={gameState.knownTerm} 
            showVolume={true} 
            position="top"
          />
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
          <SearchTermCard 
            term={gameState.hiddenTerm} 
            showVolume={showResult} 
            position="bottom"
          />
        </div>
      </div>
      
      {/* Result overlay */}
      <AnimatePresence>
        {showResult && (
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
              transition={{ type: 'spring', damping: 15 }}
              className={`p-8 rounded-2xl ${lastGuessCorrect ? 'bg-game-neon-green/20 border-2 border-game-neon-green/50' : 'bg-game-neon-red/20 border-2 border-game-neon-red/50'} flex flex-col items-center justify-center text-center max-w-md mx-4`}
            >
              <h2 className={`text-4xl font-bold mb-4 ${lastGuessCorrect ? 'text-game-neon-green' : 'text-game-neon-red'}`}>
                {lastGuessCorrect ? 'CORRECT!' : 'GAME OVER!'}
              </h2>
              
              <p className="text-white text-xl mb-6 font-game-fallback">
                {lastGuessCorrect 
                  ? 'Great guess! Keep going...' 
                  : `Final score: ${currentPlayer?.score || 0}`}
              </p>
              
              {!lastGuessCorrect && (
                <button
                  onClick={() => {
                    // Reset the game and go back to game selection
                    endGame().then(() => {
                      resetGame();
                      router.push('/game');
                    });
                  }}
                  className="px-8 py-3 bg-black/60 rounded-xl border border-white/30 text-white font-game-fallback hover:bg-black/80 hover:scale-105 transition-all duration-300"
                >
                  Play Again
                </button>
              )}
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