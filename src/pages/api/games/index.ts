import { NextApiRequest, NextApiResponse } from 'next';
import { createGame } from '@/lib/db';
import { GameData } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const gameData = req.body as GameData;
      
      // Validate required fields
      if (!gameData.id || !gameData.createdBy || !gameData.gameType || !gameData.status) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Create the game in the database
      await createGame(gameData);
      
      return res.status(201).json({ success: true, id: gameData.id });
    } catch (error) {
      console.error('Error creating game:', error);
      return res.status(500).json({ error: 'Failed to create game' });
    }
  } else {
    // Only allow POST requests
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}