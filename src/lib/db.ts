// src/lib/db.ts
import { neon, neonConfig } from '@neondatabase/serverless';
import { SearchCategory, SearchTerm, TrendGuesserPlayer as PlayerData, GameData } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { sampleSearchTerms } from './mockData';

// Configure Neon to use WebSockets (important for Edge functions)
neonConfig.webSocketConstructor = globalThis.WebSocket;
neonConfig.fetchConnectionCache = true;

// Use environment variable for connection string (set in Vercel dashboard)
const DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('NEON_DATABASE_URL is not defined. Using mock data.');
}

// We'll use a different approach to prevent repeated initialization
// Instead of relying on a memory flag which doesn't persist well in serverless,
// we'll check for the existence of tables directly

// Track if we've attempted initialization in this process
let initializationAttempted = false;

// SQL helper to execute queries with connection pooling
export async function sql(query: string, params: any[] = []): Promise<any> {
  try {
    if (!DATABASE_URL) {
      throw new Error('No database connection string provided');
    }
    
    // Only attempt initialization once per process instance
    if (!initializationAttempted && !query.includes('CREATE TABLE IF NOT EXISTS')) {
      initializationAttempted = true; // Mark as attempted regardless of success
      
      try {
        // Check if tables exist before trying to initialize
        const client = neon(DATABASE_URL);
        const tablesExist = await client(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'terms'
          )
        `);
        
        // Handle different response formats safely (type-safe way)
        let exists = false;
        
        if (tablesExist) {
          if (Array.isArray(tablesExist) && tablesExist.length > 0 && 'exists' in tablesExist[0]) {
            exists = Boolean(tablesExist[0].exists);
          } else if (typeof tablesExist === 'object' && 
                    tablesExist !== null && 
                    'rows' in tablesExist && 
                    Array.isArray(tablesExist.rows) && 
                    tablesExist.rows.length > 0 && 
                    tablesExist.rows[0] && 
                    'exists' in tablesExist.rows[0]) {
            exists = Boolean(tablesExist.rows[0].exists);
          }
        }
        
        if (!exists) {
          console.log('Database tables not found. Initializing once...');
          await initializeDatabase();
          console.log('Database tables created successfully.');
        } else if (process.env.DEBUG) {
          console.log('Database tables already exist. Skipping initialization.');
        }
      } catch (initError: any) {
        // Log but continue - we don't want to block queries if init fails
        console.error('Error during database initialization check:', initError.message);
      }
    }
    
    // Execute the actual query
    const client = neon(DATABASE_URL);
    return await client(query, params);
  } catch (error: any) {
    console.error('Database query error:', error);
    
    // Handle missing table error with one retry attempt
    if (error && 
        typeof error === 'object' && 
        'message' in error && 
        typeof error.message === 'string' &&
        error.message.includes('relation') && 
        error.message.includes('does not exist')) {
        
      // If this was a "relation does not exist" error
      console.log(`Table missing for query: ${query.substring(0, 50)}...`);
      
      // Try to fix by creating tables, but only retry once
      try {
        console.log('Attempting on-demand table creation...');
        await initializeDatabase();
        console.log('Tables created. Retrying query...');
        
        // Retry the original query
        const client = neon(DATABASE_URL);
        return await client(query, params);
      } catch (retryError: any) {
        console.error('Failed to create tables or retry query:', retryError.message);
      }
    }
    
    throw error;
  }
}

// Check if a table exists
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await sql(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);
    
    // Handle different response formats safely (type-safe way)
    let exists = false;
    
    if (result) {
      if (Array.isArray(result) && result.length > 0 && 'exists' in result[0]) {
        exists = Boolean(result[0].exists);
      } else if (
        typeof result === 'object' && 
        result !== null && 
        'rows' in result && 
        Array.isArray(result.rows) && 
        result.rows.length > 0 && 
        result.rows[0] && 
        'exists' in result.rows[0]
      ) {
        exists = Boolean(result.rows[0].exists);
      }
    }
    
    return exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

// Initialize database tables if they don't exist
export async function initializeDatabase() {
  // Skip if no database URL is provided
  if (!DATABASE_URL) {
    console.warn('No database connection string (NEON_DATABASE_URL) provided. Skipping initialization.');
    return;
  }
  
  try {
    // Test connection first
    const client = neon(DATABASE_URL);
    await client('SELECT 1');
    
    // We won't log anything here to reduce console noise
  } catch (connectionError: any) {
    console.error('Failed to connect to database:', connectionError.message);
    console.error('Please check your NEON_DATABASE_URL environment variable.');
    throw new Error('Database connection failed');
  }
  
  try {
    // Track tables to create
    const tables = {
      terms: false,
      games: false,
      players: false,
      leaderboard: false
    };
    
    // Check which tables already exist
    for (const tableName of Object.keys(tables)) {
      tables[tableName as keyof typeof tables] = await tableExists(tableName);
      if (tables[tableName as keyof typeof tables]) {
        console.log(`Table '${tableName}' already exists.`);
      } else {
        console.log(`Table '${tableName}' needs to be created.`);
      }
    }
    
    // Create missing tables
    if (!tables.terms) {
      console.log('Creating terms table...');
      await sql(`
        CREATE TABLE IF NOT EXISTS terms (
          id TEXT PRIMARY KEY,
          term TEXT NOT NULL,
          volume INTEGER NOT NULL,
          category TEXT NOT NULL,
          imageUrl TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Terms table created successfully.');
    }

    if (!tables.games) {
      console.log('Creating games table...');
      await sql(`
        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          createdBy TEXT NOT NULL,
          gameType TEXT NOT NULL,
          status TEXT NOT NULL,
          gameState JSONB
        )
      `);
      console.log('Games table created successfully.');
    }

    if (!tables.players) {
      console.log('Creating players table...');
      await sql(`
        CREATE TABLE IF NOT EXISTS players (
          uid TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          score INTEGER DEFAULT 0,
          highScores JSONB DEFAULT '{}'::jsonb
        )
      `);
      console.log('Players table created successfully.');
    }

    if (!tables.leaderboard) {
      console.log('Creating leaderboard table...');
      await sql(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id TEXT PRIMARY KEY,
          playerUid TEXT NOT NULL,
          playerName TEXT NOT NULL,
          category TEXT NOT NULL,
          score INTEGER NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Leaderboard table created successfully.');
    }

    console.log('Database schema created successfully');
    
    // Import seed data if the terms table is empty
    try {
      const termsCount = await sql('SELECT COUNT(*) FROM terms');
      
      // Handle response safely regardless of format, with proper type checking
      let count: string | number = '0';
      
      if (termsCount) {
        if (Array.isArray(termsCount) && termsCount.length > 0 && 'count' in termsCount[0]) {
          count = termsCount[0].count;
        } else if (
          typeof termsCount === 'object' && 
          termsCount !== null && 
          'rows' in termsCount && 
          Array.isArray(termsCount.rows) && 
          termsCount.rows.length > 0 && 
          termsCount.rows[0] && 
          'count' in termsCount.rows[0]
        ) {
          count = termsCount.rows[0].count;
        }
      }
                   
      if (count === '0' || count === 0) {
        console.log('Terms table is empty. Importing seed data...');
        await importTermsFromSeedData();
      } else {
        // Always log this to make it visible
        console.log(`Terms table already contains ${count} records. Skipping seed import.`);
      }
    } catch (countError) {
      console.error('Error checking terms count:', countError);
      console.log('Attempting to import seed data anyway...');
      try {
        await importTermsFromSeedData();
      } catch (seedError) {
        console.error('Error importing seed data:', seedError);
      }
    }
    
    if (process.env.DEBUG) {
      console.log('Database initialization complete');
    }
    
    // Mark initialization as successful
    initializationAttempted = true;
    return true;
  } catch (schemaError: any) {
    console.error('Failed to create database schema:', schemaError.message);
    throw new Error('Database schema creation failed');
  }
}

// Import terms from the project's seed data
async function importTermsFromSeedData() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check for JSON file first (preferred format)
    const jsonPath = path.join(process.cwd(), 'data', 'seed', 'terms.json');
    if (fs.existsSync(jsonPath)) {
      // Import from JSON file
      return await importTermsFromJson(jsonPath);
    }
    
    // If JSON not available, try CSV
    const csvPath = path.join(process.cwd(), 'data', 'seed', 'data.csv');
    if (fs.existsSync(csvPath)) {
      // Import from CSV file
      return await importTermsFromCsv(csvPath);
    }
    
    // If neither file exists, use sample data
    console.log('No seed files found. Using sample data instead.');
    await importSampleTermsFromArray();
  } catch (error) {
    console.error('Error importing terms from seed data:', error);
    // Fallback to sample data if any import fails
    console.log('Falling back to sample data');
    await importSampleTermsFromArray();
  }
}

// Import terms from JSON file
async function importTermsFromJson(jsonPath) {
  try {
    const fs = require('fs');
    
    // Read and parse the JSON file
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const terms = JSON.parse(jsonContent);
    
    if (!Array.isArray(terms) || terms.length === 0) {
      console.log('JSON file is empty or invalid. Using sample data instead.');
      await importSampleTermsFromArray();
      return;
    }
    
    // Begin transaction
    await sql('BEGIN');
    
    let importCount = 0;
    
    for (const term of terms) {
      if (term.term && term.volume && term.category) {
        await sql(
          'INSERT INTO terms (id, term, volume, category, imageUrl, timestamp) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [
            term.id || term.term.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            term.term,
            term.volume,
            term.category,
            term.imageUrl || `/api/image?term=${encodeURIComponent(term.term)}`,
            term.timestamp || new Date()
          ]
        );
        importCount++;
      }
    }
    
    await sql('COMMIT');
    console.log(`Imported ${importCount} terms from seed JSON file`);
  } catch (error) {
    await sql('ROLLBACK');
    console.error('Error importing terms from JSON:', error);
    throw error;
  }
}

