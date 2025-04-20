import { NextApiRequest, NextApiResponse } from 'next';
import { initializeDatabase } from '@/lib/db';

// This endpoint should only be called once during deployment setup
// or during development to initialize the database schema
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Ensure only POST requests are allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple API key check for security
  const apiKey = req.headers['x-api-key'];
  const configuredApiKey = process.env.DB_INIT_API_KEY;

  if (!configuredApiKey || apiKey !== configuredApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize the database schema
    await initializeDatabase();
    
    return res.status(200).json({ message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Error initializing database:', error);
    return res.status(500).json({ error: 'Failed to initialize database' });
  }
}