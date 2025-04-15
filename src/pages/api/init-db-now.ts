import { NextApiRequest, NextApiResponse } from 'next';
import { initializeDatabase } from '@/lib/db';

/**
 * This endpoint forcibly initializes the database
 * It's meant for debugging and development
 * POST /api/init-db-now
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      // Force a direct database initialization
      console.log('Forcibly initializing database from API endpoint...');
      
      // Direct initialization bypassing all checks
      if (!process.env.NEON_DATABASE_URL) {
        throw new Error('No NEON_DATABASE_URL environment variable found');
      }
      
      // Import the db module directly
      const { sql } = require('../../lib/db');
      
      // Drop existing tables for a clean slate (if force=true query param is provided)
      if (req.query.force === 'true') {
        console.log('FORCE mode activated - dropping existing tables');
        
        try {
          // Drop tables in the correct order to avoid foreign key constraints
          await sql('DROP TABLE IF EXISTS leaderboard CASCADE');
          await sql('DROP TABLE IF EXISTS games CASCADE');
          await sql('DROP TABLE IF EXISTS players CASCADE');
          await sql('DROP TABLE IF EXISTS terms CASCADE');
          console.log('Existing tables dropped successfully');
        } catch (dropError: any) {
          console.error('Error dropping tables:', dropError.message);
          // Continue anyway - we'll recreate them
        }
      }
      
      // Initialize database from scratch
      const startTime = Date.now();
      await initializeDatabase();
      const duration = Date.now() - startTime;
      
      // Get table counts
      const tables = ['terms', 'games', 'players', 'leaderboard'];
      const counts = {};
      
      for (const table of tables) {
        try {
          const result = await sql(`SELECT COUNT(*) FROM ${table}`);
          
          // Safely extract count with proper type checking
          let count = 'unknown';
          if (result) {
            if (Array.isArray(result) && result.length > 0 && 'count' in result[0]) {
              count = result[0].count;
            } else if (
              typeof result === 'object' && 
              result !== null && 
              'rows' in result && 
              Array.isArray(result.rows) && 
              result.rows.length > 0 && 
              result.rows[0] && 
              'count' in result.rows[0]
            ) {
              count = result.rows[0].count;
            }
          }
          
          counts[table] = count;
        } catch (countError) {
          counts[table] = 'error';
        }
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'Database initialized successfully',
        duration: `${duration}ms`,
        tables: counts
      });
    } catch (error: any) {
      console.error('Failed to initialize database:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Unknown error',
        message: 'Failed to initialize database'
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}