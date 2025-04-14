// src/types/index.ts
import { User } from 'firebase/auth';
import { DocumentData, Timestamp, FieldValue } from 'firebase/firestore';

// Auth Context Type
export interface AuthContextType {
  user: User | null;
  userUid: string | null;
  loading: boolean;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Card types (from original app)
export interface Test {
  id: string;
  question: string;
  answer: string;
  imageUrl: string;
  audioUrl: string;
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
  timestamp?: Timestamp | FieldValue;
}

// TrendGuesser game state
export interface TrendGuesserGameState {
  currentRound: number;
  knownTerm: SearchTerm;
  hiddenTerm: SearchTerm;
  category: SearchCategory;
  started: boolean;
  finished: boolean;
  winner?: string;
  customTerm: string | null; // Must be string or null, not undefined
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
export interface GameData extends DocumentData {
  id: string;
  createdAt: Timestamp | FieldValue;
  createdBy: string;
  gameType: 'trendguesser';
  status: 'waiting' | 'active' | 'finished' | 'inactive';
  [playerUid: string]: any;
  '__trendguesser.state'?: TrendGuesserGameState;
}