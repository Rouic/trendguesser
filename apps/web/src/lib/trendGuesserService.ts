//src/lib/trendGuesserService.ts

import { v4 as uuidv4 } from 'uuid';
import { SearchCategory, SearchTerm, TrendGuesserGameState, TrendGuesserPlayer, GameData } from '@/types';
import { sampleSearchTerms, sampleLeaderboard } from './mockData';

export class TrendGuesserService {
  static isProcessingGuess: boolean = false;
  static termCache: { [category: string]: SearchTerm[] } = {};
  static lastTermIds: { [category: string]: string } = {};
  static hasMoreTerms: { [category: string]: boolean } = {};

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

  // Start a new game with selected category using batch loading
  static async startGame(gameId: string, category: SearchCategory, customTerm?: string): Promise<TrendGuesserGameState | null> {
    try {
      console.log(`TrendGuesserService.startGame: Starting game ${gameId} with category ${category}`);
      
      // Get terms for the selected category
      let terms: SearchTerm[] = [];
      
      if (category === 'custom' && customTerm) {
        // For custom games, fetch the custom term and related terms
        terms = await this.fetchCustomTermWithRelated(customTerm);
      } else {
        // For predefined categories, fetch terms using our batch loading system
        // Ensure we have at least 100 terms (or whatever's available)
        terms = await this.ensureTermsAvailable(category, 100);
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
      
      // Save the initial game state to localStorage for offline capability
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            `tg_local_state_${gameId}`,
            JSON.stringify({
              gameState,
              lastUpdate: new Date().toISOString(),
              pendingUpdates: false
            })
          );
          console.log(`Stored initial local game state for ${gameId}`);
        } catch (e) {
          console.error('Error storing initial game state in localStorage:', e);
        }
      }
      
      // Get current game ID from session storage
      const currentGameId = sessionStorage.getItem('current_game_id');
      if (currentGameId !== gameId) {
        console.warn('WARNING: current_game_id mismatch in trendGuesserService. Current:', currentGameId, 'Using:', gameId);
        // Update to ensure consistency
        sessionStorage.setItem('current_game_id', gameId);
      }
      
      // In the background, update the server with the initial state
      this.syncGameStateWithServer(gameId, gameState).catch(err => {
        console.warn('Background server sync failed for initial game state:', err);
      });
      
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
      
