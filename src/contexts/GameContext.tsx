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
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { userUid } = useAuth();
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<TrendGuesserGameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<TrendGuesserPlayer | null>(null);
  
  // Watch for changes to the game data
  useEffect(() => {
    if (!gameId || !userUid) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
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
  }, [gameId, userUid]);
  
  // Start a new game
  const startGame = async (category: SearchCategory, customTerm?: string) => {
    if (!gameId || !userUid) {
      setError('No game ID or user ID');
      return;
    }
    
    try {
      setLoading(true);
      await TrendGuesserService.startGame(gameId, category, customTerm);
      setLoading(false);
    } catch (error) {
      console.error('Error starting game:', error);
      setError('Failed to start game');
      setLoading(false);
    }
  };
  
  // Make a guess (higher or lower)
  const makeGuess = async (isHigher: boolean): Promise<boolean> => {
    if (!gameId || !userUid) {
      setError('No game ID or user ID');
      return false;
    }
    
    try {
      const result = await TrendGuesserService.makeGuess(gameId, userUid, isHigher);
      return result;
    } catch (error) {
      console.error('Error making guess:', error);
      setError('Failed to process guess');
      return false;
    }
  };
  
  // End the game
  const endGame = async () => {
    if (!gameId || !userUid || !currentPlayer) {
      setError('No game ID, user ID or player data');
      return;
    }
    
    try {
      await TrendGuesserService.endGame(gameId, userUid, currentPlayer.score || 0);
    } catch (error) {
      console.error('Error ending game:', error);
      setError('Failed to end game');
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
    endGame
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