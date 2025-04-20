// src/lib/mockData.ts
import { SearchTerm, TrendGuesserPlayer } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Sample search terms for initial data and fallbacks
export const sampleSearchTerms: SearchTerm[] = [
  // Technology terms
  {
    id: 'youtube',
    term: 'YouTube',
    volume: 1200000000,
    category: 'technology',
    imageUrl: '/api/image?term=YouTube',
    timestamp: new Date().toISOString()
  },
  {
    id: 'facebook',
    term: 'Facebook',
    volume: 724500000,
    category: 'technology',
    imageUrl: '/api/image?term=Facebook',
    timestamp: new Date().toISOString()
  },
  {
    id: 'whatsapp-web',
    term: 'WhatsApp Web',
    volume: 521000000,
    category: 'technology',
    imageUrl: '/api/image?term=WhatsApp Web',
    timestamp: new Date().toISOString()
  },
  {
    id: 'translate',
    term: 'Translate',
    volume: 460800000,
    category: 'technology',
    imageUrl: '/api/image?term=Translate',
    timestamp: new Date().toISOString()
  },
  {
    id: 'google',
    term: 'Google',
    volume: 405300000,
    category: 'technology',
    imageUrl: '/api/image?term=Google',
    timestamp: new Date().toISOString()
  },
  
  // Sports terms
  {
    id: 'football',
    term: 'Football',
    volume: 50000000,
    category: 'sports',
    imageUrl: '/api/image?term=Football',
    timestamp: new Date().toISOString()
  },
  {
    id: 'soccer',
    term: 'Soccer',
    volume: 30000000,
    category: 'sports',
    imageUrl: '/api/image?term=Soccer',
    timestamp: new Date().toISOString()
  },
  {
    id: 'cricket',
    term: 'Cricket',
    volume: 64200000,
    category: 'sports',
    imageUrl: '/api/image?term=Cricket',
    timestamp: new Date().toISOString()
  },
  {
    id: 'basketball',
    term: 'Basketball',
    volume: 20000000,
    category: 'sports',
    imageUrl: '/api/image?term=Basketball',
    timestamp: new Date().toISOString()
  },
  {
    id: 'tennis',
    term: 'Tennis',
    volume: 10000000,
    category: 'sports',
    imageUrl: '/api/image?term=Tennis',
    timestamp: new Date().toISOString()
  },
  
  // Landmarks terms
  {
    id: 'eiffel-tower',
    term: 'Eiffel Tower',
    volume: 2500000,
    category: 'landmarks',
    imageUrl: '/api/image?term=Eiffel Tower',
    timestamp: new Date().toISOString()
  },
  {
    id: 'taj-mahal',
    term: 'Taj Mahal',
    volume: 2000000,
    category: 'landmarks',
    imageUrl: '/api/image?term=Taj Mahal',
    timestamp: new Date().toISOString()
  },
  {
    id: 'statue-of-liberty',
    term: 'Statue of Liberty',
    volume: 800000,
    category: 'landmarks',
    imageUrl: '/api/image?term=Statue of Liberty',
    timestamp: new Date().toISOString()
  },
  {
    id: 'pyramids-of-giza',
    term: 'Pyramids of Giza',
    volume: 600000,
    category: 'landmarks',
    imageUrl: '/api/image?term=Pyramids of Giza',
    timestamp: new Date().toISOString()
  },
  {
    id: 'colosseum',
    term: 'Colosseum',
    volume: 600000,
    category: 'landmarks',
    imageUrl: '/api/image?term=Colosseum',
    timestamp: new Date().toISOString()
  },
  
  // Snacks terms
  {
    id: 'oreo',
    term: 'Oreo',
    volume: 500000,
    category: 'snacks',
    imageUrl: '/api/image?term=Oreo Cookies',
    timestamp: new Date().toISOString()
  },
  {
    id: 'lay-s',
    term: 'Lay\'s',
    volume: 200000,
    category: 'snacks',
    imageUrl: '/api/image?term=Lays Potato Chips',
    timestamp: new Date().toISOString()
  },
  {
    id: 'doritos',
    term: 'Doritos',
    volume: 165000,
    category: 'snacks',
    imageUrl: '/api/image?term=Doritos Chips',
    timestamp: new Date().toISOString()
  },
  {
    id: 'pringles',
    term: 'Pringles',
    volume: 150000,
    category: 'snacks',
    imageUrl: '/api/image?term=Pringles',
    timestamp: new Date().toISOString()
  },
  {
    id: 'cheetos',
    term: 'Cheetos',
    volume: 165000,
    category: 'snacks',
    imageUrl: '/api/image?term=Cheetos',
    timestamp: new Date().toISOString()
  },
  
  // Animals terms
  {
    id: 'dogs',
    term: 'Dogs',
    volume: 2500000,
    category: 'animals',
    imageUrl: '/api/image?term=Dogs',
    timestamp: new Date().toISOString()
  },
  {
    id: 'cats',
    term: 'Cats',
    volume: 2000000,
    category: 'animals',
    imageUrl: '/api/image?term=Cats',
    timestamp: new Date().toISOString()
  },
  {
    id: 'elephants',
    term: 'Elephants',
    volume: 500000,
    category: 'animals',
    imageUrl: '/api/image?term=Elephants',
    timestamp: new Date().toISOString()
  },
  {
    id: 'lions',
    term: 'Lions',
    volume: 600000,
    category: 'animals',
    imageUrl: '/api/image?term=Lions',
    timestamp: new Date().toISOString()
  },
  {
    id: 'tigers',
    term: 'Tigers',
    volume: 550000,
    category: 'animals',
    imageUrl: '/api/image?term=Tigers',
    timestamp: new Date().toISOString()
  },
  
  // Celebrities terms
  {
    id: 'taylor-swift',
    term: 'Taylor Swift',
    volume: 3500000,
    category: 'celebrities',
    imageUrl: '/api/image?term=Taylor Swift',
    timestamp: new Date().toISOString()
  },
  {
    id: 'beyonce',
    term: 'Beyoncé',
    volume: 2000000,
    category: 'celebrities',
    imageUrl: '/api/image?term=Beyonce',
    timestamp: new Date().toISOString()
  },
  {
    id: 'dwayne-johnson',
    term: 'Dwayne Johnson',
    volume: 1800000,
    category: 'celebrities',
    imageUrl: '/api/image?term=Dwayne Johnson',
    timestamp: new Date().toISOString()
  },
  {
    id: 'leonardo-dicaprio',
    term: 'Leonardo DiCaprio',
    volume: 1200000,
    category: 'celebrities',
    imageUrl: '/api/image?term=Leonardo DiCaprio',
    timestamp: new Date().toISOString()
  },
  {
    id: 'oprah-winfrey',
    term: 'Oprah Winfrey',
    volume: 800000,
    category: 'celebrities',
    imageUrl: '/api/image?term=Oprah Winfrey',
    timestamp: new Date().toISOString()
  }
];

// Sample leaderboard data
export const sampleLeaderboard: TrendGuesserPlayer[] = [
  {
    uid: uuidv4(),
    name: 'TrendMaster',
    score: 25,
    highScores: {
      technology: 25,
      sports: 18,
      landmarks: 15,
      snacks: 20,
      animals: 22,
      celebrities: 19,
      everything: 25
    }
  },
  {
    uid: uuidv4(),
    name: 'SearchExpert',
    score: 23,
    highScores: {
      technology: 23,
      sports: 16,
      landmarks: 14,
      snacks: 19,
      animals: 21,
      celebrities: 18,
      everything: 23
    }
  },
  {
    uid: uuidv4(),
    name: 'DataWizard',
    score: 21,
    highScores: {
      technology: 21,
      sports: 15,
      landmarks: 12,
      snacks: 18,
      animals: 20,
      celebrities: 17,
      everything: 21
    }
  },
  {
    uid: uuidv4(),
    name: 'GuessMaster',
    score: 19,
    highScores: {
      technology: 19,
      sports: 14,
      landmarks: 11,
      snacks: 17,
      animals: 18,
      celebrities: 16,
      everything: 19
    }
  },
  {
    uid: uuidv4(),
    name: 'NumberCruncher',
    score: 17,
    highScores: {
      technology: 17,
      sports: 13,
      landmarks: 10,
      snacks: 15,
      animals: 16,
      celebrities: 14,
      everything: 17
    }
  },
  {
    uid: uuidv4(),
    name: 'VolumeGenius',
    score: 15,
    highScores: {
      technology: 15,
      sports: 12,
      landmarks: 9,
      snacks: 13,
      animals: 14,
      celebrities: 12,
      everything: 15
    }
  },
  {
    uid: uuidv4(),
    name: 'TrendSpotter',
    score: 13,
    highScores: {
      technology: 13,
      sports: 10,
      landmarks: 8,
      snacks: 11,
      animals: 12,
      celebrities: 10,
      everything: 13
    }
  },
  {
    uid: uuidv4(),
    name: 'DataDetective',
    score: 11,
    highScores: {
      technology: 11,
      sports: 9,
      landmarks: 7,
      snacks: 10,
      animals: 10,
      celebrities: 9,
      everything: 11
    }
  },
  {
    uid: uuidv4(),
    name: 'SearchMaster',
    score: 9,
    highScores: {
      technology: 9,
      sports: 8,
      landmarks: 6,
      snacks: 8,
      animals: 9,
      celebrities: 7,
      everything: 9
    }
  },
  {
    uid: uuidv4(),
    name: 'TrendNewbie',
    score: 7,
    highScores: {
      technology: 7,
      sports: 6,
      landmarks: 5,
      snacks: 6,
      animals: 7,
      celebrities: 5,
      everything: 7
    }
  }
];