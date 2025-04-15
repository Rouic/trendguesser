// Database initialization script
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment variables from ${filePath}`);
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
    
    return true;
  }
  return false;
}

// First, try to load from .env.local, then fall back to .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (!loadEnvFile(envLocalPath)) {
  loadEnvFile(envPath);
}

// Function to initialize database
async function initializeDatabase() {
  // Check if we're in production mode
  const isProduction = process.env.NODE_ENV === 'production';
  
  try {
    let db;
    
    if (isProduction) {
      // In production, try to load from compiled JavaScript
      console.log('Running in production mode, looking for compiled database module...');
      
      // Try different possible paths for the compiled db module
      const possiblePaths = [
        '../.next/server/chunks/lib_db.js',
        '../.next/server/chunks/db.js',
        '../.next/server/pages/api/db-init.js'
      ];
      
      let foundPath = null;
      for (const relativePath of possiblePaths) {
        const fullPath = path.resolve(__dirname, relativePath);
        if (fs.existsSync(fullPath)) {
          foundPath = fullPath;
          break;
        }
      }
      
      if (foundPath) {
        console.log(`Found compiled module at ${foundPath}`);
        db = require(foundPath);
      } else {
        throw new Error('Could not find compiled database module in .next directory');
      }
    } else {
      // In development, use ts-node to load TypeScript files
      console.log('Running in development mode, using ts-node to load TypeScript');
      
      require('ts-node').register({
        transpileOnly: true,
        compilerOptions: {
          module: 'commonjs',
          esModuleInterop: true,
        }
      });
      
      // Try to load the TypeScript module
      db = require('../src/lib/db');
    }
    
    // Check if the module has the initialization function
    if (!db || typeof db.initializeDatabase !== 'function') {
      throw new Error('Database module found but missing initializeDatabase function');
    }
    
    // Run the initialization
    console.log('Starting database initialization...');
    await db.initializeDatabase();
    console.log('Database initialized successfully!');
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    
    // In production, try using direct ESM imports as a last resort
    if (isProduction) {
      console.log('Trying alternative method for production...');
      try {
        // Create a temporary file that imports the ESM module
        const tempFile = path.join(__dirname, 'temp-init.mjs');
        fs.writeFileSync(tempFile, `
          import { initializeDatabase } from '../.next/server/app/db.js';
          
          initializeDatabase()
            .then(() => {
              console.log('Database initialized successfully with ESM import!');
              process.exit(0);
            })
            .catch(err => {
              console.error('ESM initialization failed:', err);
              process.exit(1);
            });
        `);
        
        // Execute the file with Node.js
        const { execSync } = require('child_process');
        execSync(`node ${tempFile}`, { stdio: 'inherit' });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
      } catch (esmError) {
        console.error('All initialization methods failed:', esmError);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

// Run the initialization
initializeDatabase();