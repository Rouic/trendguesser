import { NextApiRequest, NextApiResponse } from 'next';
import { getLeaderboardByCategory } from '@/lib/db';
import { SearchCategory } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { category } = req.query;
      
      // Validate category is a string
      if (!category || typeof category !== 'string') {
        return res.status(400).json({ error: 'Category parameter is required' });
      }
      
      // Get leaderboard for the requested category
      const leaderboard = await getLeaderboardByCategory(category as SearchCategory);
      
      // Return the leaderboard
      return res.status(200).json(leaderboard);
    } catch (error) {
      console.error('Error in /api/leaderboard:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    // Only allow GET requests
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}