      // Even for fallback state, try to store in localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            `tg_local_state_${gameId}`,
            JSON.stringify({
              gameState: fallbackState,
              lastUpdate: new Date().toISOString(),
              pendingUpdates: false
            })
          );
        } catch (e) {
          console.error('Error storing fallback game state in localStorage:', e);
        }
      }
      
      return fallbackState;
    }
  }
  
  // Helper method to sync game state with server in the background
  private static async syncGameStateWithServer(gameId: string, gameState: TrendGuesserGameState): Promise<boolean> {
    try {
      // Update game state on the server
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: gameState.finished ? 'finished' : 'active',
          '__trendguesser.state': gameState
        }),
      });

      if (!response.ok) {
        console.warn(`Failed to sync game state on server. Status: ${response.status}`);
        return false;
      }
      
      console.log(`Successfully synced game state for ${gameId} with server`);
      return true;
    } catch (err) {
      console.error('Error syncing game state with server:', err);
      return false;
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
      // GET GAME STATE - PRIORITIZE LOCAL STORAGE for uninterrupted experience
      let gameState: TrendGuesserGameState;
      let player: TrendGuesserPlayer;
      let needsServerSync = false;
      
      // FIRST: Try to use client-provided state (highest priority for UX consistency)
      if (clientGameState) {
        console.log('[TrendGuesserService.makeGuess] Using client-provided game state for round:', 
          clientGameState.currentRound);
        gameState = clientGameState;
      } else {
        // SECOND: Try to retrieve from localStorage (for offline capability)
        try {
          if (typeof window !== "undefined") {
            const localStateKey = `tg_local_state_${gameId}`;
            const localStateJson = localStorage.getItem(localStateKey);
            
            if (localStateJson) {
              const localStateData = JSON.parse(localStateJson);
              if (localStateData.gameState) {
                console.log('[TrendGuesserService.makeGuess] Using localStorage game state');
                gameState = localStateData.gameState;
                
                // Mark for server sync if there are pending updates or it's been a while
                const lastUpdate = new Date(localStateData.lastUpdate || 0);
                const timeSinceUpdate = Date.now() - lastUpdate.getTime();
                if (localStateData.pendingUpdates || timeSinceUpdate > 30000) { // 30 seconds
                  needsServerSync = true;
                }
              }
            }
          }
        } catch (localStorageErr) {
          console.error('[TrendGuesserService.makeGuess] Error accessing localStorage:', localStorageErr);
        }
        
        // THIRD: If no local state, try to fetch from server
        if (!gameState) {
          try {
            console.log('[TrendGuesserService.makeGuess] No local state, fetching from server...');
            const response = await fetch(`/api/games/${gameId}`);
            if (!response.ok) {
              throw new Error('Failed to fetch game data');
            }
            const gameData = await response.json();
            gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
            
            // Since we got state from server, save it locally
            if (typeof window !== "undefined" && gameState) {
              try {
                localStorage.setItem(
                  `tg_local_state_${gameId}`,
                  JSON.stringify({
                    gameState,
                    lastUpdate: new Date().toISOString(),
                    pendingUpdates: false
                  })
                );
              } catch (e) {
                console.error('[TrendGuesserService.makeGuess] Error storing server state to localStorage:', e);
              }
            }
          } catch (serverErr) {
            console.warn('[TrendGuesserService.makeGuess] Could not fetch game data from server:', serverErr);
            throw new Error('No game state available from any source');
          }
        }
      }
      
      // At this point, we must have a valid gameState
      if (!gameState) {
        throw new Error('Unable to retrieve game state from any source');
      }
      
      // Get PLAYER data - also prioritize local storage
      try {
        if (typeof window !== "undefined") {
          // First try localStorage
          const playerDataKey = `tg_player_${playerUid}`;
          const storedPlayerData = localStorage.getItem(playerDataKey);
          
          if (storedPlayerData) {
            try {
              player = JSON.parse(storedPlayerData);
              console.log('[TrendGuesserService.makeGuess] Using player data from localStorage');
            } catch (e) {
              console.error('[TrendGuesserService.makeGuess] Error parsing player data from localStorage:', e);
            }
          }
        }
        
        // If no local player data, try server
        if (!player) {
          try {
            const response = await fetch(`/api/games/${gameId}`);
            if (response.ok) {
              const gameData = await response.json();
              player = gameData[playerUid] as TrendGuesserPlayer;
              console.log('[TrendGuesserService.makeGuess] Using player data from server');
            }
          } catch (serverPlayerErr) {
            console.warn('[TrendGuesserService.makeGuess] Could not fetch player data from server:', serverPlayerErr);
          }
        }
      } catch (playerErr) {
        console.warn('[TrendGuesserService.makeGuess] Error retrieving player data:', playerErr);
      }
      
      // Initialize player with defaults if missing or incomplete
      if (!player || typeof player !== 'object') {
        player = {
          uid: playerUid,
          name: 'Player',
          score: 0
        };
        console.log('[TrendGuesserService.makeGuess] Created default player data');
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
      
      // STORE ROUND STATE IN LOCAL STORAGE
      if (typeof window !== "undefined") {
        try {
          const localStateKey = `tg_local_state_${gameId}`;
          const localStateJson = localStorage.getItem(localStateKey);
          let localStateData = { gameState: gameState, lastUpdate: new Date().toISOString(), pendingUpdates: true };
          
          if (localStateJson) {
            try {
              const parsedData = JSON.parse(localStateJson);
              localStateData = {
                ...parsedData,
                pendingUpdates: true,
                lastUpdate: new Date().toISOString()
              };
            } catch (e) {
              console.error('[TrendGuesserService.makeGuess] Error parsing existing local state:', e);
            }
          }
          
          // Add round data
          const roundKey = `round_${gameState.currentRound}`;
          localStateData[roundKey] = {
            knownTerm: gameState.knownTerm,
            hiddenTerm: gameState.hiddenTerm,
            isHigherGuess: isHigher,
            result: isCorrect,
            timestamp: new Date().toISOString()
          };
          
          // Store updated local state
          localStorage.setItem(localStateKey, JSON.stringify(localStateData));
          console.log(`[TrendGuesserService.makeGuess] Stored round ${gameState.currentRound} data in localStorage`);
        } catch (storageErr) {
          console.error('[TrendGuesserService.makeGuess] Error storing round data in localStorage:', storageErr);
        }
      }
      
      // Process the guess result based on CORRECTNESS
      if (isCorrect) {
        console.log('[TrendGuesserService.makeGuess] Correct guess - preparing for next round');
        
        // Update player score
        const newScore = (player.score || 0) + 1;
        player.score = newScore;
        
        console.log('[TrendGuesserService.makeGuess] Updated player score to:', newScore);
        
        // Update localStorage with current score immediately
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
        
        // Check if we need to load more terms
        const remainingTerms = gameState.terms?.length || 0;
        if (remainingTerms < 10 && this.hasMoreTerms[gameState.category]) {
          // Low on terms, fetch more in the background
          this.loadMoreTermsInBackground(gameState.category, gameId).catch(err => {
            console.warn('Failed to load additional terms in background:', err);
          });
        }
        
        // Sync with server in background if needed
        if (needsServerSync) {
          this.syncGameStateWithServer(gameId, gameState).catch(err => {
            console.warn('Background server sync failed:', err);
          });
        }
        
        // Clear processing flag before returning
        TrendGuesserService.isProcessingGuess = false;
        
        // Return success for UI update
        return true;
      } else {
        // Wrong guess - game over
        console.log('[TrendGuesserService.makeGuess] Incorrect guess - game over');
        
        // Save the final score for high score tracking
        const finalScore = player.score || 0;
        
        // Mark the game as finished locally first
        try {
          if (typeof window !== "undefined") {
            // First mark the game as finished in local storage
            const localStateKey = `tg_local_state_${gameId}`;
            const localStateJson = localStorage.getItem(localStateKey);
            let localStateData = { 
              gameState: { ...gameState, finished: true }, 
              lastUpdate: new Date().toISOString(), 
              pendingUpdates: true,
              gameOver: true
            };
            
            if (localStateJson) {
              try {
                const parsedData = JSON.parse(localStateJson);
                localStateData = {
                  ...parsedData,
                  gameState: { ...(parsedData.gameState || gameState), finished: true },
                  pendingUpdates: true,
                  gameOver: true,
                  lastUpdate: new Date().toISOString()
                };
              } catch (e) {
                console.error('[TrendGuesserService.makeGuess] Error parsing existing local state:', e);
              }
            }
            
            // Store updated local state with game over flag
            localStorage.setItem(localStateKey, JSON.stringify(localStateData));
            console.log(`[TrendGuesserService.makeGuess] Marked game as finished in localStorage`);
          }
        } catch (storageErr) {
          console.error('[TrendGuesserService.makeGuess] Error marking game as finished in localStorage:', storageErr);
        }
        
        // Then update high score locally
        try {
          if (typeof window !== "undefined") {
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
            if (finalScore > currentHighScore) {
              existingScores[gameState.category] = finalScore;
              localStorage.setItem(highScoresKey, JSON.stringify(existingScores));
              console.log(`[TrendGuesserService.makeGuess] Updated local high score for ${gameState.category} to ${finalScore}`);
              
              // Also update the player's high scores
              if (player && player.highScores) {
                player.highScores[gameState.category] = finalScore;
              } else if (player) {
                player.highScores = { [gameState.category]: finalScore };
              }
              
              // Save updated player data
              const playerDataKey = `tg_player_${playerUid}`;
              localStorage.setItem(playerDataKey, JSON.stringify(player));
              
              // Also send a storage event to notify other components
              window.dispatchEvent(new Event('storage'));
            }
          }
        } catch (highScoreErr) {
          console.error('[TrendGuesserService.makeGuess] Error updating local high score:', highScoreErr);
        }
        
        // Update server state with finished flag in the background
        try {
          const gameOverState = {
            ...gameState,
            finished: true
          };
          
          // Sync with server in background - higher priority for game over
          this.syncGameStateWithServer(gameId, gameOverState).catch(err => {
            console.warn('[TrendGuesserService.makeGuess] Error syncing game over state with server:', err);
          });
          
          // Also update high score on server
          this.updateHighScore(playerUid, gameState.category, finalScore).catch(err => {
            console.warn('[TrendGuesserService.makeGuess] Error updating high score on server:', err);
          });
        } catch (serverSyncErr) {
          console.error('[TrendGuesserService.makeGuess] Error during game over server sync:', serverSyncErr);
        }
        
        // Clear processing flag before returning
        TrendGuesserService.isProcessingGuess = false;
        
        // Return failure for UI update
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

// Load more terms in the background when we're running low
private static async loadMoreTermsInBackground(category: SearchCategory, gameId: string): Promise<void> {
  try {
    console.log(`[TrendGuesserService.loadMoreTermsInBackground] Loading more terms for ${category}`);
    
    // Check if we have a lastTermId for pagination
    const lastTermId = this.lastTermIds[category];
    
    if (!lastTermId) {
      console.warn('[TrendGuesserService.loadMoreTermsInBackground] No lastTermId available for pagination');
      return;
    }
    
    // Load next batch of terms
    const { terms, hasMore } = await this.loadNextTermsBatch(category, lastTermId);
    
    if (!terms || terms.length === 0) {
      console.log('[TrendGuesserService.loadMoreTermsInBackground] No additional terms available');
      return;
    }
    
    console.log(`[TrendGuesserService.loadMoreTermsInBackground] Loaded ${terms.length} additional terms`);
    
    // Update the game state in localStorage with the new terms
    if (typeof window !== "undefined") {
      try {
        const localStateKey = `tg_local_state_${gameId}`;
        const localStateJson = localStorage.getItem(localStateKey);
        
        if (localStateJson) {
          const localStateData = JSON.parse(localStateJson);
          
          if (localStateData.gameState) {
            // Add new terms to the existing terms array
            const currentTerms = localStateData.gameState.terms || [];
            const updatedTerms = [...currentTerms, ...terms];
            
            // Update the game state
            localStateData.gameState.terms = updatedTerms;
            localStateData.termsRefreshed = new Date().toISOString();
            
            // Save back to localStorage
            localStorage.setItem(localStateKey, JSON.stringify(localStateData));
            console.log(`[TrendGuesserService.loadMoreTermsInBackground] Updated game state with ${terms.length} new terms. Total now: ${updatedTerms.length}`);
          }
        }
      } catch (e) {
        console.error('[TrendGuesserService.loadMoreTermsInBackground] Error updating localStorage with new terms:', e);
      }
    }
  } catch (error) {
    console.error('[TrendGuesserService.loadMoreTermsInBackground] Error loading more terms:', error);
  }
}
  
  // End the game and update high scores (now using local-first approach)
  static async endGame(gameId: string, playerUid: string, finalScore: number): Promise<void> {
    try {
      console.log(`[TrendGuesserService.endGame] Ending game ${gameId} for player ${playerUid} with score ${finalScore}`);
      
      // Get current game ID from session storage if needed
      const currentGameId = sessionStorage.getItem('current_game_id');
      if (currentGameId && currentGameId !== gameId) {
        console.warn('[TrendGuesserService.endGame] WARNING: gameId mismatch. Using current_game_id:', currentGameId);
        gameId = currentGameId;
      }
      
      // FIRST: Try to get game data from localStorage (priority for consistent UX)
      let gameState: TrendGuesserGameState | null = null;
      let category: SearchCategory | null = null;
      
      // Get from localStorage if available
      if (typeof window !== "undefined") {
        try {
          const localStateKey = `tg_local_state_${gameId}`;
          const localStateJson = localStorage.getItem(localStateKey);
          
          if (localStateJson) {
            const localStateData = JSON.parse(localStateJson);
            if (localStateData.gameState) {
              gameState = localStateData.gameState;
              category = gameState.category;
              
              // Mark as finished in localStorage
              gameState.finished = true;
              localStateData.gameState = gameState;
              localStateData.gameOver = true;
              localStateData.endedAt = new Date().toISOString();
              
              // Save back to localStorage
              localStorage.setItem(localStateKey, JSON.stringify(localStateData));
              console.log('[TrendGuesserService.endGame] Updated local game state as finished');
            }
          }
        } catch (localStorageErr) {
          console.error('[TrendGuesserService.endGame] Error accessing localStorage:', localStorageErr);
        }
      }
      
      // If not found in localStorage, try to fetch from API
      if (!gameState) {
        try {
          const response = await fetch(`/api/games/${gameId}`);
          if (response.ok) {
            const gameData = await response.json();
            gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
            
            if (gameState) {
              category = gameState.category;
              
              // Save to localStorage for consistency
              if (typeof window !== "undefined") {
                try {
                  const localStateKey = `tg_local_state_${gameId}`;
                  localStorage.setItem(
                    localStateKey,
                    JSON.stringify({
                      gameState: {
                        ...gameState,
                        finished: true
                      },
                      lastUpdate: new Date().toISOString(),
                      gameOver: true,
                      endedAt: new Date().toISOString()
                    })
                  );
                } catch (storageErr) {
                  console.error('[TrendGuesserService.endGame] Error storing server state to localStorage:', storageErr);
                }
              }
            }
          } else {
            console.error('[TrendGuesserService.endGame] Failed to fetch game data:', await response.text());
          }
        } catch (err) {
          console.error('[TrendGuesserService.endGame] Error fetching game data:', err);
        }
      }
      
      // Update server in the background (non-blocking)
      if (gameState) {
        this.syncGameStateWithServer(gameId, { ...gameState, finished: true }).catch(err => {
          console.warn('[TrendGuesserService.endGame] Background server sync failed:', err);
        });
      }
      
      // Update high score if category was found, priorities:
      // 1. First update local storage for immediate UI
      // 2. Then update server in background
      if (category) {
        // First update local high score
        if (typeof window !== "undefined") {
          try {
            // Update high scores in localStorage first for immediate UI
            const highScoresKey = `tg_highscores_${playerUid}`;
            let existingScores = {};
            const storedScores = localStorage.getItem(highScoresKey);
            
            if (storedScores) {
              try {
                existingScores = JSON.parse(storedScores);
              } catch (e) {
                console.error('[TrendGuesserService.endGame] Error parsing stored high scores:', e);
              }
            }
            
            // Only update if new score is higher
            const currentHighScore = existingScores[category] || 0;
            if (finalScore > currentHighScore) {
              existingScores[category] = finalScore;
              localStorage.setItem(highScoresKey, JSON.stringify(existingScores));
              console.log(`[TrendGuesserService.endGame] Updated local high score for ${category} to ${finalScore}`);
              
              // Trigger storage event for UI updates
              window.dispatchEvent(new Event('storage'));
            }
          } catch (localHighScoreErr) {
            console.error('[TrendGuesserService.endGame] Error updating local high score:', localHighScoreErr);
          }
        }
        
        // Then update server in background
        try {
          await this.updateHighScore(playerUid, category, finalScore);
          console.log('[TrendGuesserService.endGame] Successfully updated high score on server');
        } catch (highScoreErr) {
          console.error('[TrendGuesserService.endGame] Failed to update high score on server:', highScoreErr);
        }
      } else {
        console.error('[TrendGuesserService.endGame] No category found, cannot update high score');
      }
      
      // Clear local cache for this game (optional, to save space)
      if (typeof window !== "undefined") {
        try {
          // Optionally, clear the cache after some time to save space
          setTimeout(() => {
            try {
              // Don't delete right away, give some time for UI to access the data
              localStorage.removeItem(`tg_local_state_${gameId}`);
              console.log(`[TrendGuesserService.endGame] Cleaned up local state for game ${gameId}`);
            } catch (e) {
              // Non-critical error, just log
              console.warn('[TrendGuesserService.endGame] Failed to clean up local state:', e);
            }
          }, 60000); // Keep for 1 minute after game end
        } catch (cleanupErr) {
          // Non-critical error, just log
          console.warn('[TrendGuesserService.endGame] Failed to set cleanup timer:', cleanupErr);
        }
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
  private static async fetchTermsByCategory(
    category: SearchCategory,
    batchSize: number = 0,
    lastTermId?: string
  ): Promise<SearchTerm[]> {
    try {
      // Add safety checks for the category parameter
      if (!category) {
        console.error('[TrendGuesserService.fetchTermsByCategory] Missing category parameter, defaulting to "technology"');
        category = 'technology' as SearchCategory;
      }
      
      console.log(`[TrendGuesserService.fetchTermsByCategory] Fetching terms for category: ${category}, batchSize: ${batchSize}, lastTermId: ${lastTermId || 'none'}`);
      
      // Build the API URL with pagination parameters if needed
      let url = `/api/terms?category=${encodeURIComponent(category)}`;
      
      if (batchSize > 0) {
        url += `&batch=true&count=${batchSize}`;
        if (lastTermId) {
          url += `&lastId=${encodeURIComponent(lastTermId)}`;
        }
      }
      
      // Call the terms API
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch terms: ${response.status}`);
      }
      
      // Handle different response formats based on whether we're using batching
      if (batchSize > 0) {
        const data = await response.json();
        
        if (data.terms && Array.isArray(data.terms)) {
          console.log(`[TrendGuesserService.fetchTermsByCategory] Loaded batch of ${data.terms.length} terms for category ${category}, hasMore: ${data.hasMore}`);
          
          // Update cache state
          this.hasMoreTerms[category] = data.hasMore;
          if (data.lastId) {
            this.lastTermIds[category] = data.lastId;
          }
          
          return data.terms;
        } else {
          console.error('[TrendGuesserService.fetchTermsByCategory] Invalid batch response format');
          throw new Error('Invalid batch response format');
        }
      } else {
        // Original format for backward compatibility
        const terms: SearchTerm[] = await response.json();
        console.log(`[TrendGuesserService.fetchTermsByCategory] Found ${terms.length} terms for category ${category}`);
        return terms;
      }
    } catch (error) {
      console.error('[TrendGuesserService.fetchTermsByCategory] Error fetching terms:', error);
      
      // Fallback to sample data
      console.log('[TrendGuesserService.fetchTermsByCategory] Using fallback terms');
      
      // Simulate batch behavior with sample data
      let filteredTerms;
      
      if (category === 'everything') {
        // Return all sample terms
        filteredTerms = sampleSearchTerms;
      } else if (category === 'latest') {
        // Return terms sorted randomly (simulating recent)
        filteredTerms = [...sampleSearchTerms].sort(() => Math.random() - 0.5);
      } else {
        // Filter by category
        filteredTerms = sampleSearchTerms.filter(term => term.category === category);
        if (filteredTerms.length === 0) {
          filteredTerms = sampleSearchTerms;
        }
      }
      
      // Apply pagination if batchSize is specified
      if (batchSize > 0) {
        if (lastTermId) {
          // Find the index of the last term
          const lastIndex = filteredTerms.findIndex(term => term.id === lastTermId);
          if (lastIndex !== -1 && lastIndex + 1 < filteredTerms.length) {
            // Return the next batch
            return filteredTerms.slice(lastIndex + 1, lastIndex + 1 + batchSize);
          }
          return []; // No more terms
        } else {
          // Return the first batch
          return filteredTerms.slice(0, batchSize);
        }
      }
      
      // Return all filtered terms if no batching
      return filteredTerms;
    }
  }
  
  // Load initial batch of terms for a category
  static async loadInitialTermsBatch(category: SearchCategory, batchSize: number = 100): Promise<{
    terms: SearchTerm[],
    lastTermId: string | null,
    hasMore: boolean
  }> {
    try {
      // Check if we already have cached terms for this category
      if (this.termCache[category] && this.termCache[category].length > 0) {
        console.log(`[TrendGuesserService.loadInitialTermsBatch] Using ${this.termCache[category].length} cached terms for ${category}`);
        return {
          terms: this.termCache[category],
          lastTermId: this.lastTermIds[category] || null,
          hasMore: this.hasMoreTerms[category] || false
        };
      }
      
      // Fetch fresh batch from API
      const termsBatch = await this.fetchTermsByCategory(category, batchSize);
      
      if (!termsBatch || termsBatch.length === 0) {
        return {
          terms: [],
          lastTermId: null,
          hasMore: false
        };
      }
      
      // Cache this batch of terms
      this.termCache[category] = termsBatch;
      
      // Store the last ID for pagination
      const lastTermId = termsBatch.length > 0 ? termsBatch[termsBatch.length - 1].id : null;
      if (lastTermId) {
        this.lastTermIds[category] = lastTermId;
      }
      
      // Determine if there might be more terms
      const hasMore = termsBatch.length >= batchSize;
      this.hasMoreTerms[category] = hasMore;
      
      return {
        terms: termsBatch,
        lastTermId,
        hasMore
      };
    } catch (error) {
      console.error('[TrendGuesserService.loadInitialTermsBatch] Error:', error);
      return {
        terms: [],
        lastTermId: null,
        hasMore: false
      };
    }
  }
  
  // Load next batch of terms for a category
  static async loadNextTermsBatch(category: SearchCategory, lastTermId: string, batchSize: number = 100): Promise<{
    terms: SearchTerm[],
    lastTermId: string | null,
    hasMore: boolean
  }> {
    try {
      // Only fetch if we believe there are more terms
      if (!this.hasMoreTerms[category]) {
        console.log(`[TrendGuesserService.loadNextTermsBatch] No more terms available for ${category}`);
        return {
          terms: [],
          lastTermId: null,
          hasMore: false
        };
      }
      
      // Fetch next batch from API
      const nextBatch = await this.fetchTermsByCategory(category, batchSize, lastTermId);
      
      if (!nextBatch || nextBatch.length === 0) {
        // Mark that there are no more terms for this category
        this.hasMoreTerms[category] = false;
        return {
          terms: [],
          lastTermId: null,
          hasMore: false
        };
      }
      
      // Add new terms to the cache
      if (!this.termCache[category]) {
        this.termCache[category] = nextBatch;
      } else {
        this.termCache[category] = [...this.termCache[category], ...nextBatch];
      }
      
      // Update the last ID for pagination
      const newLastTermId = nextBatch.length > 0 ? nextBatch[nextBatch.length - 1].id : null;
      if (newLastTermId) {
        this.lastTermIds[category] = newLastTermId;
      }
      
      // Determine if there might be more terms
      const hasMore = nextBatch.length >= batchSize;
      this.hasMoreTerms[category] = hasMore;
      
      return {
        terms: nextBatch,
        lastTermId: newLastTermId,
        hasMore
      };
    } catch (error) {
      console.error('[TrendGuesserService.loadNextTermsBatch] Error:', error);
      return {
        terms: [],
        lastTermId: null,
        hasMore: false
      };
    }
  }
  
  // Get all cached terms for a category, fetching more if needed
  static async ensureTermsAvailable(category: SearchCategory, minRequiredTerms: number = 10): Promise<SearchTerm[]> {
    // Check if we have enough terms in the cache already
    if (this.termCache[category] && this.termCache[category].length >= minRequiredTerms) {
      return this.termCache[category];
    }
    
    // Not enough terms in cache, fetch initial batch if cache is empty
    if (!this.termCache[category] || this.termCache[category].length === 0) {
      const { terms } = await this.loadInitialTermsBatch(category, Math.max(100, minRequiredTerms));
      return terms;
    }
    
    // We have some terms but not enough, and we know there are more available
    if (this.hasMoreTerms[category] && this.lastTermIds[category]) {
      // Calculate how many more terms we need
      const neededTerms = minRequiredTerms - this.termCache[category].length;
      const batchSize = Math.max(100, neededTerms); // Always fetch at least 100 for efficiency
      
      const { terms } = await this.loadNextTermsBatch(category, this.lastTermIds[category], batchSize);
      
      // Return combined terms
      return this.termCache[category];
    }
    
    // Return whatever we have if we can't get more
    return this.termCache[category] || [];
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