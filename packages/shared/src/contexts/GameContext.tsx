import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SearchCategory, SearchTerm, GameState, IPlayer } from '../types';
import { TrendGuesserService, IStorage, IApiService } from '../lib/trendGuesserService';

interface GameContextProps {
  gameState: GameState | null;
  loading: boolean;
  error: string | null;
  playerId: string;
  playerName: string;
  startGame: (category: SearchCategory, customTerm?: string) => Promise<void>;
  makeGuess: (isHigher: boolean) => Promise<boolean>;
  endGame: () => Promise<void>;
  setPlayerName: (name: string) => void;
}

// Create context with default values
const GameContext = createContext<GameContextProps>({
  gameState: null,
  loading: false,
  error: null,
  playerId: '',
  playerName: 'Player',
  startGame: async () => {},
  makeGuess: async () => false,
  endGame: async () => {},
  setPlayerName: () => {},
});

interface GameProviderProps {
  children: ReactNode;
  trendGuesserService: TrendGuesserService;
  storage: IStorage;
}

export const GameProvider: React.FC<GameProviderProps> = ({ 
  children, 
  trendGuesserService,
  storage
}) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('Player');
  const [gameId, setGameId] = useState<string>('');

  // Helper function to ensure a valid category
  function ensureValidCategory(category: string): SearchCategory {
    const validCategories: SearchCategory[] = ['general', 'technology', 'entertainment', 'sports', 'custom'];
    if (validCategories.includes(category as SearchCategory)) {
      return category as SearchCategory;
    }
    return 'general';
  }

  // Initialize player data on mount
  useEffect(() => {
    const initPlayer = async () => {
      try {
        // Try to load player ID from storage
        const storedPlayerId = await storage.getItem('tg_player_id');
        if (storedPlayerId) {
          setPlayerId(storedPlayerId);
        } else {
          // Create a new player ID if none exists
          const newPlayerId = uuidv4();
          await storage.setItem('tg_player_id', newPlayerId);
          setPlayerId(newPlayerId);
        }

        // Try to load player name
        const storedPlayerName = await storage.getItem('tg_player_name');
        if (storedPlayerName) {
          setPlayerName(storedPlayerName);
        }
      } catch (err) {
        console.error('Error initializing player data:', err);
        // Use defaults if storage fails
        setPlayerId(uuidv4());
        setPlayerName('Player');
      }
    };

    initPlayer();
  }, [storage]);

  // Start a new game
  const startGame = async (category: SearchCategory, customTerm?: string) => {
    setLoading(true);
    setError(null);

    try {
      // Create a new game
      const newGameId = await trendGuesserService.createGame(playerId, playerName);
      setGameId(newGameId);
      
      // Initialize game state
      const initialGameState = await trendGuesserService.startGame(newGameId, category, customTerm);
      
      if (initialGameState) {
        setGameState(initialGameState);
      } else {
        throw new Error('Failed to initialize game state');
      }
    } catch (err) {
      console.error('Error starting game:', err);
      setError('Failed to start game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Make a guess
  const makeGuess = async (isHigher: boolean): Promise<boolean> => {
    if (!gameState || !gameId) {
      setError('No active game. Please start a new game.');
      return false;
    }

    setLoading(true);
    try {
      const result = await trendGuesserService.makeGuess(gameId, playerId, isHigher);
      
      // Get updated game state from local storage
      const localStateKey = `tg_local_state_${gameId}`;
      const localStateJson = await storage.getItem(localStateKey);
      
      if (localStateJson) {
        const localStateData = JSON.parse(localStateJson);
        if (localStateData.gameState) {
          setGameState(localStateData.gameState);
        }
      }
      
      return result;
    } catch (err) {
      console.error('Error making guess:', err);
      setError('Failed to process your guess. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // End the current game
  const endGame = async (): Promise<void> => {
    if (!gameState || !gameId) {
      return;
    }

    try {
      await trendGuesserService.endGame(gameId, playerId, gameState.score);
      setGameState(null);
      setGameId('');
    } catch (err) {
      console.error('Error ending game:', err);
      setError('Failed to end game properly.');
    }
  };

  // Update player name
  const updatePlayerName = async (name: string) => {
    setPlayerName(name);
    try {
      await storage.setItem('tg_player_name', name);
    } catch (err) {
      console.error('Error saving player name:', err);
    }
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        loading,
        error,
        playerId,
        playerName,
        startGame,
        makeGuess,
        endGame,
        setPlayerName: updatePlayerName,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

// Hook for using the game context
export const useGameContext = () => useContext(GameContext);