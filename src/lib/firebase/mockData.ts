import { SearchTerm, TrendGuesserPlayer } from '@/types';
import { Timestamp } from 'firebase/firestore';

import { ImageConfig } from '@/utils/imageUtils';

// Function to generate a consistent image URL for a term
const getImageUrl = (term: string): string => {
  return ImageConfig.primary.getUrl(term, 800, 600);
};

// Sample search terms for development
export const sampleSearchTerms: SearchTerm[] = [
  {
    id: 'term1',
    term: 'Artificial Intelligence',
    volume: 850000,
    category: 'technology',
    imageUrl: getImageUrl('artificial intelligence technology'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term2',
    term: 'Machine Learning',
    volume: 650000,
    category: 'technology',
    imageUrl: getImageUrl('machine learning code'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term3',
    term: 'Blockchain',
    volume: 450000,
    category: 'technology',
    imageUrl: getImageUrl('blockchain digital'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term4',
    term: 'PlayStation 5',
    volume: 950000,
    category: 'gaming',
    imageUrl: getImageUrl('playstation 5 console'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term5',
    term: 'Xbox Series X',
    volume: 750000,
    category: 'gaming',
    imageUrl: getImageUrl('xbox series x console'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term6',
    term: 'Elden Ring',
    volume: 550000,
    category: 'gaming',
    imageUrl: getImageUrl('elden ring game'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term7',
    term: 'Taylor Swift',
    volume: 1000000,
    category: 'entertainment',
    imageUrl: getImageUrl('taylor swift concert'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term8',
    term: 'Dune Part 2',
    volume: 700000,
    category: 'entertainment',
    imageUrl: getImageUrl('dune movie desert'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term9',
    term: 'Stranger Things',
    volume: 500000,
    category: 'entertainment',
    imageUrl: getImageUrl('stranger things tv show'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term10',
    term: 'Climate Change',
    volume: 900000,
    category: 'news',
    imageUrl: getImageUrl('climate change earth'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term11',
    term: 'COVID-19',
    volume: 600000,
    category: 'news',
    imageUrl: getImageUrl('covid healthcare mask'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term12',
    term: 'US Elections',
    volume: 800000,
    category: 'news',
    imageUrl: getImageUrl('us election voting'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term13',
    term: 'NBA Playoffs',
    volume: 850000,
    category: 'sports',
    imageUrl: getImageUrl('nba basketball game'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term14',
    term: 'World Cup',
    volume: 950000,
    category: 'sports',
    imageUrl: getImageUrl('soccer world cup'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term15',
    term: 'Formula 1',
    volume: 750000,
    category: 'sports',
    imageUrl: getImageUrl('formula 1 racing'),
    timestamp: Timestamp.now()
  },
  // Additional terms for better diversity in categories
  {
    id: 'term16',
    term: 'Giraffes',
    volume: 250000,
    category: 'animals',
    imageUrl: getImageUrl('giraffe wildlife'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term17',
    term: 'Pandas',
    volume: 420000,
    category: 'animals',
    imageUrl: getImageUrl('panda bear'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term18',
    term: 'Dolphins',
    volume: 380000,
    category: 'animals',
    imageUrl: getImageUrl('dolphin ocean'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term19',
    term: 'Dogs',
    volume: 890000,
    category: 'animals',
    imageUrl: getImageUrl('dog puppy cute'),
    timestamp: Timestamp.now()
  },
  {
    id: 'term20',
    term: 'Cats',
    volume: 920000,
    category: 'animals',
    imageUrl: getImageUrl('cat kitten'),
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