// scripts/migrate-data.js
// A script to help migrate data from Firebase to the new API system
const fs = require('fs');
const path = require('path');

// Create data directory
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Parse CSV file
function parseCSV(csvPath) {
  try {
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    if (lines.length <= 1) return []; // Header only or empty file
    
    const terms = [];
    
    // Skip header (first line)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',');
      if (values.length >= 3) {
        const keyword = values[0].trim();
        const category = values[1].trim().toLowerCase();
        const volume = parseInt(values[2].trim(), 10) || 0;
        
        terms.push({
          id: keyword.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          term: keyword,
          volume: volume,
          category: category,
          imageUrl: `/api/image?term=${encodeURIComponent(keyword)}`,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return terms;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return [];
  }
}

// Migrate data from Firebase CSV files
async function migrateData() {
  console.log('Starting data migration...');
  
  // Check if CSV file exists
  const csvPath = path.join(process.cwd(), 'functions', 'src', 'data.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    return;
  }
  
  // Parse CSV data
  const terms = parseCSV(csvPath);
  if (terms.length === 0) {
    console.error('No terms found in CSV file');
    return;
  }
  
  console.log(`Parsed ${terms.length} terms from CSV file`);
  
  // Write terms to data file
  const termsFile = path.join(dataDir, 'terms.json');
  fs.writeFileSync(termsFile, JSON.stringify(terms, null, 2));
  console.log(`Saved ${terms.length} terms to ${termsFile}`);
  
  // Create empty placeholder files for games, players, and leaderboard
  const gamesFile = path.join(dataDir, 'games.json');
  if (!fs.existsSync(gamesFile)) {
    fs.writeFileSync(gamesFile, JSON.stringify({}, null, 2));
    console.log(`Created empty games file at ${gamesFile}`);
  }
  
  const playersFile = path.join(dataDir, 'players.json');
  if (!fs.existsSync(playersFile)) {
    fs.writeFileSync(playersFile, JSON.stringify({}, null, 2));
    console.log(`Created empty players file at ${playersFile}`);
  }
  
  const leaderboardFile = path.join(dataDir, 'leaderboard.json');
  if (!fs.existsSync(leaderboardFile)) {
    fs.writeFileSync(leaderboardFile, JSON.stringify({}, null, 2));
    console.log(`Created empty leaderboard file at ${leaderboardFile}`);
  }
  
  console.log('Data migration completed successfully!');
}

// Run the migration
migrateData().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});