//mockData.ts

import { SearchTerm, TrendGuesserPlayer } from '@/types';
import { Timestamp } from 'firebase/firestore';

import { ImageConfig } from '@/utils/imageUtils';

/**
 * For mock data, we need to use a synchronous version that doesn't make actual API calls
 * This creates deterministic URLs that mimic what the Pexels images would look like
 */
const getMockImageUrl = (term: string): string => {
  // Create a deterministic hash from the term
  const hash = term.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
  
  // Create a deterministic Pexels photo ID between 1 and 1000
  const photoId = Math.abs(hash % 1000) + 1;
  
  // Return a mock Pexels URL with deterministic width/height
  // Note: These aren't real Pexels URLs, just mocks for development
  return `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=800&h=600`;
};


// Sample search terms for development
export const sampleSearchTerms: SearchTerm[] = [
  {
    id: 'term1',
    term: 'Artificial Intelligence',
    volume: 850000,
    category: 'technology',
    imageUrl: getMockImageUrl('artificial intelligence technology'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term2',
    term: 'Machine Learning',
    volume: 650000,
    category: 'technology',
    imageUrl: getMockImageUrl('machine learning code'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term3',
    term: 'Blockchain',
    volume: 450000,
    category: 'technology',
    imageUrl: getMockImageUrl('blockchain digital'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term4',
    term: 'PlayStation 5',
    volume: 950000,
    category: 'gaming',
    imageUrl: getMockImageUrl('playstation 5 console'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term5',
    term: 'Xbox Series X',
    volume: 750000,
    category: 'gaming',
    imageUrl: getMockImageUrl('xbox series x console'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term6',
    term: 'Elden Ring',
    volume: 550000,
    category: 'gaming',
    imageUrl: getMockImageUrl('elden ring game'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term7',
    term: 'Taylor Swift',
    volume: 1000000,
    category: 'entertainment',
    imageUrl: getMockImageUrl('taylor swift concert'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term8',
    term: 'Dune Part 2',
    volume: 700000,
    category: 'entertainment',
    imageUrl: getMockImageUrl('dune movie desert'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term9',
    term: 'Stranger Things',
    volume: 500000,
    category: 'entertainment',
    imageUrl: getMockImageUrl('stranger things tv show'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term10',
    term: 'Climate Change',
    volume: 900000,
    category: 'news',
    imageUrl: getMockImageUrl('climate change earth'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term11',
    term: 'COVID-19',
    volume: 600000,
    category: 'news',
    imageUrl: getMockImageUrl('covid healthcare mask'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term12',
    term: 'US Elections',
    volume: 800000,
    category: 'news',
    imageUrl: getMockImageUrl('us election voting'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term13',
    term: 'NBA Playoffs',
    volume: 850000,
    category: 'sports',
    imageUrl: getMockImageUrl('nba basketball game'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term14',
    term: 'World Cup',
    volume: 950000,
    category: 'sports',
    imageUrl: getMockImageUrl('soccer world cup'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term15',
    term: 'Formula 1',
    volume: 750000,
    category: 'sports',
    imageUrl: getMockImageUrl('formula 1 racing'),
    timestamp: Timestamp.now()
  },
  // Additional terms for better diversity in categories
  {
    id: 'term16',
    term: 'Giraffes',
    volume: 250000,
    category: 'animals',
    imageUrl: getMockImageUrl('giraffe wildlife'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term17',
    term: 'Pandas',
    volume: 420000,
    category: 'animals',
    imageUrl: getMockImageUrl('panda bear'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term18',
    term: 'Dolphins',
    volume: 380000,
    category: 'animals',
    imageUrl: getMockImageUrl('dolphin ocean'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term19',
    term: 'Dogs',
    volume: 890000,
    category: 'animals',
    imageUrl: getMockImageUrl('dog puppy cute'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term20',
    term: 'Cats',
    volume: 920000,
    category: 'animals',
    imageUrl: getMockImageUrl('cat kitten'),
    timestamp: Timestamp.now()
  }
];

// Sample leaderboard data
export const sampleLeaderboard: TrendGuesserPlayer[] = [
  {
    uid: 'player1',
    name: 'ChampionGamer',
    score: 24,
    highScores: { 
      technology: 12, 
      gaming: 24, 
      sports: 8,
      animals: 15,
      everything: 18,
      entertainment: 10
    }
  },
  {
    uid: 'player2',
    name: 'TrendMaster',
    score: 20,
    highScores: { 
      entertainment: 20, 
      news: 15, 
      sports: 18,
      technology: 14,
      everything: 16,
      animals: 12
    }
  },
  {
    uid: 'player3',
    name: 'SearchWizard',
    score: 18,
    highScores: { 
      technology: 18, 
      gaming: 10, 
      entertainment: 12,
      sports: 16,
      everything: 14,
      animals: 8
    }
  },
  {
    uid: 'player4',
    name: 'DataNerd',
    score: 16,
    highScores: { 
      technology: 16, 
      news: 14, 
      sports: 8,
      gaming: 12,
      everything: 15,
      questions: 18
    }
  },
  {
    uid: 'player5',
    name: 'GuessingGuru',
    score: 15,
    highScores: { 
      gaming: 15, 
      entertainment: 9, 
      sports: 12,
      animals: 18,
      everything: 13,
      technology: 10
    }
  }
];