// Import terms from CSV file
async function importTermsFromCsv(csvPath) {
  try {
    const fs = require('fs');
    
    // Read and parse the CSV file
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    
    if (lines.length <= 1) {
      console.log('CSV file is empty or has only headers. Using sample data instead.');
      await importSampleTermsFromArray();
      return;
    }
    
    // Begin transaction
    await sql('BEGIN');
    
    let importCount = 0;
    
    // Skip header (first line)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',');
      if (values.length >= 3) {
        const keyword = values[0].trim();
        const category = values[1].trim().toLowerCase() as SearchCategory;
        const volume = parseInt(values[2].trim(), 10) || 0;
        
        const termId = keyword.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const imageUrl = `/api/image?term=${encodeURIComponent(keyword)}`;
        
        await sql(
          'INSERT INTO terms (id, term, volume, category, imageUrl, timestamp) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [termId, keyword, volume, category, imageUrl, new Date()]
        );
        importCount++;
      }
    }
    
    await sql('COMMIT');
    console.log(`Imported ${importCount} terms from seed CSV file`);
  } catch (error) {
    await sql('ROLLBACK');
    console.error('Error importing terms from CSV:', error);
    throw error;
  }
}

// Import sample terms from the predefined array
async function importSampleTermsFromArray() {
  try {
    // Begin transaction
    await sql('BEGIN');
    
    for (const term of sampleSearchTerms) {
      await sql(
        'INSERT INTO terms (id, term, volume, category, imageUrl, timestamp) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
        [
          term.id || uuidv4(),
          term.term,
          term.volume,
          term.category,
          term.imageUrl || `/api/image?term=${encodeURIComponent(term.term)}`,
          term.timestamp || new Date()
        ]
      );
    }
    
    await sql('COMMIT');
    console.log(`Imported ${sampleSearchTerms.length} sample terms from predefined array`);
  } catch (error) {
    await sql('ROLLBACK');
    console.error('Error importing sample terms:', error);
  }
}

