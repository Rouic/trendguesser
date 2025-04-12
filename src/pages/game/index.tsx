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
    loading: gameLoading 
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
      setIsCreatingGame(true);
      setError(null);
      
      if (!gameId) {
        // Create a new game if we don't have one yet
        const newGameId = await TrendGuesserService.createGame(
          userUid || 'anonymous',
          localName || 'Player'
        );
        
        setGameId(newGameId);
        
        // Start game with selected category
        await startGame(selectedCategory);
      } else {
        // If we already have a game, just start it with new category
        await startGame(selectedCategory);
      }
      
      setIsCreatingGame(false);
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
      setIsCreatingGame(true);
      setError(null);
      
      if (!gameId) {
        // Create a new game if we don't have one yet
        const newGameId = await TrendGuesserService.createGame(
          userUid || 'anonymous',
          localName || 'Player'
        );
        
        setGameId(newGameId);
        
        // Start game with custom term
        await startGame('custom', customTerm);
      } else {
        // If we already have a game, just start it with new custom term
        await startGame('custom', customTerm);
      }
      
      setIsCreatingGame(false);
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
    return <LoadingScreen message="Connecting..." />;
  }

  // Show loading screen while game is being created or loaded
  if (isCreatingGame || gameLoading) {
    return <LoadingScreen message="Setting up game..." />;
  }

  // Show game over screen if game is finished
  if (gameState?.finished) {
    return <GameOver />;
  }

  // Show game screen if game is active
  if (gameState?.started) {
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
            {error}
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