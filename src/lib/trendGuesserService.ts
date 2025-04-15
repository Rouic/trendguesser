// src/lib/trendGuesserService.ts

import { v4 as uuidv4 } from 'uuid';
import { SearchCategory, SearchTerm, TrendGuesserGameState, TrendGuesserPlayer, GameData } from '@/types';
import { sampleSearchTerms, sampleLeaderboard } from './mockData';

export class TrendGuesserService {
  static isProcessingGuess: boolean = false;

  // Create a new game session
  static async createGame(createdBy: string, playerName: string): Promise<string> {
    try {
      // Generate a short 6-character game ID (uppercase)
      const gameId = this.generateGameId();
      
      // Create an empty initial game state in localStorage for immediate access
      if (typeof window !== 'undefined') {
        const initialGameData = {
          id: gameId,
          status: 'waiting',
          createdBy: createdBy,
          gameType: 'trendguesser',
          createdAt: new Date().toISOString(),
          [createdBy]: {
            uid: createdBy,
            name: playerName || 'Player',
            score: 0
          }
        };

        // Store the current game ID in session storage
        sessionStorage.setItem('current_game_id', gameId);
        
        // Make API call to create game on the server
        const response = await fetch('/api/games', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(initialGameData),
        });

        if (!response.ok) {
          throw new Error('Failed to create game on server');
        }

        return gameId;
      }
      
      return gameId;
    } catch (error) {
      console.error('Error creating game:', error);
      return this.generateGameId();
    }
  }

  // Start a new game with selected category
  static async startGame(gameId: string, category: SearchCategory, customTerm?: string): Promise<TrendGuesserGameState | null> {
    try {
      console.log(`TrendGuesserService.startGame: Starting game ${gameId} with category ${category}`);
      
      // Get terms for the selected category
      let terms: SearchTerm[] = [];
      
      if (category === 'custom' && customTerm) {
        // For custom games, fetch the custom term and related terms
        terms = await this.fetchCustomTermWithRelated(customTerm);
      } else {
        // For predefined categories, fetch terms from the API
        terms = await this.fetchTermsByCategory(category);
      }
      
      if (terms.length < 2) {
        console.error('Not enough terms available for category:', category);
        throw new Error('Not enough terms available');
      }
      
      // Shuffle the terms
      const shuffledTerms = this.shuffleTerms(terms);
      
      // Initialize game state with first two terms
      const gameState: TrendGuesserGameState = {
        currentRound: 1,
        knownTerm: shuffledTerms[0],
        hiddenTerm: shuffledTerms[1],
        category,
        started: true,
        finished: false,
        usedTerms: [shuffledTerms[0].id, shuffledTerms[1].id],
        terms: shuffledTerms.slice(2), // Store remaining terms
        customTerm: category === 'custom' && customTerm ? customTerm : null
      };
      
      // Get current game ID from session storage
      const currentGameId = sessionStorage.getItem('current_game_id');
      if (currentGameId !== gameId) {
        console.warn('WARNING: current_game_id mismatch in trendGuesserService. Current:', currentGameId, 'Using:', gameId);
        // Update to ensure consistency
        sessionStorage.setItem('current_game_id', gameId);
      }
      
      try {
        // Update game state on the server
        const response = await fetch(`/api/games/${gameId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'active',
            '__trendguesser.state': gameState
          }),
        });

        if (!response.ok) {
          console.warn('Failed to update game state on server. Continuing with local state.');
        }
      } catch (err) {
        console.error('Error updating game state on server:', err);
      }
      
      // Return the created game state for immediate use
      return gameState;
    } catch (error) {
      console.error('Error starting game:', error);
      
      // Create and return a basic fallback game state
      const fallbackState: TrendGuesserGameState = {
        currentRound: 1,
        knownTerm: sampleSearchTerms[0],
        hiddenTerm: sampleSearchTerms[1],
        category: category || ('everything' as SearchCategory),
        started: true,
        finished: false,
        usedTerms: [sampleSearchTerms[0].id, sampleSearchTerms[1].id],
        terms: sampleSearchTerms.slice(2),
        customTerm: category === 'custom' && customTerm ? customTerm : null
      };
      
      return fallbackState;
    }
  }

  // Make a guess (higher or lower)
static async makeGuess(
  gameId: string, 
  playerUid: string, 
  isHigher: boolean, 
  clientGameState?: TrendGuesserGameState | null
): Promise<boolean> {
  try {
    // Prevent multiple simultaneous processing
    if (TrendGuesserService.isProcessingGuess) {
      console.log('[TrendGuesserService.makeGuess] Already processing a guess, skipping');
      return false;
    }
    
    // Set the flag to prevent reentrancy
    TrendGuesserService.isProcessingGuess = true;
    
    console.log('[TrendGuesserService.makeGuess] Starting with:', { 
      gameId, 
      playerUid, 
      isHigher,
      clientStateRound: clientGameState?.currentRound
    });
    
    // Check if we need to use the current_game_id
    const currentGameId = sessionStorage.getItem("current_game_id");
    if (currentGameId && currentGameId !== gameId) {
      console.warn('[TrendGuesserService.makeGuess] WARNING: gameId mismatch. Using current_game_id:', currentGameId, 'instead of:', gameId);
      gameId = currentGameId;
    }
    
    try {
      // Fetch current game state from API or use client provided state
      let gameState: TrendGuesserGameState;
      let player: TrendGuesserPlayer;
      
      // CRITICAL FIX: Prioritize client state if available
      if (clientGameState) {
        console.log('[TrendGuesserService.makeGuess] Using client-provided game state for round:', 
          clientGameState.currentRound);
        gameState = clientGameState;
      } else {
        try {
          // Fallback to API fetch if no client state
          const response = await fetch(`/api/games/${gameId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch game data');
          }
          const gameData = await response.json();
          gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
        } catch (err) {
          console.warn('Could not fetch game data from server:', err);
          throw new Error('No game state available');
        }
      }
      
      // Get or initialize player
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (response.ok) {
          const gameData = await response.json();
          player = gameData[playerUid] as TrendGuesserPlayer;
        } else {
          throw new Error('Failed to fetch player data');
        }
      } catch (err) {
        console.warn('Could not fetch player data, using default:', err);
        player = {
          uid: playerUid,
          name: 'Player',
          score: 0
        };
      }
      
      // Initialize player with defaults if missing or incomplete
      if (!player || typeof player !== 'object') {
        player = {
          uid: playerUid,
          name: 'Player',
          score: 0
        };
      } else {
        // Ensure score property exists
        player.score = player.score || 0;
      }
      
      // Ensure the game is in active state
      gameState.started = true;
      gameState.finished = false;
      
      // Ensure we have valid term data
      if (!gameState.knownTerm || !gameState.hiddenTerm) {
        throw new Error('Invalid game state - missing term data');
      }
      
      // Log current game state
      console.log('[TrendGuesserService.makeGuess] Current game state:', {
        round: gameState.currentRound,
        category: gameState.category,
        knownTerm: gameState.knownTerm?.term || 'unknown',
        knownVolume: gameState.knownTerm?.volume ?? 0,
        hiddenTerm: gameState.hiddenTerm?.term || 'unknown',
        hiddenVolume: gameState.hiddenTerm?.volume ?? 0,
        playerScore: player?.score ?? 0,
        remainingTerms: gameState.terms?.length || 0
      });
      
      // Extract the volumes for comparison
      const knownVolume = gameState.knownTerm?.volume ?? 100;
      const hiddenVolume = gameState.hiddenTerm?.volume ?? 200;
      
      // Determine if the guess is correct
      let isCorrect;
      
      // EDGE CASE: If volumes are exactly equal, the guess is ALWAYS correct
      if (hiddenVolume === knownVolume) {
        console.log('[TrendGuesserService.makeGuess] Equal volumes detected - counting as correct!');
        isCorrect = true;
      } else {
        // Standard comparison
        const actuallyHigher = hiddenVolume > knownVolume;
        isCorrect = isHigher ? actuallyHigher : !actuallyHigher;
        
        console.log('[TrendGuesserService.makeGuess] Comparison:', {
          hiddenVolume,
          knownVolume,
          actuallyHigher,
          playerGuessedHigher: isHigher,
          isCorrect
        });
      }
      
      // Process the guess result
      if (isCorrect) {
        console.log('[TrendGuesserService.makeGuess] Correct guess - preparing next round');
        
        // Update player score
        const newScore = (player.score || 0) + 1;
        player.score = newScore;
        
        console.log('[TrendGuesserService.makeGuess] Updated player score to:', newScore);
        
        // CRITICAL FIX: Update localStorage with current score immediately
        try {
          if (typeof window !== "undefined") {
            // Save player with updated score to localStorage
            const playerDataKey = `tg_player_${playerUid}`;
            localStorage.setItem(playerDataKey, JSON.stringify(player));
            
            // Also update high scores if this is a new high score
            const highScoresKey = `tg_highscores_${playerUid}`;
            let existingScores = {};
            const storedScores = localStorage.getItem(highScoresKey);
            if (storedScores) {
              try {
                existingScores = JSON.parse(storedScores);
              } catch (e) {
                console.error('Error parsing stored high scores:', e);
              }
            }
            
            // Only update if score is higher than existing
            const currentHighScore = existingScores[gameState.category] || 0;
            if (newScore > currentHighScore) {
              existingScores[gameState.category] = newScore;
              localStorage.setItem(highScoresKey, JSON.stringify(existingScores));
              console.log(`Updated high score for ${gameState.category} to ${newScore}`);
            }
            
            // Also send a storage event to notify other components
            window.dispatchEvent(new Event('storage'));
          }
        } catch (e) {
          console.error("Error saving player data to localStorage:", e);
        }
        
        // Update the game on the server
        try {
          // CRITICAL FIX: Use client state for consistency if available
          const stateToUpdate = clientGameState || gameState;
          
          const updateResponse = await fetch(`/api/games/${gameId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'active',
              '__trendguesser.state': stateToUpdate,
              [playerUid]: player
            }),
          });
          
          if (!updateResponse.ok) {
            console.warn('Failed to update game on server. Continuing with local state.');
          }
        } catch (err) {
          console.error('Error updating game on server:', err);
        }
        
        // Clear processing flag before returning
        TrendGuesserService.isProcessingGuess = false;
        
        // Return success
        return true;
      } else {
        // Wrong guess - game over
        console.log('[TrendGuesserService.makeGuess] Incorrect guess - returning false');
        
        // Save the final score for high score tracking
        const finalScore = player.score || 0;
        
        // CRITICAL FIX: Make sure to update the high score both locally and on server
        try {
          await this.updateHighScore(
            playerUid, 
            gameState.category, 
            finalScore
          );
          console.log('[TrendGuesserService.makeGuess] Updated high score for game over');
        } catch (highScoreErr) {
          console.error('[TrendGuesserService.makeGuess] Failed to update high score, but game is still over:', highScoreErr);
        }
        
        // Clear processing flag before returning
        TrendGuesserService.isProcessingGuess = false;
        
        // Return failure
        return false;
      }
    } catch (err) {
      console.error('Error during makeGuess:', err);
      TrendGuesserService.isProcessingGuess = false;
      return false;
    }
  } catch (error) {
    // Always clear the flag on error
    TrendGuesserService.isProcessingGuess = false;
    console.error('[TrendGuesserService.makeGuess] Error:', error);
    throw error;
  }
}
  
  // End the game and update high scores
  static async endGame(gameId: string, playerUid: string, finalScore: number): Promise<void> {
    try {
      console.log(`[TrendGuesserService.endGame] Ending game ${gameId} for player ${playerUid} with score ${finalScore}`);
      
      // Get current game ID from session storage if needed
      const currentGameId = sessionStorage.getItem('current_game_id');
      if (currentGameId && currentGameId !== gameId) {
        console.warn('[TrendGuesserService.endGame] WARNING: gameId mismatch. Using current_game_id:', currentGameId);
        gameId = currentGameId;
      }
      
      // Fetch current game data from API
      let foundCategory: SearchCategory | null = null;
      try {
        const response = await fetch(`/api/games/${gameId}`);
        if (response.ok) {
          const gameData = await response.json();
          const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
          
          if (gameState) {
            foundCategory = gameState.category;
            
            // Update game status to finished on the server
            try {
              const updateResponse = await fetch(`/api/games/${gameId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  status: 'finished',
                  '__trendguesser.state': {
                    ...gameState,
                    finished: true
                  }
                }),
              });
              
              if (!updateResponse.ok) {
                console.warn('Failed to update game status on server');
              }
            } catch (updateErr) {
              console.error('[TrendGuesserService.endGame] Failed to update game status:', updateErr);
            }
          }
        } else {
          console.error('[TrendGuesserService.endGame] Failed to fetch game data:', await response.text());
        }
      } catch (err) {
        console.error('[TrendGuesserService.endGame] Error fetching game data:', err);
      }
      
      // Update high score if category was found
      if (foundCategory) {
        try {
          await this.updateHighScore(playerUid, foundCategory, finalScore);
          console.log('[TrendGuesserService.endGame] Successfully updated high score after game end');
        } catch (highScoreErr) {
          console.error('[TrendGuesserService.endGame] Failed to update high score:', highScoreErr);
        }
      } else {
        console.error('[TrendGuesserService.endGame] No category found, cannot update high score');
      }
    } catch (error) {
      console.error('[TrendGuesserService.endGame] Unexpected error ending game:', error);
      throw error;
    }
  }

  // Update high score
