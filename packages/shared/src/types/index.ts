// Shared type definitions for both web and mobile versions

export interface SearchTerm {
  id: string;
  term: string;
  category: string; // Keep as string for compatibility
  volume: number;
  imageUrl?: string;
  timestamp?: string;
}

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
  | 'cars'
  | 'pets'
  | 'landmarks'
  | 'fashion'
  | 'questions' 
  | 'custom'
  | 'general';

export interface GameState {
  gameId: string;
  score: number;
  round: number;
  knownTerm: SearchTerm | null;
  hiddenTerm: SearchTerm | null;
  category: SearchCategory;
  finished: boolean;
  highScore: boolean;
}

export interface IPlayer {
  id?: string;  // Make optional to handle both platforms
  uid?: string; // Support the uid field from web version
  name: string;
  score: number;
  date?: string; // Make optional
  timestamp?: string; // Alternative date field
  highScores?: Record<string, number>; // Support high scores object
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TermsResponse {
  terms: SearchTerm[];
  totalReturned: number;
  hasMore: boolean;
  lastId: string | null;
}