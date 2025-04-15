import { NextApiRequest, NextApiResponse } from 'next';
import { getCustomTermWithRelated } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { term } = req.query;
      
      // Validate term is a string
      if (!term || typeof term !== 'string') {
        return res.status(400).json({ error: 'Term parameter is required' });
      }
      
      // Get custom term with related terms
      const terms = await getCustomTermWithRelated(term);
      
      // Return the terms
      return res.status(200).json(terms);
    } catch (error) {
      console.error('Error in /api/terms/custom:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    // Only allow GET requests
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}