static async updateHighScore(
  playerUid: string, 
  category: SearchCategory, 
  score: number,
  playerName?: string  // Add optional playerName parameter
): Promise<void> {
  // Skip if no user ID or category
  if (!playerUid || !category) {
    console.warn("[TrendGuesserService.updateHighScore] Missing required parameters:", {
      playerUid, category, score
    });
    return;
  }
  
  // Skip if score is unreasonable (prevent data corruption)
  if (score < 0 || score > 10000) {
    console.warn("[TrendGuesserService.updateHighScore] Score value out of reasonable range:", score);
    return;
  }
  
  // Standardize category to prevent case issues
  if (typeof category === 'string') {
    category = category.toLowerCase() as SearchCategory;
  }
  
  // Try to get player name if not provided
  if (!playerName && typeof window !== "undefined") {
    // Try to get from localStorage first
    playerName = localStorage.getItem("tg_player_name") || undefined;
    
    // If not found, try to get from player data
    if (!playerName) {
      try {
        const playerDataKey = `tg_player_${playerUid}`;
        const playerDataStr = localStorage.getItem(playerDataKey);
        if (playerDataStr) {
          const playerData = JSON.parse(playerDataStr);
          if (playerData.name) {
            playerName = playerData.name;
          }
        }
      } catch (e) {
        console.error("[TrendGuesserService.updateHighScore] Error getting player name:", e);
      }
    }
  }
  
  console.log(`[TrendGuesserService.updateHighScore] Updating high score for ${playerUid} (${playerName || 'unnamed'}) in category ${category} with score ${score}`);
  
  // First, always update localStorage immediately for a responsive UI
  if (typeof window !== "undefined") {
    try {
      const highScoresKey = `tg_highscores_${playerUid}`;
      let existingScores = {};
      
      // Get existing high scores
      const storedScores = localStorage.getItem(highScoresKey);
      if (storedScores) {
        try {
          existingScores = JSON.parse(storedScores);
        } catch (e) {
          console.error("[TrendGuesserService.updateHighScore] Error parsing stored scores:", e);
        }
      }
      
      // Only update if new score is higher than current high score
      const currentHighScore = existingScores[category] || 0;
      
      if (score > currentHighScore) {
        console.log(`[TrendGuesserService.updateHighScore] New high score for ${category}: ${score} > ${currentHighScore}`);
        
        // Update with new high score
        const updatedScores = {
          ...existingScores,
          [category]: score
        };
        
        // Save to localStorage immediately
        localStorage.setItem(highScoresKey, JSON.stringify(updatedScores));
        
        // Trigger storage event for other components to react
        window.dispatchEvent(new Event('storage'));
        
        console.log("[TrendGuesserService.updateHighScore] Updated localStorage with new high score");
      } else {
        console.log(`[TrendGuesserService.updateHighScore] Not a new high score: ${score} <= ${currentHighScore}`);
      }
    } catch (e) {
      console.error("[TrendGuesserService.updateHighScore] Error updating localStorage:", e);
    }
  }
  
  // Update high score on the server
  let retries = 3;
  let success = false;
  
  while (retries > 0 && !success) {
    try {
      console.log(`[TrendGuesserService.updateHighScore] Attempt ${4-retries} to update high score on server`);
      
      const response = await fetch('/api/highscores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerUid,
          category,
          score,
          playerName  // Include player name in the API request
        }),
      });
      
      if (!response.ok) {
        console.warn(`[TrendGuesserService.updateHighScore] Failed to update high score on server: ${response.status}`);
        
        // If we got a 500 error, wait a bit and retry
        if (response.status === 500) {
          retries--;
          if (retries > 0) {
            console.log(`Retrying high score update (${retries} attempts left)...`);
            await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
            continue;
          }
        }
      } else {
        const data = await response.json();
        console.log('[TrendGuesserService.updateHighScore] Successfully updated high score on server, response:', data);
        success = true;
      }
      
      break; // Exit loop after success or non-500 errors
    } catch (err) {
      console.error('[TrendGuesserService.updateHighScore] Error updating high score on server:', err);
      retries--;
      
      if (retries > 0) {
        console.log(`Retrying high score update (${retries} attempts left)...`);
        await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
      }
    }
  }
  
  // Even if server update fails, local storage will have the high score
  if (!success) {
    console.warn('[TrendGuesserService.updateHighScore] Failed to update high score on server after multiple attempts.');
    console.log('[TrendGuesserService.updateHighScore] High score is still preserved in localStorage.');
  }
}

  // Fetch leaderboard for a category
  static async getLeaderboard(category: SearchCategory): Promise<TrendGuesserPlayer[]> {
    try {
      // Call the leaderboard API
      const response = await fetch(`/api/leaderboard?category=${encodeURIComponent(category)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.status}`);
      }
      
      const leaderboard: TrendGuesserPlayer[] = await response.json();
      return leaderboard;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      
      // Fallback to sample data
      console.log('Falling back to sample data due to error');
      return sampleLeaderboard
        .filter(player => player.highScores && player.highScores[category])
        .sort((a, b) => {
          const scoreA = a.highScores?.[category] || 0;
          const scoreB = b.highScores?.[category] || 0;
          return scoreB - scoreA;
        })
        .slice(0, 10);
    }
  }

  // Helper methods
  private static async fetchTermsByCategory(category: SearchCategory): Promise<SearchTerm[]> {
    try {
      // Add safety checks for the category parameter
      if (!category) {
        console.error('[TrendGuesserService.fetchTermsByCategory] Missing category parameter, defaulting to "technology"');
        category = 'technology' as SearchCategory;
      }
      
      console.log(`[TrendGuesserService.fetchTermsByCategory] Fetching terms for category: ${category}`);
      
      // Call the terms API
      const response = await fetch(`/api/terms?category=${encodeURIComponent(category)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch terms: ${response.status}`);
      }
      
      const terms: SearchTerm[] = await response.json();
      console.log(`[TrendGuesserService.fetchTermsByCategory] Found ${terms.length} terms for category ${category}`);
      
      return terms;
    } catch (error) {
      console.error('[TrendGuesserService.fetchTermsByCategory] Error fetching terms:', error);
      
      // Fallback to sample data
      console.log('[TrendGuesserService.fetchTermsByCategory] Using fallback terms');
      
      if (category === 'everything') {
        // Return all sample terms
        return sampleSearchTerms;
      } else if (category === 'latest') {
        // Return terms sorted randomly (simulating recent)
        return [...sampleSearchTerms].sort(() => Math.random() - 0.5);
      } else {
        // Filter by category
        const filteredTerms = sampleSearchTerms.filter(term => term.category === category);
        return filteredTerms.length > 0 ? filteredTerms : sampleSearchTerms;
      }
    }
  }
  
  private static async fetchCustomTermWithRelated(customTerm: string): Promise<SearchTerm[]> {
    try {
      // Call the custom term API
      const response = await fetch(`/api/terms/custom?term=${encodeURIComponent(customTerm)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch custom term: ${response.status}`);
      }
      
      const terms: SearchTerm[] = await response.json();
      return terms;
    } catch (error) {
      console.error('Error fetching custom term:', error);
      
      // First term will be the custom one - use fallback image
      const customImageUrl = `/api/image?term=${encodeURIComponent(customTerm)}`;
      
      const customSearchTerm: SearchTerm = {
        id: uuidv4(),
        term: customTerm,
        volume: Math.floor(Math.random() * 100) + 1, // Placeholder volume
        category: 'custom',
        imageUrl: customImageUrl,
        timestamp: new Date().toISOString()
      };
      
      // Get some random terms from the sample data
      const randomTerms = [...sampleSearchTerms]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
      
      return [customSearchTerm, ...randomTerms];
    }
  }
  
  private static shuffleTerms(terms: SearchTerm[]): SearchTerm[] {
    const shuffled = [...terms];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  private static generateGameId(): string {
    // Generate a 6-character alphanumeric code (uppercase)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusable characters
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}