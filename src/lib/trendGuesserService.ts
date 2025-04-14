// src/lib/trendGuesserService.ts
import { v4 as uuidv4 } from 'uuid';
import { SearchCategory, SearchTerm, TrendGuesserGameState, TrendGuesserPlayer, GameData } from '@/types';
import { sampleSearchTerms, sampleLeaderboard } from './mockData';

// Update path to imageUtils if needed
import { ImageConfig } from '@/utils/imageUtils';

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
      
      console.log('[TrendGuesserService.makeGuess] Starting with:', { gameId, playerUid, isHigher });
      
      // Check if we need to use the current_game_id
      const currentGameId = sessionStorage.getItem('current_game_id');
      if (currentGameId && currentGameId !== gameId) {
        console.warn('[TrendGuesserService.makeGuess] WARNING: gameId mismatch. Using current_game_id:', currentGameId, 'instead of:', gameId);
        gameId = currentGameId;
      }
      
      try {
        // Fetch current game state from API
        let gameData: GameData;
        let gameState: TrendGuesserGameState;
        let player: TrendGuesserPlayer;
        
        try {
          const response = await fetch(`/api/games/${gameId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch game data');
          }
          gameData = await response.json();
          gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
          // Make sure player exists with proper defaults
          player = gameData[playerUid] as TrendGuesserPlayer;
          
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
        } catch (err) {
          console.warn('Could not fetch game data from server, using client state:', err);
          
          // Use the client-provided game state as fallback
          if (!clientGameState) {
            throw new Error('No game state available');
          }
          
          gameState = clientGameState;
          player = {
            uid: playerUid,
            name: 'Player',
            score: 0
          };
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
          
          // Check if we have more terms
          if (gameState.terms && gameState.terms.length > 0) {
            // Create new game state with deep copies to avoid reference issues
            const updatedGameState = JSON.parse(JSON.stringify(gameState)) as TrendGuesserGameState;
            
            // Set up next round
            updatedGameState.currentRound = gameState.currentRound + 1;
            updatedGameState.knownTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm)) as SearchTerm;
            updatedGameState.hiddenTerm = JSON.parse(JSON.stringify(gameState.terms[0])) as SearchTerm;
            updatedGameState.usedTerms = [...gameState.usedTerms, gameState.terms[0].id];
            updatedGameState.terms = gameState.terms.slice(1);
            updatedGameState.finished = false; // Explicitly set to false
            
            console.log('[TrendGuesserService.makeGuess] Setting up next round:', {
              nextRound: updatedGameState.currentRound,
              category: updatedGameState.category,
              newKnownTerm: updatedGameState.knownTerm.term,
              nextTerm: updatedGameState.hiddenTerm.term,
              remainingTerms: updatedGameState.terms.length
            });
            
            // Update the game on the server
            try {
              const updateResponse = await fetch(`/api/games/${gameId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  status: 'active',
                  '__trendguesser.state': updatedGameState,
                  [playerUid]: player
                }),
              });
              
              if (!updateResponse.ok) {
                console.warn('Failed to update game on server. Continuing with local state.');
              }
            } catch (err) {
              console.error('Error updating game on server:', err);
            }
          } else {
            // No more terms available - fetch new terms
            console.log('[TrendGuesserService.makeGuess] No more terms - fetching new batch');
            
            // Preserve the original category
            const originalCategory = gameState.category;
            console.log(`[TrendGuesserService.makeGuess] Current category: ${originalCategory}`);
            
            // Get more terms for the SAME category
            let newTerms = await this.fetchTermsByCategory(originalCategory);
            
            // Filter out the current known and hidden terms
            newTerms = newTerms.filter(term => 
              term.id !== gameState.knownTerm.id && 
              term.id !== gameState.hiddenTerm.id
            );
            
            // Create updated game state
            const updatedGameState = JSON.parse(JSON.stringify(gameState)) as TrendGuesserGameState;
            updatedGameState.currentRound = gameState.currentRound + 1;
            
            // Current hidden term becomes the new known term
            updatedGameState.knownTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm)) as SearchTerm;
            
            // First term from new terms becomes the hidden term
            updatedGameState.hiddenTerm = JSON.parse(JSON.stringify(newTerms[0])) as SearchTerm;
            
            // Explicitly ensure category is maintained
            updatedGameState.category = originalCategory;
            
            // Update remaining terms and tracking
            updatedGameState.usedTerms.push(newTerms[0].id);
            updatedGameState.terms = newTerms.slice(1);
            updatedGameState.finished = false; // Explicitly set to false
            
            console.log(`[TrendGuesserService.makeGuess] Continuing game with new terms:`, {
              nextRound: updatedGameState.currentRound,
              category: updatedGameState.category,
              newKnownTerm: updatedGameState.knownTerm.term,
              nextTerm: updatedGameState.hiddenTerm.term,
              remainingTerms: updatedGameState.terms.length
            });
            
            // Update the game on the server
            try {
              const updateResponse = await fetch(`/api/games/${gameId}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  status: 'active',
                  '__trendguesser.state': updatedGameState,
                  [playerUid]: player
                }),
              });
              
              if (!updateResponse.ok) {
                console.warn('Failed to update game on server. Continuing with local state.');
              }
            } catch (err) {
              console.error('Error updating game on server:', err);
            }
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
          
          // Update high score if needed
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
    score: number
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
    try {
      const response = await fetch('/api/highscores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerUid,
          category,
          score
        }),
      });
      
      if (!response.ok) {
        console.warn('[TrendGuesserService.updateHighScore] Failed to update high score on server');
      } else {
        console.log('[TrendGuesserService.updateHighScore] Successfully updated high score on server');
      }
    } catch (err) {
      console.error('[TrendGuesserService.updateHighScore] Error updating high score on server:', err);
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