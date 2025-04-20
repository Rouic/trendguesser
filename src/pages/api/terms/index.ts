import { NextApiRequest, NextApiResponse } from 'next';
import { getTermsByCategory } from '@/lib/db';
import { SearchCategory } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { category, batch, count, lastId } = req.query;
      
      // Validate category is a string
      if (!category || typeof category !== 'string') {
        return res.status(400).json({ error: 'Category parameter is required' });
      }
      
      // Determine batch size - default to returning all (previous behavior)
      // but support batched loading
      let batchSize = 0; // 0 means all terms (backward compatible)
      if (batch === 'true' && count && typeof count === 'string') {
        batchSize = parseInt(count, 10);
        if (isNaN(batchSize) || batchSize <= 0) {
          batchSize = 100; // Default batch size
        }
      }
      
      // Check if this is a continuation request (using cursor-based pagination)
      const lastTermId = typeof lastId === 'string' ? lastId : undefined;
      
      // Get terms for the requested category with optional batching
      const terms = await getTermsByCategory(
        category as SearchCategory, 
        batchSize, 
        lastTermId
      );
      
      // Return the terms, optionally with pagination metadata
      if (batch === 'true') {
        return res.status(200).json({
          terms,
          totalReturned: terms.length,
          hasMore: terms.length === batchSize, // If we got exactly the batch size, there might be more
          lastId: terms.length > 0 ? terms[terms.length - 1].id : null
        });
      } else {
        // Original response format for backward compatibility
        return res.status(200).json(terms);
      }
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