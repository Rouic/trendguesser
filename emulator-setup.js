// emulator-setup.js
// Run this script once to populate the emulator with initial data
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
admin.initializeApp({ projectId: 'trendguesser-332d4' });

const db = admin.firestore();

// Function to load and parse CSV data
function loadCsvData(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('CSV file not found at path:', filePath);
      return [];
    }
    
    // Read file contents
    const csvContent = fs.readFileSync(filePath, 'utf8');
    
    return parseCSV(csvContent);
  } catch (error) {
    console.error('Error reading CSV file:', error);
    return [];
  }
}

// Parse CSV content into SearchTermItem array
// Format: Keyword,Category,Monthly Search Volume
function parseCSV(csvContent) {
  if (!csvContent) return [];
  
  const lines = csvContent.split('\n');
  if (lines.length <= 1) return []; // Header only or empty file
  
  const result = [];
  
  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = line.split(',');
    if (values.length >= 3) {
      result.push({
        keyword: values[0].trim(),
        category: values[1].trim().toLowerCase(),
        volume: parseInt(values[2].trim(), 10) || 0
      });
    }
  }
  
  return result;
}

// Gather category statistics for batch processing
function buildCategoryStats(searchTerms) {
  const categoryMap = new Map();
  
  for (const item of searchTerms) {
    const category = item.category;
    const term = item.keyword;
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category: category,
        count: 1,
        terms: [term],
        lastUpdated: admin.firestore.Timestamp.now()
      });
    } else {
      const categoryData = categoryMap.get(category);
      if (!categoryData.terms.includes(term)) {
        categoryData.count += 1;
        categoryData.terms.push(term);
      }
    }
  }
  
  return Array.from(categoryMap.values());
}

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

// Sample search terms (fallback if CSV not found)
const sampleSearchTerms = [
  {
    term: 'Artificial Intelligence',
    volume: 85,
    category: 'technology',
    imageUrl: 'https://picsum.photos/seed/artificial-intelligence/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Machine Learning',
    volume: 65,
    category: 'technology',
    imageUrl: 'https://picsum.photos/seed/machine-learning/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Blockchain',
    volume: 45,
    category: 'technology',
    imageUrl: 'https://picsum.photos/seed/blockchain/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'PlayStation 5',
    volume: 95,
    category: 'gaming',
    imageUrl: 'https://picsum.photos/seed/playstation-5/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Xbox Series X',
    volume: 75,
    category: 'gaming',
    imageUrl: 'https://picsum.photos/seed/xbox-series-x/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Elden Ring',
    volume: 55,
    category: 'gaming',
    imageUrl: 'https://picsum.photos/seed/elden-ring/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Taylor Swift',
    volume: 100,
    category: 'entertainment',
    imageUrl: 'https://picsum.photos/seed/taylor-swift/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Dune Part 2',
    volume: 70,
    category: 'entertainment',
    imageUrl: 'https://picsum.photos/seed/dune-part-2/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Stranger Things',
    volume: 50,
    category: 'entertainment',
    imageUrl: 'https://picsum.photos/seed/stranger-things/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Climate Change',
    volume: 90,
    category: 'news',
    imageUrl: 'https://picsum.photos/seed/climate-change/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'COVID-19',
    volume: 60,
    category: 'news',
    imageUrl: 'https://picsum.photos/seed/covid-19/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'US Elections',
    volume: 80,
    category: 'news',
    imageUrl: 'https://picsum.photos/seed/us-elections/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'NBA Playoffs',
    volume: 85,
    category: 'sports',
    imageUrl: 'https://picsum.photos/seed/nba-playoffs/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'World Cup',
    volume: 95,
    category: 'sports',
    imageUrl: 'https://picsum.photos/seed/world-cup/800/600',
    timestamp: admin.firestore.Timestamp.now()
  },
  {
    term: 'Formula 1',
    volume: 75,
    category: 'sports',
    imageUrl: 'https://picsum.photos/seed/formula-1/800/600',
    timestamp: admin.firestore.Timestamp.now()
  }
];