// Functions for terms
export async function getTerms(): Promise<SearchTerm[]> {
  try {
    if (!DATABASE_URL) {
      return sampleSearchTerms;
    }
    
    const result = await sql('SELECT * FROM terms');
    
    // Handle different response formats safely
    if (!result) {
      console.log('No result from database for terms, using sample data');
      return sampleSearchTerms;
    }
    
    const rows = Array.isArray(result) ? result : (result.rows || []);
    
    if (!rows || !rows.length) {
      console.log('No rows in result for terms, using sample data');
      return sampleSearchTerms;
    }
    
    return rows.map((row: any) => ({
      id: row.id,
      term: row.term,
      volume: parseInt(row.volume) || 0,
      category: row.category || 'unknown',
      imageUrl: row.imageurl || `/api/image?term=${encodeURIComponent(row.term)}`,
      timestamp: row.timestamp || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error fetching terms:', error);
    return sampleSearchTerms;
  }
}

export async function getTermsByCategory(category: SearchCategory): Promise<SearchTerm[]> {
  try {
    if (!DATABASE_URL) {
      // Return filtered sample data if no database connection
      if (category === 'everything') {
        return sampleSearchTerms;
      } else if (category === 'latest') {
        return [...sampleSearchTerms].sort((a, b) => {
          const dateA = a.timestamp ? new Date(a.timestamp as string).getTime() : 0;
          const dateB = b.timestamp ? new Date(b.timestamp as string).getTime() : 0;
          return dateB - dateA;
        });
      } else {
        return sampleSearchTerms.filter(term => term.category === category);
      }
    }
    
    if (category === 'everything') {
      return getTerms();
    } else if (category === 'latest') {
      const result = await sql('SELECT * FROM terms ORDER BY timestamp DESC LIMIT 100');
      
      // Handle different response formats safely
      if (!result) {
        console.log('No result from database for latest terms, using sample data');
        return [...sampleSearchTerms].sort((a, b) => {
          const dateA = a.timestamp ? new Date(a.timestamp as string).getTime() : 0;
          const dateB = b.timestamp ? new Date(b.timestamp as string).getTime() : 0;
          return dateB - dateA;
        });
      }
      
      const rows = Array.isArray(result) ? result : (result.rows || []);
      
      if (!rows || !rows.length) {
        console.log('No rows in result for latest terms, using sample data');
        return [...sampleSearchTerms].sort((a, b) => {
          const dateA = a.timestamp ? new Date(a.timestamp as string).getTime() : 0;
          const dateB = b.timestamp ? new Date(b.timestamp as string).getTime() : 0;
          return dateB - dateA;
        });
      }
      
      return rows.map((row: any) => ({
        id: row.id,
        term: row.term,
        volume: parseInt(row.volume) || 0,
        category: row.category || 'unknown',
        imageUrl: row.imageurl || `/api/image?term=${encodeURIComponent(row.term)}`,
        timestamp: row.timestamp || new Date().toISOString()
      }));
    } else {
      const result = await sql('SELECT * FROM terms WHERE category = $1', [category]);
      
      // Handle different response formats safely
      if (!result) {
        console.log(`No result from database for category ${category}, using sample data`);
        return sampleSearchTerms.filter(term => term.category === category);
      }
      
      const rows = Array.isArray(result) ? result : (result.rows || []);
      
      if (!rows || !rows.length) {
        console.log(`No rows in result for category ${category}, using sample data`);
        return sampleSearchTerms.filter(term => term.category === category);
      }
      
      return rows.map((row: any) => ({
        id: row.id,
        term: row.term,
        volume: parseInt(row.volume) || 0,
        category: row.category || 'unknown',
        imageUrl: row.imageurl || `/api/image?term=${encodeURIComponent(row.term)}`,
        timestamp: row.timestamp || new Date().toISOString()
      }));
    }
  } catch (error) {
    console.error(`Error fetching terms by category ${category}:`, error);
    
    // Fallback to sample data
    if (category === 'everything') {
      return sampleSearchTerms;
    } else if (category === 'latest') {
      return [...sampleSearchTerms].sort((a, b) => {
        const dateA = a.timestamp ? new Date(a.timestamp as string).getTime() : 0;
        const dateB = b.timestamp ? new Date(b.timestamp as string).getTime() : 0;
        return dateB - dateA;
      });
    } else {
      return sampleSearchTerms.filter(term => term.category === category);
    }
  }
}

export async function getCustomTermWithRelated(term: string): Promise<SearchTerm[]> {
  // Create a custom term
  const customTerm: SearchTerm = {
    id: `custom-${Date.now()}`,
    term,
    volume: Math.floor(Math.random() * 1000000),
    category: 'custom',
    imageUrl: `/api/image?term=${encodeURIComponent(term)}`,
    timestamp: new Date().toISOString()
  };
  
  try {
    if (!DATABASE_URL) {
      // Return custom term with random sample terms if no database
      const relatedTerms = [...sampleSearchTerms]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
      
      return [customTerm, ...relatedTerms];
    }
    
    // Get 10 random terms from the database
    const result = await sql('SELECT * FROM terms ORDER BY RANDOM() LIMIT 10');
    
    // Handle different response formats safely
    if (!result) {
      console.log('No result from database for related terms, using sample data');
      const relatedTerms = [...sampleSearchTerms]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
        
      return [customTerm, ...relatedTerms];
    }
    
    const rows = Array.isArray(result) ? result : (result.rows || []);
    
    if (!rows || !rows.length) {
      console.log('No rows in result for related terms, using sample data');
      const relatedTerms = [...sampleSearchTerms]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
        
      return [customTerm, ...relatedTerms];
    }
    
    const relatedTerms = rows.map((row: any) => ({
      id: row.id,
      term: row.term,
      volume: parseInt(row.volume) || 0,
      category: row.category || 'unknown',
      imageUrl: row.imageurl || `/api/image?term=${encodeURIComponent(row.term)}`,
      timestamp: row.timestamp || new Date().toISOString()
    }));
    
    return [customTerm, ...relatedTerms];
  } catch (error) {
    console.error('Error getting related terms:', error);
    
    // Fallback to sample data
    const relatedTerms = [...sampleSearchTerms]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);
    
    return [customTerm, ...relatedTerms];
  }
}

// Functions for games
export async function getGame(gameId: string): Promise<GameData | null> {
  try {
    if (!DATABASE_URL) {
      return null; // No mock implementation for getGame
    }
    
    const result = await sql('SELECT * FROM games WHERE id = $1', [gameId]);
    
    // Handle different response formats safely
    if (!result) {
      console.log(`No result from database for game ${gameId}`);
      return null;
    }
    
    // Handle both array format and rows format
    const rows = Array.isArray(result) ? result : (result.rows || []);
    
    if (!rows || rows.length === 0) {
      console.log(`Game not found with ID: ${gameId}`);
      return null;
    }
    
    const game = rows[0];
    
    // Check if the game object has the expected fields
    if (!game || !game.id) {
      console.log(`Invalid game data for ID: ${gameId}`, game);
      return null;
    }
    
    // Extract fields with safe fallbacks
    return {
      id: game.id,
      createdAt: game.createdat || game.created_at || new Date().toISOString(),
      createdBy: game.createdby || game.created_by || 'unknown',
      gameType: game.gametype || game.game_type || 'trendguesser',
      status: game.status || 'unknown',
      '__trendguesser.state': game.gamestate || game.game_state || {}
    };
  } catch (error) {
    console.error('Error fetching game:', error);
    return null;
  }
}

export async function createGame(gameData: GameData): Promise<void> {
  try {
    if (!DATABASE_URL) {
      console.warn('No database connection, skipping game creation');
      return;
    }
    
    await sql(
      'INSERT INTO games (id, createdBy, gameType, status, gameState) VALUES ($1, $2, $3, $4, $5)',
      [
        gameData.id,
        gameData.createdBy,
        gameData.gameType,
        gameData.status,
        JSON.stringify(gameData['__trendguesser.state'] || {})
      ]
    );
  } catch (error) {
    console.error('Error creating game:', error);
    throw error;
  }
}

export async function updateGame(gameId: string, updates: Partial<GameData>): Promise<void> {
  try {
    if (!DATABASE_URL) {
      console.warn('No database connection, skipping game update');
      return;
    }
    
    // Build the update query dynamically based on the fields in updates
    const fields = [];
    const values = [];
    let paramCounter = 1;
    
    if (updates.status) {
      fields.push(`status = $${paramCounter}`);
      values.push(updates.status);
      paramCounter++;
    }
    
    if (updates['__trendguesser.state']) {
      fields.push(`gameState = $${paramCounter}`);
      values.push(JSON.stringify(updates['__trendguesser.state']));
      paramCounter++;
    }
    
    if (fields.length === 0) {
      return; // Nothing to update
    }
    
    // Add the gameId as the last parameter
    values.push(gameId);
    
    await sql(
      `UPDATE games SET ${fields.join(', ')} WHERE id = $${paramCounter}`,
      values
    );
  } catch (error) {
    console.error('Error updating game:', error);
    throw error;
  }
}

// Functions for players
export async function getPlayer(playerId: string): Promise<PlayerData | null> {
  try {
    if (!DATABASE_URL) {
      return {
        uid: playerId,
        name: 'Player',
        score: 0,
        highScores: {}
      };
    }
    
    const result = await sql('SELECT * FROM players WHERE uid = $1', [playerId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const player = result.rows[0];
    return {
      uid: player.uid,
      name: player.name,
      score: parseInt(player.score),
      highScores: player.highscores
    };
  } catch (error) {
    console.error('Error fetching player:', error);
    
    // Return default player data
    return {
      uid: playerId,
      name: 'Player',
      score: 0,
      highScores: {}
    };
  }
}

export async function updatePlayer(playerId: string, updates: Partial<PlayerData>): Promise<void> {
  try {
    if (!DATABASE_URL) {
      console.warn('No database connection, skipping player update');
      return;
    }
    
    // Check if player exists
    const playerExists = await getPlayer(playerId);
    
    if (playerExists) {
      // Build the update query dynamically based on the fields in updates
      const fields = [];
      const values = [];
      let paramCounter = 1;
      
      if (updates.name) {
        fields.push(`name = $${paramCounter}`);
        values.push(updates.name);
        paramCounter++;
      }
      
      if (updates.score !== undefined) {
        fields.push(`score = $${paramCounter}`);
        values.push(updates.score);
        paramCounter++;
      }
      
      if (updates.highScores) {
        fields.push(`highScores = $${paramCounter}`);
        values.push(JSON.stringify(updates.highScores));
        paramCounter++;
      }
      
      if (fields.length === 0) {
        return; // Nothing to update
      }
      
      // Add the playerId as the last parameter
      values.push(playerId);
      
      await sql(
        `UPDATE players SET ${fields.join(', ')} WHERE uid = $${paramCounter}`,
        values
      );
    } else {
      // Create new player
      await sql(
        'INSERT INTO players (uid, name, score, highScores) VALUES ($1, $2, $3, $4)',
        [
          playerId,
          updates.name || 'Player',
          updates.score || 0,
          JSON.stringify(updates.highScores || {})
        ]
      );
    }
  } catch (error) {
    console.error('Error updating player:', error);
    throw error;
  }
}

export async function updateHighScore(playerId: string, category: SearchCategory, score: number): Promise<void> {
  try {
    if (!DATABASE_URL) {
      console.warn('No database connection, skipping high score update');
      return;
    }
    
    // Get the player first
    const player = await getPlayer(playerId);
    let highScores = {};
    
    if (player) {
      highScores = player.highScores || {};
      
      // Only update if the new score is higher
      if (!highScores[category] || score > highScores[category]) {
        highScores[category] = score;
        
        // Update the player record
        await updatePlayer(playerId, { highScores });
        
        // Update the leaderboard
        await updateLeaderboard(playerId, category, score, player.name);
      }
    } else {
      // Create a new player with this high score
      highScores = { [category]: score };
      await updatePlayer(playerId, {
        name: 'Player',
        score: 0,
        highScores
      });
      
      // Add to leaderboard
      await updateLeaderboard(playerId, category, score, 'Player');
    }
  } catch (error) {
    console.error('Error updating high score:', error);
    throw error;
  }
}

// Functions for leaderboard
export async function getLeaderboardByCategory(category: SearchCategory): Promise<PlayerData[]> {
  try {
    if (!DATABASE_URL) {
      // Return empty leaderboard if no database
      return [];
    }
    
    const result = await sql(
      `SELECT l.playerUid, l.playerName, l.score, p.highScores
       FROM leaderboard l
       LEFT JOIN players p ON l.playerUid = p.uid
       WHERE l.category = $1
       ORDER BY l.score DESC
       LIMIT 10`,
      [category]
    );
    
    return result.rows.map((row: any) => ({
      uid: row.playeruid,
      name: row.playername,
      score: parseInt(row.score),
      highScores: row.highscores || { [category]: parseInt(row.score) }
    }));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

export async function updateLeaderboard(
  playerId: string,
  category: SearchCategory,
  score: number,
  playerName: string
): Promise<void> {
  try {
    if (!DATABASE_URL) {
      console.warn('No database connection, skipping leaderboard update');
      return;
    }
    
    // Check if this player already has an entry for this category
    const existingEntry = await sql(
      'SELECT * FROM leaderboard WHERE playerUid = $1 AND category = $2',
      [playerId, category]
    );
    
    if (existingEntry.rows.length > 0) {
      const currentScore = parseInt(existingEntry.rows[0].score);
      
      // Only update if the new score is higher
      if (score > currentScore) {
        await sql(
          'UPDATE leaderboard SET score = $1, playerName = $2, timestamp = NOW() WHERE playerUid = $3 AND category = $4',
          [score, playerName, playerId, category]
        );
      }
    } else {
      // Create a new entry
      await sql(
        'INSERT INTO leaderboard (id, playerUid, playerName, category, score) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), playerId, playerName, category, score]
      );
    }
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    throw error;
  }
}

// Import CSV data from Firebase's format into our own format
export async function importData(csvData: string): Promise<void> {
  if (!csvData) return;
  
  const lines = csvData.split('\n');
  if (lines.length <= 1) return; // Only header or empty file
  
  try {
    if (!DATABASE_URL) {
      console.warn('No database connection, skipping data import');
      return;
    }
    
    // Begin transaction
    await sql('BEGIN');
    
    let importCount = 0;
    
    // Skip header (first line)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',');
      if (values.length >= 3) {
        const keyword = values[0].trim();
        const category = values[1].trim().toLowerCase() as SearchCategory;
        const volume = parseInt(values[2].trim(), 10) || 0;
        
        const termId = keyword.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const imageUrl = `/api/image?term=${encodeURIComponent(keyword)}`;
        
        try {
          await sql(
            'INSERT INTO terms (id, term, volume, category, imageUrl, timestamp) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET volume = $3, category = $4, imageUrl = $5',
            [termId, keyword, volume, category, imageUrl, new Date()]
          );
          importCount++;
        } catch (err) {
          console.error(`Error importing term ${keyword}:`, err);
        }
      }
    }
    
    await sql('COMMIT');
    console.log(`Imported ${importCount} terms from CSV`);
  } catch (error) {
    await sql('ROLLBACK');
    console.error('Error importing data from CSV:', error);
    throw error;
  }
}