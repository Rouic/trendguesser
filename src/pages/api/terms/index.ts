import { NextApiRequest, NextApiResponse } from 'next';
import { getTermsByCategory } from '@/lib/db';
import { SearchCategory } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { category } = req.query;
      
      // Validate category is a string
      if (!category || typeof category !== 'string') {
        return res.status(400).json({ error: 'Category parameter is required' });
      }
      
      // Get terms for the requested category
      const terms = await getTermsByCategory(category as SearchCategory);
      
      // Return the terms
      return res.status(200).json(terms);
    } catch (error) {
      console.error('Error in /api/terms:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    // Only allow GET requests
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}