// Placeholder API for images - uses picsum.photos with seed for deterministic results
function getPlaceholderImage(term, width = 800, height = 600) {
  // Create a clean seed by removing special characters
  const seed = encodeURIComponent(term.toLowerCase().replace(/[^a-z0-9]/g, '-'));
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

async function populateEmulator() {
  console.log('Starting Firestore emulator population...');
  
  try {
    // Add leaderboard entries
    console.log('Adding leaderboard entries...');
    const leaderboardBatch = db.batch();
    for (const entry of sampleLeaderboard) {
      const docRef = db.collection('leaderboard').doc(`${entry.category}_${entry.uid}`);
      leaderboardBatch.set(docRef, entry);
    }
    await leaderboardBatch.commit();
    console.log('Leaderboard entries added successfully!');
    
    // Add players
    console.log('Adding players...');
    const playersBatch = db.batch();
    for (const player of samplePlayers) {
      const docRef = db.collection('players').doc(player.uid);
      playersBatch.set(docRef, player);
    }
    await playersBatch.commit();
    console.log('Players added successfully!');
    
    // Process CSV data
    console.log('Processing CSV data...');
    const csvPath = path.join(__dirname, '/functions/src/data.csv');
    const searchTerms = loadCsvData(csvPath);
    
    if (searchTerms.length === 0) {
      console.log('No search terms found in CSV. Adding sample search terms instead...');
      // Use the sample search terms if CSV processing fails
      const sampleBatch = db.batch();
      for (const term of sampleSearchTerms) {
        const docId = term.term.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const docRef = db.collection('searchTerms').doc(docId);
        sampleBatch.set(docRef, term);
      }
      await sampleBatch.commit();
      
      // Build and save category stats for sample data
      const sampleCategoryStats = buildCategoryStats(
        sampleSearchTerms.map(item => ({
          keyword: item.term,
          category: item.category,
          volume: item.volume
        }))
      );
      
      const statsBatch = db.batch();
      for (const stat of sampleCategoryStats) {
        const docRef = db.collection('categoryStats').doc(stat.category);
        statsBatch.set(docRef, stat);
      }
      await statsBatch.commit();
      
      console.log('Sample search terms and category stats added successfully!');
    } else {
      console.log(`Found ${searchTerms.length} search terms in CSV. Processing in batches...`);
      
      // Process in batches of 500 to avoid hitting Firestore limits
      const BATCH_SIZE = 500;
      let processedCount = 0;
      
      for (let i = 0; i < searchTerms.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const currentBatch = searchTerms.slice(i, i + BATCH_SIZE);
        
        for (const item of currentBatch) {
          // Generate document ID based on keyword
          const docId = item.keyword.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const docRef = db.collection('searchTerms').doc(docId);
          
          // Get placeholder image URL
          const imageUrl = getPlaceholderImage(item.keyword);
          
          // Set document data
          batch.set(docRef, {
            term: item.keyword,
            volume: item.volume,
            category: item.category,
            imageUrl: imageUrl,
            timestamp: admin.firestore.Timestamp.now()
          });
        }
        
        await batch.commit();
        processedCount += currentBatch.length;
        console.log(`Processed ${processedCount}/${searchTerms.length} search terms...`);
      }
      
      // Build and save category stats
      console.log('Building category statistics...');
      const categoryStats = buildCategoryStats(searchTerms);
      
      const statsBatch = db.batch();
      for (const stat of categoryStats) {
        const docRef = db.collection('categoryStats').doc(stat.category);
        statsBatch.set(docRef, stat);
      }
      await statsBatch.commit();
      
      console.log('All search terms and category stats processed successfully!');
    }
    
    // Set processing state to completed
    await db.collection('system').doc('csvProcessingState').set({
      lastProcessedIndex: searchTerms.length > 0 ? searchTerms.length - 1 : sampleSearchTerms.length - 1,
      totalItems: searchTerms.length > 0 ? searchTerms.length : sampleSearchTerms.length,
      completed: true,
      lastUpdated: admin.firestore.Timestamp.now()
    });
    
    console.log('Firestore emulator populated with data successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error populating emulator:', error);
    process.exit(1);
  }
}

// Execute the population function
populateEmulator();