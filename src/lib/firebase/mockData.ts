import { SearchTerm, TrendGuesserPlayer } from '@/types';
import { Timestamp } from 'firebase/firestore';

// Sample search terms for development
export const sampleSearchTerms: SearchTerm[] = [
  {
    id: 'term1',
    term: 'Artificial Intelligence',
    volume: 85,
    category: 'technology',
    imageUrl: 'https://source.unsplash.com/featured/?artificial%20intelligence',
    timestamp: Timestamp.now()
  },
  {
    id: 'term2',
    term: 'Machine Learning',
    volume: 65,
    category: 'technology',
    imageUrl: 'https://source.unsplash.com/featured/?machine%20learning',
    timestamp: Timestamp.now()
  },
  {
    id: 'term3',
    term: 'Blockchain',
    volume: 45,
    category: 'technology',
    imageUrl: 'https://source.unsplash.com/featured/?blockchain',
    timestamp: Timestamp.now()
  },
  {
    id: 'term4',
    term: 'PlayStation 5',
    volume: 95,
    category: 'gaming',
    imageUrl: 'https://source.unsplash.com/featured/?playstation',
    timestamp: Timestamp.now()
  },
  {
    id: 'term5',
    term: 'Xbox Series X',
    volume: 75,
    category: 'gaming',
    imageUrl: 'https://source.unsplash.com/featured/?xbox',
    timestamp: Timestamp.now()
  },
  {
    id: 'term6',
    term: 'Elden Ring',
    volume: 55,
    category: 'gaming',
    imageUrl: 'https://source.unsplash.com/featured/?gaming',
    timestamp: Timestamp.now()
  },
  {
    id: 'term7',
    term: 'Taylor Swift',
    volume: 100,
    category: 'entertainment',
    imageUrl: 'https://source.unsplash.com/featured/?music',
    timestamp: Timestamp.now()
  },
  {
    id: 'term8',
    term: 'Dune Part 2',
    volume: 70,
    category: 'entertainment',
    imageUrl: 'https://source.unsplash.com/featured/?cinema',
    timestamp: Timestamp.now()
  },
  {
    id: 'term9',
    term: 'Stranger Things',
    volume: 50,
    category: 'entertainment',
    imageUrl: 'https://source.unsplash.com/featured/?television',
    timestamp: Timestamp.now()
  },
  {
    id: 'term10',
    term: 'Climate Change',
    volume: 90,
    category: 'news',
    imageUrl: 'https://source.unsplash.com/featured/?climate',
    timestamp: Timestamp.now()
  },
  {
    id: 'term11',
    term: 'COVID-19',
    volume: 60,
    category: 'news',
    imageUrl: 'https://source.unsplash.com/featured/?covid',
    timestamp: Timestamp.now()
  },
  {
    id: 'term12',
    term: 'US Elections',
    volume: 80,
    category: 'news',
    imageUrl: 'https://source.unsplash.com/featured/?election',
    timestamp: Timestamp.now()
  },
  {
    id: 'term13',
    term: 'NBA Playoffs',
    volume: 85,
    category: 'sports',
    imageUrl: 'https://source.unsplash.com/featured/?basketball',
    timestamp: Timestamp.now()
  },
  {
    id: 'term14',
    term: 'World Cup',
    volume: 95,
    category: 'sports',
    imageUrl: 'https://source.unsplash.com/featured/?soccer',
    timestamp: Timestamp.now()
  },
  {
    id: 'term15',
    term: 'Formula 1',
    volume: 75,
    category: 'sports',
    imageUrl: 'https://source.unsplash.com/featured/?racing',
    timestamp: Timestamp.now()
  }
];

// Sample leaderboard data
export const sampleLeaderboard: TrendGuesserPlayer[] = [
  {
    uid: 'player1',
    name: 'ChampionGamer',
    score: 24,
    highScores: { technology: 12, gaming: 24, sports: 8 }
  },
  {
    uid: 'player2',
    name: 'TrendMaster',
    score: 20,
    highScores: { entertainment: 20, news: 15, sports: 18 }
  },
  {
    uid: 'player3',
    name: 'SearchWizard',
    score: 18,
    highScores: { technology: 18, gaming: 10, entertainment: 12 }
  },
  {
    uid: 'player4',
    name: 'DataNerd',
    score: 16,
    highScores: { technology: 16, news: 14, sports: 8 }
  },
  {
    uid: 'player5',
    name: 'GuessingGuru',
    score: 15,
    highScores: { gaming: 15, entertainment: 9, sports: 12 }
  }
];