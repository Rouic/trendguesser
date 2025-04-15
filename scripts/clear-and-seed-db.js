/**
 * Script to clear all terms and reseed the database
 * Run with: node clear-and-seed-db.js
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnvVariables() {
  const envFiles = [
    path.resolve(process.cwd(), '../', '.env.local'),
    path.resolve(process.cwd(), '../', '.env')
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

// Connect to database and perform operations
async function clearAndSeedDatabase() {
  // Load env variables if needed
  if (!process.env.NEON_DATABASE_URL) {
    loadEnvVariables();
  }

  // Get database URL
  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.error('NEON_DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  // Create client
  const client = neon(dbUrl);

  try {
    console.log('Connecting to database...');
    
    // Test connection
    await client('SELECT 1');
    console.log('Connection successful\!');
    
    // Delete existing data
    console.log('Clearing existing data from terms table...');
    await client('DELETE FROM terms');
    console.log('Terms table cleared');
    
    // Read seed data
    const seedPath = path.join(process.cwd(), 'data', 'seed', 'terms.json');
    if (!fs.existsSync(seedPath)) {
      console.error('Seed file not found at:', seedPath);
      process.exit(1);
    }
    
    const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    console.log(`Found ${seedData.length} terms in seed data`);
    
    // Import seed data
    console.log('Beginning transaction...');
    await client('BEGIN');
    
    try {
      let importCount = 0;
      for (const term of seedData) {
        await client(
          'INSERT INTO terms (id, term, volume, category, imageUrl, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            term.id,
            term.term,
            term.volume,
            term.category,
            term.imageUrl,
            term.timestamp || new Date().toISOString()
          ]
        );
        importCount++;
      }
      
      await client('COMMIT');
      console.log(`Successfully imported ${importCount} terms`);
      
      // Check count
      const result = await client('SELECT COUNT(*) FROM terms');
      if (result && result.rows && result.rows[0] && result.rows[0].count) {
        console.log(`Terms table now contains ${result.rows[0].count} records`);
      } else {
        console.log('Could not verify final count');
      }
    } catch (error) {
      await client('ROLLBACK');
      console.error('Error importing data:', error);
    }
  } catch (error) {
    console.error('Database error:', error);
  }
}

// Run the script
clearAndSeedDatabase()
  .then(() => {
    console.log('Database seeding completed');
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
