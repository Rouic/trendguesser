// emulator-setup.js
// Run this script once to populate the emulator with initial data
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
admin.initializeApp({ projectId: 'trendguesser-332d4' });

const db = admin.firestore();

// Sample search terms to add to Firestore
const sampleSearchTerms = [
  {
    term: 'Artificial Intelligence',
    volume: 85,
    category: 'technology',
    imageUrl: 'https://source.unsplash.com/featured/?artificial%20intelligence',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Machine Learning',
    volume: 65,
    category: 'technology',
    imageUrl: 'https://source.unsplash.com/featured/?machine%20learning',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Blockchain',
    volume: 45,
    category: 'technology',
    imageUrl: 'https://source.unsplash.com/featured/?blockchain',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'PlayStation 5',
    volume: 95,
    category: 'gaming',
    imageUrl: 'https://source.unsplash.com/featured/?playstation',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Xbox Series X',
    volume: 75,
    category: 'gaming',
    imageUrl: 'https://source.unsplash.com/featured/?xbox',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Elden Ring',
    volume: 55,
    category: 'gaming',
    imageUrl: 'https://source.unsplash.com/featured/?gaming',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Taylor Swift',
    volume: 100,
    category: 'entertainment',
    imageUrl: 'https://source.unsplash.com/featured/?music',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Dune Part 2',
    volume: 70,
    category: 'entertainment',
    imageUrl: 'https://source.unsplash.com/featured/?cinema',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Stranger Things',
    volume: 50,
    category: 'entertainment',
    imageUrl: 'https://source.unsplash.com/featured/?television',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Climate Change',
    volume: 90,
    category: 'news',
    imageUrl: 'https://source.unsplash.com/featured/?climate',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'COVID-19',
    volume: 60,
    category: 'news',
    imageUrl: 'https://source.unsplash.com/featured/?covid',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'US Elections',
    volume: 80,
    category: 'news',
    imageUrl: 'https://source.unsplash.com/featured/?election',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'NBA Playoffs',
    volume: 85,
    category: 'sports',
    imageUrl: 'https://source.unsplash.com/featured/?basketball',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'World Cup',
    volume: 95,
    category: 'sports',
    imageUrl: 'https://source.unsplash.com/featured/?soccer',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Formula 1',
    volume: 75,
    category: 'sports',
    imageUrl: 'https://source.unsplash.com/featured/?racing',
    timestamp: admin.firestore.Timestamp.now()
  }
];

// Sample leaderboard data
const sampleLeaderboard = [
  {
    uid: 'player1',
    name: 'ChampionGamer',
    score: 24,
    category: 'gaming',
    highScores: { technology: 12, gaming: 24, sports: 8 },
    updatedAt: admin.firestore.Timestamp.now()
  },
  {
    uid: 'player2',
    name: 'TrendMaster',
    score: 20,
    category: 'entertainment',
    highScores: { entertainment: 20, news: 15, sports: 18 },
    updatedAt: admin.firestore.Timestamp.now()
  },
  {
    uid: 'player3',
    name: 'SearchWizard',
    score: 18,
    category: 'technology',
    highScores: { technology: 18, gaming: 10, entertainment: 12 },
    updatedAt: admin.firestore.Timestamp.now()
  }
];

// Sample players data
const samplePlayers = [
  {
    uid: 'player1',
    name: 'ChampionGamer',
    createdAt: admin.firestore.Timestamp.now(),
    highScores: { technology: 12, gaming: 24, sports: 8 }
  },
  {
    uid: 'player2',
    name: 'TrendMaster',
    createdAt: admin.firestore.Timestamp.now(),
    highScores: { entertainment: 20, news: 15, sports: 18 }
  },
  {
    uid: 'player3',
    name: 'SearchWizard',
    createdAt: admin.firestore.Timestamp.now(),
    highScores: { technology: 18, gaming: 10, entertainment: 12 }
  }
];

async function populateEmulator() {
  const batch = db.batch();
  
  // Add search terms
  console.log('Adding search terms...');
  for (const term of sampleSearchTerms) {
    const docRef = db.collection('searchTerms').doc();
    batch.set(docRef, term);
  }
  
  // Add leaderboard entries
  console.log('Adding leaderboard entries...');
  for (const entry of sampleLeaderboard) {
    const docRef = db.collection('leaderboard').doc(`${entry.category}_${entry.uid}`);
    batch.set(docRef, entry);
  }
  
  // Add players
  console.log('Adding players...');
  for (const player of samplePlayers) {
    const docRef = db.collection('players').doc(player.uid);
    batch.set(docRef, player);
  }
  
  // Commit all changes
  await batch.commit();
  console.log('Firestore emulator populated with sample data!');
  
  // Exit the process
  process.exit(0);
}

populateEmulator().catch(error => {
  console.error('Error populating emulator:', error);
  process.exit(1);
});