/**
 * Standalone database initialization script
 * 
 * This script is meant to be run directly with Node.js:
 * node src/scripts/standalone-init.js
 * 
 * It handles:
 * 1. Loading environment variables from .env.local
 * 2. Connecting to the Neon PostgreSQL database
 * 3. Creating all required tables for TrendGuesser
 */

// Import required dependencies
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env files
function loadEnvVariables() {
  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env')
  ];
  
  let loaded = false;
  
  for (const filePath of envFiles) {
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment from: ${filePath}`);
      
      try {
        const envContent = fs.readFileSync(filePath, 'utf8');
        const envLines = envContent.split('\n');
        
        for (const line of envLines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const equalIndex = trimmedLine.indexOf('=');
            if (equalIndex > 0) {
              const key = trimmedLine.substring(0, equalIndex).trim();
              let value = trimmedLine.substring(equalIndex + 1).trim();
              
              // Remove quotes if present
              if ((value.startsWith('"') && value.endsWith('"')) ||
                  (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
              }
              
              if (key && value) {
                process.env[key] = value;
              }
            }
          }
        }
        
        loaded = true;
        console.log(`Loaded environment variables from ${filePath}`);
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
      }
    }
  }
  
  return loaded;
}

// Execute a SQL query with error handling
async function executeQuery(query, params = []) {
  const databaseUrl = process.env.NEON_DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('NEON_DATABASE_URL is not defined in environment');
  }
  
  try {
    const client = neon(databaseUrl);
    return await client(query, params);
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
}

// Check if a table exists in the database
async function tableExists(tableName) {
  try {
    const result = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);
    
    return result && result.rows && result.rows[0] && result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error.message);
    return false;
  }
}

// Database initialization function
async function initializeDatabase() {
  console.log('Starting database initialization...');
  
  // Load environment variables if not already present
  if (!process.env.NEON_DATABASE_URL) {
    const loaded = loadEnvVariables();
    if (!loaded) {
      console.error('No environment files found. Create .env.local with NEON_DATABASE_URL variable.');
      process.exit(1);
    }
  }
  
  // Check if NEON_DATABASE_URL is available
  if (!process.env.NEON_DATABASE_URL) {
    console.error('NEON_DATABASE_URL not found in environment variables.');
    console.error('Please set this variable in your .env.local file.');
    process.exit(1);
  }
  
  console.log('Using Neon PostgreSQL URL:', process.env.NEON_DATABASE_URL.substring(0, 25) + '...');
  
  // Test database connection
  try {
    console.log('Testing database connection...');
    await executeQuery('SELECT 1');
    console.log('Database connection successful!');
  } catch (error) {
    console.error('Failed to connect to database. Check your connection string:', error.message);
    process.exit(1);
  }
  
  // Create tables with error handling
  try {
    console.log('Creating database tables...');
    
    // Table 1: terms
    if (!await tableExists('terms')) {
      console.log('Creating terms table...');
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS terms (
          id TEXT PRIMARY KEY,
          term TEXT NOT NULL,
          volume INTEGER NOT NULL,
          category TEXT NOT NULL,
          imageUrl TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Terms table created successfully');
    } else {
      console.log('✓ Terms table already exists');
    }
    
    // Table 2: games
    if (!await tableExists('games')) {
      console.log('Creating games table...');
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          createdBy TEXT NOT NULL,
          gameType TEXT NOT NULL,
          status TEXT NOT NULL,
          gameState JSONB
        )
      `);
      console.log('✓ Games table created successfully');
    } else {
      console.log('✓ Games table already exists');
    }
    
    // Table 3: players
    if (!await tableExists('players')) {
      console.log('Creating players table...');
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS players (
          uid TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          score INTEGER DEFAULT 0,
          highScores JSONB DEFAULT '{}'::jsonb
        )
      `);
      console.log('✓ Players table created successfully');
    } else {
      console.log('✓ Players table already exists');
    }
    
    // Table 4: leaderboard
    if (!await tableExists('leaderboard')) {
      console.log('Creating leaderboard table...');
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id TEXT PRIMARY KEY,
          playerUid TEXT NOT NULL,
          playerName TEXT NOT NULL,
          category TEXT NOT NULL,
          score INTEGER NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Leaderboard table created successfully');
    } else {
      console.log('✓ Leaderboard table already exists');
    }
    
    console.log('All tables created successfully!');
    
    // Check if terms table needs seeding
    try {
      const termsCount = await executeQuery('SELECT COUNT(*) FROM terms');
      if (termsCount && termsCount.rows && termsCount.rows[0]) {
        const count = parseInt(termsCount.rows[0].count || '0');
        
        if (count === 0) {
          console.log('Terms table is empty. Importing seed data...');
          
          // Check for JSON seed file
          const fs = require('fs');
          const seedJsonPath = path.resolve(process.cwd(), 'data', 'seed', 'terms.json');
          
          if (fs.existsSync(seedJsonPath)) {
            try {
              console.log(`Found seed data at ${seedJsonPath}`);
              const jsonData = fs.readFileSync(seedJsonPath, 'utf8');
              const terms = JSON.parse(jsonData);
              
              console.log(`Importing ${terms.length} terms from seed file...`);
              
              // Begin transaction
              await executeQuery('BEGIN');
              
              let importCount = 0;
              for (const term of terms) {
                try {
                  await executeQuery(
                    'INSERT INTO terms (id, term, volume, category, imageUrl, timestamp) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
                    [
                      term.id,
                      term.term,
                      term.volume,
                      term.category,
                      term.imageUrl,
                      term.timestamp
                    ]
                  );
                  importCount++;
                } catch (termError) {
                  console.error(`Error importing term ${term.term}:`, termError.message);
                }
              }
              
              await executeQuery('COMMIT');
              console.log(`✅ Successfully imported ${importCount} terms from seed data`);
            } catch (importError) {
              await executeQuery('ROLLBACK');
              console.error('Error importing from seed file:', importError.message);
            }
          } else {
            console.log('No seed data file found at data/seed/terms.json');
          }
        } else {
          console.log(`Terms table contains ${count} records. No seeding needed.`);
        }
      }
    } catch (error) {
      console.error('Error checking terms count:', error.message);
    }
    
    console.log('\nDatabase initialization complete!');
    console.log('You can now run the application with:');
    console.log('npm run dev    # For development');
    console.log('npm start      # For production');
    
    return true;
  } catch (error) {
    console.error('Error creating database schema:', error.message);
    return false;
  }
}

// Execute the initialization function
initializeDatabase()
  .then(success => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Uncaught error during database initialization:', error);
    process.exit(1);
  });