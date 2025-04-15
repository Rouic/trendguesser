// Simple database initialization script that works with compiled JavaScript
// This script is intended to be used after the build process

(async function() {
  try {
    // Try to load the compiled JavaScript version
    const db = require('../.next/server/chunks/lib_db.js');
    
    if (db && typeof db.initializeDatabase === 'function') {
      console.log('Initializing database...');
      await db.initializeDatabase();
      console.log('Database initialized successfully!');
    } else {
      throw new Error('Database module not found or invalid');
    }
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    console.log('If running in production, make sure you have run "npm run build" first');
    process.exit(1);
  }
})();