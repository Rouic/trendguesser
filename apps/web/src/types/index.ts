// src/types/index.ts

// Auth Context Type
export interface AuthContextType {
  user: { uid: string; isAnonymous: boolean } | null;
  userUid: string | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Search term categories
export type SearchCategory = 
  | 'animals' 
  | 'celebrities' 
  | 'everything' 
  | 'latest' 
  | 'games' 
  | 'gaming'
  | 'sports'
  | 'entertainment'
  | 'news'
  | 'technology' 
  | 'snacks'
  | 'celebrities'
  | 'cars'
  | 'pets'
  | 'landmarks'
  | 'fashion'
  | 'questions' 
  | 'custom';

// Search term data
export interface SearchTerm {
  id: string;
  term: string;
  volume: number;
  category: SearchCategory;
  imageUrl?: string;
  timestamp?: string;
}

// TrendGuesser game state
export interface TrendGuesserGameState {
  gameId?: string;
  currentRound: number;
  knownTerm: SearchTerm;
  hiddenTerm: SearchTerm;
  category: SearchCategory;
  started: boolean;
  finished: boolean;
  winner?: string;
  customTerm?: string | null; // Must be string or null, not undefined
  usedTerms: string[];
  terms: SearchTerm[];
}

// Player data in TrendGuesser
export interface TrendGuesserPlayer {
  uid: string;
  name: string;
  score: number;
  highScores?: {
    [key in SearchCategory]?: number;
  };
}

// Overall game data structure
export interface GameData {
  id: string;
  createdAt: string;
  createdBy: string;
  gameType: 'trendguesser';
  status: 'waiting' | 'active' | 'finished' | 'inactive';
  [playerUid: string]: any;
  '__trendguesser.state'?: TrendGuesserGameState;
}