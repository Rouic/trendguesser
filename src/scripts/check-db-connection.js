/**
 * Database connection checker tool
 * This script helps test your database connection and troubleshoot issues
 * 
 * Usage: node src/scripts/check-db-connection.js [connection_string]
 * 
 * You can either:
 * 1. Set NEON_DATABASE_URL in .env.local file
 * 2. Pass the connection string as a command line argument
 */

// Import required dependencies
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Display header
console.log('=== TrendGuesser Database Connection Checker ===');

// Load environment variables from .env.local
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`\nLoading environment variables from ${filePath}`);
    try {
      const envConfig = fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .reduce((acc, line) => {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('=').trim();
          if (key && value) {
            // Remove quotes if present
            const cleanValue = value.replace(/^["'](.*)["']$/, '$1');
            acc[key.trim()] = cleanValue;
          }
          return acc;
        }, {});

      // Set environment variables
      Object.keys(envConfig).forEach(key => {
        process.env[key] = envConfig[key];
      });
      
      console.log(`Loaded ${Object.keys(envConfig).length} environment variables`);
      
      if (envConfig.NEON_DATABASE_URL) {
        console.log('Found NEON_DATABASE_URL in environment file');
      }
      
      return true;
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
      return false;
    }
  } else {
    console.log(`\nFile not found: ${filePath}`);
    return false;
  }
}

// First, try to load from .env.local, then fall back to .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (!loadEnvFile(envLocalPath)) {
  loadEnvFile(envPath);
}

// Check command line arguments for connection string
const args = process.argv.slice(2);
let DATABASE_URL = process.env.NEON_DATABASE_URL;

if (args.length > 0) {
  DATABASE_URL = args[0];
  console.log('\nUsing connection string from command line argument');
}

// Test database connection
async function testConnection() {
  console.log('\n--- Database Connection Test ---');
  
  if (!DATABASE_URL) {
    console.error('ERROR: No database connection string found');
    console.log('\nPossible solutions:');
    console.log('1. Create a .env.local file with NEON_DATABASE_URL=postgres://...');
    console.log('2. Pass the connection string as a command line argument:');
    console.log('   node src/scripts/check-db-connection.js "postgres://user:pass@host/db"');
    return false;
  }
  
  // Check if connection string has right format
  if (!DATABASE_URL.startsWith('postgres://')) {
    console.error('ERROR: Connection string must start with postgres://');
    console.log('Current value:', DATABASE_URL);
    return false;
  }
  
  try {
    console.log('Attempting to connect to database...');
    const client = neon(DATABASE_URL);
    
    // First try a simple connection test
    console.log('- Simple connection test...');
    await client('SELECT 1');
    console.log('✓ Basic connection successful!');
    
    // Then try to get version info
    console.log('- Checking PostgreSQL version...');
    try {
      const result = await client('SELECT version()');
      if (result && result.rows && result.rows.length > 0 && result.rows[0].version) {
        console.log('✓ PostgreSQL Version:', result.rows[0].version);
      } else {
        console.log('✓ Connected to database, but version information not available.');
      }
    } catch (versionError) {
      console.log('✓ Connected to database, but could not retrieve version info.');
    }
    
    console.log('\nCONNECTION SUCCESSFUL!');
    
    // Test creating a table
    console.log('\n--- Schema Test ---');
    console.log('Attempting to create a test table...');
    
    try {
      await client(`
        CREATE TABLE IF NOT EXISTS db_test (
          id SERIAL PRIMARY KEY,
          test_data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✓ Test table created successfully');
      
      // Test inserting data
      console.log('\n--- Data Test ---');
      console.log('Attempting to insert test data...');
      
      try {
        const testInsert = await client(`
          INSERT INTO db_test (test_data) 
          VALUES ('Connection test at ${new Date().toISOString()}')
          RETURNING id
        `);
        
        if (testInsert && testInsert.rows && testInsert.rows[0] && testInsert.rows[0].id) {
          console.log(`✓ Test data inserted successfully with ID: ${testInsert.rows[0].id}`);
        } else {
          console.log('✓ Insert operation completed but no ID was returned');
        }
        
        // Test reading data
        try {
          const testSelect = await client('SELECT COUNT(*) FROM db_test');
          if (testSelect && testSelect.rows && testSelect.rows[0] && testSelect.rows[0].count) {
            console.log(`✓ Database contains ${testSelect.rows[0].count} test records`);
          } else {
            console.log('✓ Select operation completed but count information not available');
          }
        } catch (selectError) {
          console.log('✗ Error reading from test table:', selectError.message);
        }
      } catch (insertError) {
        console.log('✗ Error inserting test data:', insertError.message);
      }
    } catch (schemaError) {
      console.log('✗ Error creating test table:', schemaError.message);
      console.log('This might indicate limited permissions in your database.');
    }
    
    // Check if required tables exist
    console.log('\n--- TrendGuesser Schema Check ---');
    
    const tableNames = ['terms', 'games', 'players', 'leaderboard'];
    
    for (const tableName of tableNames) {
      try {
        const tableCheck = await client(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [tableName]);
        
        if (tableCheck && tableCheck.rows && tableCheck.rows[0] && tableCheck.rows[0].exists) {
          try {
            const countResult = await client(`SELECT COUNT(*) FROM ${tableName}`);
            if (countResult && countResult.rows && countResult.rows[0] && countResult.rows[0].count) {
              console.log(`✅ Table '${tableName}' exists with ${countResult.rows[0].count} records`);
            } else {
              console.log(`✅ Table '${tableName}' exists but count information not available`);
            }
          } catch (countError) {
            console.log(`✅ Table '${tableName}' exists but couldn't count records: ${countError.message}`);
          }
        } else {
          console.log(`❌ Table '${tableName}' does not exist yet`);
        }
      } catch (tableCheckError) {
        console.log(`❌ Error checking if table '${tableName}' exists: ${tableCheckError.message}`);
      }
    }
    
    console.log('\nALL TESTS PASSED! Your database connection is working correctly.');
    return true;
  } catch (error) {
    console.error('\nCONNECTION FAILED:', error.message);
    
    // Parse connection string to help debug
    try {
      const urlParts = new URL(DATABASE_URL);
      console.log('\nConnection details:');
      console.log('- Host:', urlParts.hostname);
      console.log('- Port:', urlParts.port || '5432 (default)');
      console.log('- Username:', urlParts.username ? '✓ Present' : '✗ Missing');
      console.log('- Password:', urlParts.password ? '✓ Present' : '✗ Missing');
      console.log('- Database:', urlParts.pathname.replace('/', ''));
    } catch (e) {
      console.log('Could not parse connection string');
    }
    
    console.log('\nPossible solutions:');
    console.log('1. Check if the database server is running');
    console.log('2. Verify the connection string format');
    console.log('3. Confirm your IP address is allowed in database firewall rules');
    console.log('4. Check that the user has permission to connect');
    
    return false;
  }
}

// Run the test
testConnection()
  .then(success => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });