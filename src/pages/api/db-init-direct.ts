// Direct database initialization route
// This can be called manually if needed: curl http://localhost:3000/api/db-init-direct
import { NextApiRequest, NextApiResponse } from 'next';
import { initializeDatabase } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST method for security
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize the database
    await initializeDatabase();
    
    // Return success
    return res.status(200).json({ 
      success: true, 
      message: 'Database initialized successfully' 
    });
  } catch (error: any) {
    console.error('Failed to initialize database:', error);
    
    // Return error
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error',
      message: 'Failed to initialize database'
    });
  }
}