import React from 'react';
import { GameProvider } from '@trendguesser/shared';
import { WebStorageService } from '@/services/WebStorageService'; 
import { WebApiService } from '@/services/WebApiService';
import { TrendGuesserService } from '@trendguesser/shared';
import { sampleSearchTerms, sampleLeaderboard } from '@/lib/mockData';
import { IPlayer, SearchTerm, SearchCategory } from '@trendguesser/shared';

interface WebGameContextAdapterProps {
  children: React.ReactNode;
}

// Create web-specific services
const storageService = new WebStorageService();
const apiService = new WebApiService();

// Helper to ensure a valid category
function ensureValidCategory(category: string): SearchCategory {
  const validCategories: SearchCategory[] = ['general', 'technology', 'entertainment', 'sports', 'custom'];
  if (validCategories.includes(category as SearchCategory)) {
    return category as SearchCategory;
  }
  return 'general';
}

// Adapt sample data types to shared types
const adaptedSampleTerms: SearchTerm[] = sampleSearchTerms.map(term => ({
  id: term.id,
  term: term.term,
  category: term.category,
  volume: term.volume,
  imageUrl: term.imageUrl,
  timestamp: term.timestamp
}));

const adaptedSampleLeaderboard: IPlayer[] = sampleLeaderboard.map(player => ({
  uid: player.uid,
  name: player.name,
  score: player.score,
  highScores: player.highScores
}));

// Create TrendGuesserService instance with web-specific implementations
const trendGuesserService = TrendGuesserService.getInstance(
  storageService,
  apiService,
  adaptedSampleTerms,
  adaptedSampleLeaderboard
);

export const WebGameContextAdapter: React.FC<WebGameContextAdapterProps> = ({ 
  children 
}) => {
  return (
    <GameProvider
      trendGuesserService={trendGuesserService}
      storage={storageService}
    >
      {children}
    </GameProvider>
  );
};

// Re-export the hook for easy access
export { useGameContext } from '@trendguesser/shared';