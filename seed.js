const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Hardcode the database URL for simplicity
const dbUrl = "postgres://neondb_owner:npg_SFGH8hn1Ckcq@ep-shiny-bird-abp64rd3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require";

// Create client
const client = neon(dbUrl);

async function seedDatabase() {
  try {
    console.log('Connecting to database...');
    await client('SELECT 1');
    console.log('Connection successful\!');
    
    // Delete existing data
    console.log('Clearing existing data from terms table...');
    await client('DELETE FROM terms');
    console.log('Terms table cleared');
    
    // Read seed data
    const seedPath = path.join(process.cwd(), 'data', 'seed', 'terms.json');
    if (\!fs.existsSync(seedPath)) {
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
seedDatabase()
  .then(() => {
    console.log('Database seeding completed');
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
