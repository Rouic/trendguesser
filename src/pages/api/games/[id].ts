import { NextApiRequest, NextApiResponse } from 'next';
import { getGame, updateGame } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  // Validate id is a string
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Game ID is required' });
  }
  
  if (req.method === 'GET') {
    try {
      // Get game by ID
      const game = await getGame(id);
      
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      // Return the game
      return res.status(200).json(game);
    } catch (error) {
      console.error(`Error in GET /api/games/${id}:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PATCH' || req.method === 'PUT') {
    try {
      // Update game
      const updates = req.body;
      
      // Log the update for debugging
      console.log(`Updating game ${id} with data:`, JSON.stringify(updates).substring(0, 200) + '...');
      
      // Validate updates
      if (!updates) {
        return res.status(400).json({ error: 'Update data is required' });
      }
      
      // Check if game exists
      const existingGame = await getGame(id);
      if (!existingGame) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      // Extract user ID from update data to update player scores
      const playerKeys = Object.keys(updates).filter(key => 
        key !== 'status' && 
        key !== '__trendguesser.state' && 
        key !== 'id' &&
        typeof updates[key] === 'object' &&
        updates[key] !== null &&
        'score' in updates[key]
      );
      
      if (playerKeys.length > 0) {
        console.log(`Found player data updates for: ${playerKeys.join(', ')}`);
      }
      
      // Update the game
      await updateGame(id, updates);
      
      // Return success
      return res.status(200).json({ 
        success: true,
        message: 'Game updated successfully',
        updatedPlayers: playerKeys
      });
    } catch (error) {
      console.error(`Error in ${req.method} /api/games/${id}:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    // Only allow GET, PATCH, and PUT requests
    res.setHeader('Allow', ['GET', 'PATCH', 'PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}