// This script helps locate the compiled database module after build
const fs = require('fs');
const path = require('path');

// Directories to check
const directories = [
  path.resolve(__dirname, '../.next/server/chunks'),
  path.resolve(__dirname, '../.next/server/pages/api'),
  path.resolve(__dirname, '../.next/server/app')
];

// Search patterns to look for
const patterns = [
  'db.js',
  'lib_db.js',
  'database.js',
  'db-init.js'
];

console.log('Searching for compiled database module...');

// Check all directories
directories.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`\nChecking directory: ${dir}`);
    
    try {
      const files = fs.readdirSync(dir);
      
      // First, look for exact pattern matches
      const exactMatches = files.filter(file => patterns.includes(file));
      
      if (exactMatches.length > 0) {
        console.log('Found exact matches:');
        exactMatches.forEach(file => {
          console.log(`- ${path.join(dir, file)}`);
        });
      }
      
      // Then look for files containing 'db'
      const dbFiles = files.filter(file => 
        file.includes('db') && 
        file.endsWith('.js') && 
        !exactMatches.includes(file)
      );
      
      if (dbFiles.length > 0) {
        console.log('Found possible matches containing "db":');
        dbFiles.forEach(file => {
          console.log(`- ${path.join(dir, file)}`);
        });
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error.message);
    }
  } else {
    console.log(`Directory not found: ${dir}`);
  }
});

console.log('\nSearch complete. Use these paths in your initialization script.');