import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { useAuth } from './AuthContext';
import { GameData, SearchCategory, TrendGuesserGameState, TrendGuesserPlayer, SearchTerm } from '@/types';
import { TrendGuesserService } from '@/lib/firebase/trendGuesserService';

interface GameContextType {
  gameId: string | null;
  gameData: GameData | null;
  loading: boolean;
  error: string | null;
  currentPlayer: TrendGuesserPlayer | null;
  gameState: TrendGuesserGameState | null;
  setGameId: (id: string) => void;
  startGame: (category: SearchCategory, customTerm?: string) => Promise<void>;
  makeGuess: (isHigher: boolean) => Promise<boolean>;
  endGame: () => Promise<void>;
  resetGame: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { userUid } = useAuth();
  
  // Use localStorage to persist gameId across page refreshes in development
  const getInitialGameId = () => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      return sessionStorage.getItem('current_game_id');
    }
    return null;
  };
  
  const [gameId, _setGameId] = useState<string | null>(getInitialGameId());
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<TrendGuesserGameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<TrendGuesserPlayer | null>(null);
  
  // Custom setter for gameId that also updates sessionStorage
  const setGameId = (id: string | null) => {
    console.log('Setting game ID to:', id);
    _setGameId(id);
    
    // Also update sessionStorage
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      if (id) {
        sessionStorage.setItem('current_game_id', id);
        console.log('Updated current_game_id in session storage:', id);
      } else {
        sessionStorage.removeItem('current_game_id');
        console.log('Removed current_game_id from session storage');
      }
    }
  };
  
  // Check for a stored game ID on initial load (for mock mode)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && !gameId) {
      if (typeof window !== 'undefined') {
        const storedGameId = sessionStorage.getItem('current_game_id');
        if (storedGameId) {
          console.log('Found stored game ID in session storage:', storedGameId);
          setGameId(storedGameId);
        }
      }
    }
  }, []);

  // Watch for changes to the game data
  useEffect(() => {
    if (!userUid) {
      setLoading(false);
      return;
    }
    
    // If game ID is not set, but we're in mock mode, try to get it from session storage
    if (!gameId && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      if (typeof window !== 'undefined') {
        const storedGameId = sessionStorage.getItem('current_game_id');
        if (storedGameId) {
          console.log('Using stored game ID from session storage:', storedGameId);
          setGameId(storedGameId);
          return; // This will trigger this useEffect again with the gameId
        }
      }
      setLoading(false);
      return;
    }
    
    if (!gameId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    console.log(`Setting up game data watcher for game ID: ${gameId}, user: ${userUid}`);
    
    // Check if using mock data
    if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      console.log('Using mock data in GameContext for game:', gameId);
      
      // Create function to check for game data in sessionStorage
      const checkMockGameData = () => {
        if (typeof window !== 'undefined') {
          const storedGameData = sessionStorage.getItem(`game_${gameId}`);
          if (storedGameData) {
            try {
              const data = JSON.parse(storedGameData) as GameData;
              console.log(`Found mock game data for ${gameId}:`, 
                data.status, 
                data['__trendguesser.state'] ? 'has game state' : 'no game state'
              );
              
              // Set game data
              setGameData(data);
              
              // Extract game state if it exists
              if (data['__trendguesser.state']) {
                const gameState = data['__trendguesser.state'] as TrendGuesserGameState;
                setGameState(gameState);
                
                // Check if game has started
                if (gameState.started) {
                  console.log(`Game ${gameId} is active with category:`, gameState.category);
                }
              }
              
              // Use the userUid or a mock ID
              const mockUserUid = sessionStorage.getItem('mock_user_uid') || userUid || 'mock_user';
              
              // Extract current player data
              if (data[mockUserUid]) {
                setCurrentPlayer(data[mockUserUid] as TrendGuesserPlayer);
                console.log(`Found player data for ${mockUserUid}, score:`, data[mockUserUid].score);
              } else if (data['mock_user']) {
                // Fallback to mock_user
                setCurrentPlayer(data['mock_user'] as TrendGuesserPlayer);
                console.log('Using fallback mock_user data');
              }
            } catch (err) {
              console.error('Error parsing mock game data:', err);
            }
          } else {
            console.log('No mock game data found for:', gameId);
          }
          
          setLoading(false);
        }
      };
      
      // Check immediately
      checkMockGameData();
      
      // Set up interval to check for changes (simulating Firestore's onSnapshot)
      const intervalId = setInterval(checkMockGameData, 500);
      
      return () => {
        console.log(`Cleaning up game data watcher for game ID: ${gameId}`);
        clearInterval(intervalId);
      };
    } else {
      // Regular Firestore implementation
      const gameRef = doc(db, 'games', gameId.toUpperCase());
      
      const unsubscribe = onSnapshot(
        gameRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data() as GameData;
            setGameData(data);
            
            // Extract game state if it exists
            if (data['__trendguesser.state']) {
              setGameState(data['__trendguesser.state'] as TrendGuesserGameState);
            }
            
            // Extract current player data
            if (data[userUid]) {
              setCurrentPlayer(data[userUid] as TrendGuesserPlayer);
            }
            
            setLoading(false);
          } else {
            setError('Game not found');
            setLoading(false);
          }
        },
        (err) => {
          console.error('Error watching game data:', err);
          setError('Error watching game data');
          setLoading(false);
        }
      );
      
      return () => unsubscribe();
    }
  }, [gameId, userUid]);
  
  // Start a new game
  const startGame = async (category: SearchCategory, customTerm?: string) => {
    if (!gameId || !userUid) {
      setError('No game ID or user ID');
      return;
    }
    
    try {
      setLoading(true);
      console.log(`Starting game with ID: ${gameId}, category: ${category}, customTerm: ${customTerm || 'none'}`);
      
      // When using mock data, make sure the current_game_id is set correctly before starting the game
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
        sessionStorage.setItem('current_game_id', gameId);
        console.log('Ensured current_game_id is set to:', gameId);
      }
      
      // Start the game
      await TrendGuesserService.startGame(gameId, category, customTerm);
      
      // Wait to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Log game state after starting
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
        const gameData = sessionStorage.getItem(`game_${gameId}`);
        if (gameData) {
          const parsedData = JSON.parse(gameData);
          console.log('Game data after starting:', parsedData);
          
          // If we have game state in session storage but not in context, update the context
          if (parsedData['__trendguesser.state'] && !gameState) {
            console.log('Updating game state from session storage');
            setGameState(parsedData['__trendguesser.state']);
          }
        } else {
          console.log('No game data found after starting game');
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error starting game:', error);
      setError('Failed to start game');
      setLoading(false);
    }
  };
  
  // Make a guess (higher or lower)
  const makeGuess = async (isHigher: boolean): Promise<boolean> => {
    if (!userUid) {
      setError('No user ID');
      return false;
    }
    
    // Get the current game ID from state or session storage
    let currentGameId = gameId;
    if (!currentGameId && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
      currentGameId = sessionStorage.getItem('current_game_id');
      if (currentGameId) {
        console.log('Using game ID from session storage for guess:', currentGameId);
        // Update the state to match
        setGameId(currentGameId);
      }
    }
    
    if (!currentGameId) {
      setError('No game ID available');
      return false;
    }
    
    try {
      // In mock mode, ensure the current game state is loaded properly
      if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined' && !gameState) {
        console.log('Loading game state from session storage before guess');
        const storedData = sessionStorage.getItem(`game_${currentGameId}`);
        if (storedData) {
          try {
            const parsedData = JSON.parse(storedData);
            if (parsedData['__trendguesser.state']) {
              setGameState(parsedData['__trendguesser.state']);
              console.log('Loaded game state from session storage');
            }
          } catch (e) {
            console.error('Error parsing stored game data:', e);
          }
        }
      }
      
      console.log(`Making guess (${isHigher ? 'HIGHER' : 'LOWER'}) for game:`, currentGameId);
      const result = await TrendGuesserService.makeGuess(currentGameId, userUid, isHigher);
      return result;
    } catch (error) {
      console.error('Error making guess:', error);
      setError('Failed to process guess: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return false;
    }
  };
  
  // End the game
  const endGame = async () => {
    if (!userUid || !currentPlayer) {
      setError('No user ID or player data');
      return;
    }
    
    // Get the current game ID from state or session storage
    let currentGameId = gameId;
    if (!currentGameId && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
      currentGameId = sessionStorage.getItem('current_game_id');
      if (currentGameId) {
        console.log('Using game ID from session storage for ending game:', currentGameId);
      }
    }
    
    if (!currentGameId) {
      console.warn('No game ID available for ending game, will still proceed with reset');
      return;
    }
    
    try {
      console.log('Ending game:', currentGameId, 'with score:', currentPlayer.score || 0);
      await TrendGuesserService.endGame(currentGameId, userUid, currentPlayer.score || 0);
    } catch (error) {
      console.error('Error ending game:', error);
      setError('Failed to end game');
      // Still proceed with resetting local state even if there was an error
    }
  };
  
  // Reset game state for a new game
  const resetGame = () => {
    console.log('Resetting game state');
    
    // Store game ID before clearing it
    const currentGameId = gameId;
    
    // Clear state
    setGameId(null);
    setGameData(null);
    setGameState(null);
    setCurrentPlayer(null);
    setError(null);
    
    // Clear any stored game data for this game if in mock mode
    if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' && typeof window !== 'undefined') {
      // Clear the current_game_id from session storage to avoid persistence issues
      sessionStorage.removeItem('current_game_id');
      console.log('Cleared current game ID from session storage');
      
      // Clear the game data if we had a gameId
      if (currentGameId) {
        sessionStorage.removeItem(`game_${currentGameId}`);
        console.log('Removed stored game data for:', currentGameId);
      }
    }
  };
  
  const value: GameContextType = {
    gameId,
    gameData,
    loading,
    error,
    currentPlayer,
    gameState,
    setGameId,
    startGame,
    makeGuess,
    endGame,
    resetGame
  };
  
  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export default GameContext;