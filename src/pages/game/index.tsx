import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { TrendGuesserService } from '@/lib/firebase/trendGuesserService';
import { SearchCategory } from '@/types';
import CategorySelection from '@/components/CategorySelection';
import GameScreen from '@/components/GameScreen';
import GameOver from '@/components/GameOver';
import CustomTermInput from '@/components/CustomTermInput';
import LoadingScreen from '@/components/LoadingScreen';

const GamePage = () => {
  const router = useRouter();
  const { user, userUid, loading: authLoading, signInAnonymously } = useAuth();
  const { 
    gameId, 
    setGameId, 
    gameState, 
    currentPlayer, 
    startGame, 
    loading: gameLoading,
    resetGame
  } = useGame();
  
  const [localName, setLocalName] = useState('');
  const [category, setCategory] = useState<SearchCategory | null>(null);
  const [customTerm, setCustomTerm] = useState('');
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle auth on page load
  useEffect(() => {
    if (!user && !authLoading) {
      signInAnonymously();
    }
  }, [user, authLoading, signInAnonymously]);

  // Create a new game when user selects a category
  const handleCategorySelect = async (selectedCategory: SearchCategory) => {
    if (selectedCategory === 'custom') {
      setCategory(selectedCategory);
      return;
    }
    
    try {
      // Show loading screen 
      setIsCreatingGame(true);
      setError(null);
      
      // Reset any existing game state first
      if (gameState) {
        resetGame();
      }
      
      // Create a new game
      console.log('Creating new game...');
      const newGameId = await TrendGuesserService.createGame(
        userUid || 'anonymous',
        localName || 'Player'
      );
      
      console.log('Game created with ID:', newGameId);
      setGameId(newGameId);
        
      // The game ID must be set before calling startGame to ensure state tracking consistency
      console.log('Setting game ID in context:', newGameId);
      
      // Wait for the game ID to be set in the context
      await new Promise(resolve => {
        setGameId(newGameId);
        setTimeout(resolve, 100); // Small delay to ensure state update
      });
      
      // Start game with selected category - this sets up the game state
      console.log('Starting game with category:', selectedCategory, 'for game ID:', newGameId);
      await startGame(selectedCategory);
      
      // Check if game state was properly set up
      console.log('Current game state after starting:', gameState);
      
      // In mock mode, we need to force a check for game state
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
        const storedData = sessionStorage.getItem(`game_${newGameId}`);
        if (storedData) {
          const data = JSON.parse(storedData);
          if (data['__trendguesser.state'] && data['__trendguesser.state'].started) {
            console.log('Game successfully started from session storage');
          } else {
            console.log('Game data exists but not started yet');
          }
        } else {
          console.log('No game data found in session storage');
        }
      }
      
      // In mock mode, ensure the current game ID is saved to session storage
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
        const currentGameId = sessionStorage.getItem('current_game_id');
        console.log('Current game ID from session storage:', currentGameId);
        
        if (currentGameId !== newGameId) {
          console.log('Current game ID mismatch, updating to:', newGameId);
          sessionStorage.setItem('current_game_id', newGameId);
        }
      }
      
      // Give the game state time to update, then check the game state again
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Game state after delay:', gameState);
      
      // Check for the game data directly from session storage if in mock mode
      let gameStateFromStorage = null;
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
        const storedData = sessionStorage.getItem(`game_${newGameId}`);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          gameStateFromStorage = parsedData['__trendguesser.state'];
          console.log('Game state from storage after delay:', gameStateFromStorage);
        }
      }
      
      // Only hide loading if we have game data (either from context or storage)
      if (gameState?.started || gameStateFromStorage?.started) {
        console.log('Game started successfully, hiding loading screen');
        setIsCreatingGame(false);
      } else {
        console.log('Game state not ready yet, retrying...');
        
        // Try one more time after a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check game state from context again
        if (gameState?.started) {
          console.log('Game started on second attempt from context');
          setIsCreatingGame(false);
          return;
        }
        
        // Check storage one more time if in mock mode
        if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
          const storedData = sessionStorage.getItem(`game_${newGameId}`);
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            gameStateFromStorage = parsedData['__trendguesser.state'];
            if (gameStateFromStorage?.started) {
              console.log('Game started on second attempt from storage');
              // Force update the game context with the data from storage
              setGameId(newGameId);
              setIsCreatingGame(false);
              return;
            }
          }
        }
        
        console.log('Game failed to start, showing error');
        setError('Game failed to start properly. Please try again.');
        setIsCreatingGame(false);
      }
    } catch (error) {
      console.error('Error creating game:', error);
      setError('Failed to create game. Please try again.');
      setIsCreatingGame(false);
    }
  };

  // Handle custom term submission
  const handleCustomTermSubmit = async () => {
    if (!customTerm.trim()) {
      setError('Please enter a search term');
      return;
    }
    
    try {
      // Show loading screen
      setIsCreatingGame(true);
      setError(null);
      
      // Reset any existing game state first
      if (gameState) {
        resetGame();
      }
      
      // Create a new game
      console.log('Creating new custom game...');
      const newGameId = await TrendGuesserService.createGame(
        userUid || 'anonymous',
        localName || 'Player'
      );
      
      console.log('Game created with ID:', newGameId);
      setGameId(newGameId);
      
      // The game ID must be set before calling startGame to ensure state tracking consistency
      console.log('Setting game ID in context for custom term:', newGameId);
      
      // Wait for the game ID to be set in the context
      await new Promise(resolve => {
        setGameId(newGameId);
        setTimeout(resolve, 100); // Small delay to ensure state update
      });
      
      // Start game with custom term
      console.log('Starting game with custom term:', customTerm, 'for game ID:', newGameId);
      await startGame('custom', customTerm);
      
      // Check if game state was properly set up
      console.log('Current game state after starting custom game:', gameState);
      
      // In mock mode, ensure the current game ID is saved to session storage
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
        const currentGameId = sessionStorage.getItem('current_game_id');
        console.log('Current game ID from session storage (custom term):', currentGameId);
        
        if (currentGameId !== newGameId) {
          console.log('Current game ID mismatch, updating to:', newGameId);
          sessionStorage.setItem('current_game_id', newGameId);
        }
      }
      
      // Give the game state time to update, then check the game state again
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('Game state after delay (custom term):', gameState);
      
      // Check for the game data directly from session storage if in mock mode
      let gameStateFromStorage = null;
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
        const storedData = sessionStorage.getItem(`game_${newGameId}`);
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          gameStateFromStorage = parsedData['__trendguesser.state'];
          console.log('Custom game state from storage after delay:', gameStateFromStorage);
        }
      }
      
      // Only hide loading if we have game data (either from context or storage)
      if (gameState?.started || gameStateFromStorage?.started) {
        console.log('Custom game started successfully, hiding loading screen');
        setIsCreatingGame(false);
      } else {
        console.log('Custom game state not ready yet, retrying...');
        
        // Try one more time after a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check game state from context again
        if (gameState?.started) {
          console.log('Custom game started on second attempt from context');
          setIsCreatingGame(false);
          return;
        }
        
        // Check storage one more time if in mock mode
        if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
          const storedData = sessionStorage.getItem(`game_${newGameId}`);
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            gameStateFromStorage = parsedData['__trendguesser.state'];
            if (gameStateFromStorage?.started) {
              console.log('Custom game started on second attempt from storage');
              // Force update the game context with the data from storage
              setGameId(newGameId);
              setIsCreatingGame(false);
              return;
            }
          }
        }
        
        console.log('Custom game failed to start, showing error');
        setError('Game failed to start properly. Please try again.');
        setIsCreatingGame(false);
      }
    } catch (error) {
      console.error('Error creating custom game:', error);
      setError('Failed to create game. Please try again.');
      setIsCreatingGame(false);
    }
  };

  // Handle name change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  };

  // Show loading screen while auth is loading
  if (authLoading) {
    return <LoadingScreen message="Connecting to game" />;
  }

  // Show loading screen while game is being created or loaded
  if (isCreatingGame || gameLoading) {
    return <LoadingScreen message="Setting up your game" />;
  }

  // Show game over screen if game is finished
  if (gameState?.finished) {
    return <GameOver />;
  }

  // Show game screen if game is active
  if (gameState?.started) {
    console.log('Rendering game screen with game state:', 
      gameState.category, 
      gameState.currentRound, 
      'Known Term:', gameState.knownTerm.term, 
      'Hidden Term:', gameState.hiddenTerm.term
    );
    return <GameScreen />;
  }

  // Show custom term input if custom category selected
  if (category === 'custom') {
    return (
      <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
        <Head>
          <title>TrendGuesser - Custom Term</title>
        </Head>
        
        <CustomTermInput 
          value={customTerm}
          onChange={(e) => setCustomTerm(e.target.value)}
          onSubmit={handleCustomTermSubmit}
          error={error}
        />
        
        <button
          onClick={() => setCategory(null)}
          className="mt-4 px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-red/30 text-game-neon-red font-game-fallback hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-red-sm"
        >
          Back to Categories
        </button>
      </div>
    );
  }

  // Show category selection by default
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
      <Head>
        <title>TrendGuesser - Choose Category</title>
      </Head>
      
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-display text-game-neon-blue tracking-wider mb-2 animate-glow font-display-fallback">
            TRENDGUESSER
          </h1>
          <p className="text-xl text-white mb-6 font-game-fallback">
            Choose a category to start
          </p>
          
          <div className="mb-6">
            <input
              type="text"
              value={localName}
              onChange={handleNameChange}
              placeholder="Your Name (optional)"
              className="w-full px-4 py-2 rounded-lg bg-black/40 border border-game-neon-blue/30 text-white font-game-fallback focus:outline-none focus:ring-2 focus:ring-game-neon-blue/50"
            />
          </div>
        </div>
        
        <CategorySelection onSelect={handleCategorySelect} />
        
        {error && (
          <div className="mt-4 p-3 bg-game-neon-red/20 border border-game-neon-red/40 rounded-lg text-white text-center">
            <div className="mb-2">{error}</div>
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    console.log('Manually retrying game start from error state');
                    
                    // Check if we have a current_game_id
                    const currentGameId = sessionStorage.getItem('current_game_id');
                    if (currentGameId) {
                      console.log('Found current game ID:', currentGameId);
                      // Check if this game has game state
                      const gameData = sessionStorage.getItem(`game_${currentGameId}`);
                      if (gameData) {
                        try {
                          const parsedData = JSON.parse(gameData);
                          if (parsedData['__trendguesser.state']) {
                            // We have game state, let's apply it
                            console.log('Found game state for current game, applying to context');
                            setGameId(currentGameId);
                            setError(null);
                          } else {
                            console.log('No game state found in current game data');
                          }
                        } catch (e) {
                          console.error('Error parsing game data:', e);
                        }
                      }
                    }
                  }
                }}
                className="px-4 py-1 bg-black/40 rounded-full border border-white/20 text-white text-sm hover:bg-black/60 mt-2"
              >
                Retry
              </button>
            )}
          </div>
        )}
        
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-yellow/30 text-game-neon-yellow font-game-fallback hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-yellow-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default GamePage;