import React, { createContext, useContext, ReactNode } from 'react';
import { TrendGuesserService } from '@trendguesser/shared';
import { MobileStorageService } from './MobileStorageService';
import { MobileApiService } from './MobileApiService';

// Sample data
const sampleTerms = [
  { id: '1', term: 'iPhone', category: 'technology', volume: 85 },
  { id: '2', term: 'Climate Change', category: 'general', volume: 75 },
  { id: '3', term: 'NFT', category: 'technology', volume: 60 },
  { id: '4', term: 'COVID-19', category: 'general', volume: 95 },
  { id: '5', term: 'Taylor Swift', category: 'entertainment', volume: 90 },
  { id: '6', term: 'Bitcoin', category: 'technology', volume: 80 },
  { id: '7', term: 'World Cup', category: 'sports', volume: 88 },
  { id: '8', term: 'Marvel', category: 'entertainment', volume: 70 },
  { id: '9', term: 'PlayStation 5', category: 'technology', volume: 65 },
  { id: '10', term: 'Tesla', category: 'technology', volume: 78 }
];

const sampleLeaderboard = [
  { id: '1', name: 'Player 1', score: 120, date: '2025-04-15' },
  { id: '2', name: 'Player 2', score: 95, date: '2025-04-14' },
  { id: '3', name: 'Player 3', score: 87, date: '2025-04-16' },
  { id: '4', name: 'Player 4', score: 75, date: '2025-04-12' },
  { id: '5', name: 'Player 5', score: 68, date: '2025-04-10' }
];

// Create the service instance
const storageService = new MobileStorageService();
const apiService = new MobileApiService('https://api.trendguesser.com');

const trendGuesserService = TrendGuesserService.getInstance(
  storageService,
  apiService,
  sampleTerms,
  sampleLeaderboard
);

// Create a context for the service
const TrendGuesserServiceContext = createContext<TrendGuesserService | null>(null);

// Provider component
export const TrendGuesserServiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <TrendGuesserServiceContext.Provider value={trendGuesserService}>
      {children}
    </TrendGuesserServiceContext.Provider>
  );
};

// Hook for using the service
export const useTrendGuesserService = (): TrendGuesserService => {
  const context = useContext(TrendGuesserServiceContext);
  if (!context) {
    throw new Error('useTrendGuesserService must be used within a TrendGuesserServiceProvider');
  }
  return context;
};