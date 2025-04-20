import React from 'react';
import { GameProvider } from '@trendguesser/shared';
import { useTrendGuesserService } from '../services/TrendGuesserServiceProvider';
import { MobileStorageService } from '../services/MobileStorageService';

interface GameContextProviderProps {
  children: React.ReactNode;
}

// Storage service instance for game context
const storageService = new MobileStorageService();

export const GameContextProvider: React.FC<GameContextProviderProps> = ({ children }) => {
  const trendGuesserService = useTrendGuesserService();
  
  return (
    <GameProvider 
      trendGuesserService={trendGuesserService}
      storage={storageService}
    >
      {children}
    </GameProvider>
  );
};

// Re-export the hook from shared package for convenience
export { useGameContext } from '@trendguesser/shared';