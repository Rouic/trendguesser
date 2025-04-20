import { NextApiRequest, NextApiResponse } from 'next';
import { updateHighScore, getPlayer } from '@/lib/db';
import { SearchCategory } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { playerUid, category, score, playerName } = req.body;
      
      // Debug log for API call
      console.log(`High score API called for player: ${playerUid} (${playerName || 'unnamed'}), category: ${category}, score: ${score}`);
      
      // Validate required parameters
      if (!playerUid || !category || score === undefined) {
        return res.status(400).json({
          error: 'Invalid input. Required parameters: playerUid, category, score'
        });
      }
      
      // Validate score is a number
      if (typeof score !== 'number' || score < 0) {
        return res.status(400).json({ error: 'Score must be a positive number' });
      }
      
      // Update high score in database - pass along the player name
      await updateHighScore(playerUid, category as SearchCategory, score, playerName);
      
      // Get updated player data
      const updatedPlayer = await getPlayer(playerUid);
      
      // Return success with updated player data
      return res.status(200).json({
        success: true,
        player: updatedPlayer,
        message: `High score updated for ${category}: ${score}`
      });
    } catch (error) {
      console.error('Error in POST /api/highscores:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    // Only allow POST requests
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}