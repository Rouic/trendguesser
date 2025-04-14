// src/lib/firebase/trendGuesserService.ts
import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  arrayUnion, 
  Timestamp, 
  serverTimestamp,
  increment,
  limit,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { SearchCategory, SearchTerm, TrendGuesserGameState, TrendGuesserPlayer, GameData } from '@/types';
import { sampleSearchTerms, sampleLeaderboard } from './mockData';
import { ImageConfig } from '@/utils/imageUtils';

// Development mode flag
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// Add some debug logging to help diagnose:
console.log(`[TrendGuesserService] Environment: ${process.env.NODE_ENV}`);
console.log(`[TrendGuesserService] USE_MOCK_DATA: ${USE_MOCK_DATA}`);
console.log(`[TrendGuesserService] NEXT_PUBLIC_USE_MOCK_DATA: ${process.env.NEXT_PUBLIC_USE_MOCK_DATA}`);

export class TrendGuesserService {
  // Start a new game with selected category
  static isProcessingGuess: boolean = false;
  static async startGame(gameId: string, category: SearchCategory, customTerm?: string): Promise<TrendGuesserGameState | null> {
    try {
      console.log(`TrendGuesserService.startGame: Starting game ${gameId} with category ${category}`);
      
      // In mock mode, we don't need to check if the game exists
      if (!USE_MOCK_DATA) {
        const gameRef = doc(db, 'games', gameId.toUpperCase());
        const gameDoc = await getDoc(gameRef);
        
        if (!gameDoc.exists()) {
          throw new Error('Game does not exist');
        }
      } else {
        console.log('Using mock data for game start');
      }
      
      // Get terms for the selected category
      let terms: SearchTerm[] = [];
      
      if (category === 'custom' && customTerm) {
        // For custom games, fetch the custom term and related terms
        terms = await this.fetchCustomTermWithRelated(customTerm);
      } else {
        // For predefined categories, fetch terms from the database
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
      
      if (!USE_MOCK_DATA) {
        // Update the game document with new game state
        const gameRef = doc(db, 'games', gameId.toUpperCase());
        await updateDoc(gameRef, {
          status: 'active',
          '__trendguesser.state': gameState
        });
        
        console.log(`Updated Firestore with game state for game ${gameId}`);
      } else {
        // In mock mode, we just log what would have happened
        console.log('Mock: Game started with category:', category);
        
        // Store the game state in sessionStorage for mock mode
        if (typeof window !== 'undefined') {
          // Get the user ID from session storage
          const mockUserUid = sessionStorage.getItem('mock_user_uid') || 'mock_user';
          console.log('Using mock user ID for game data:', mockUserUid);
          
          // Double-check that this game ID matches the current_game_id
          const currentGameId = sessionStorage.getItem('current_game_id');
          if (currentGameId !== gameId) {
            console.warn('WARNING: current_game_id mismatch in trendGuesserService. Current:', currentGameId, 'Using:', gameId);
            // Update to ensure consistency
            sessionStorage.setItem('current_game_id', gameId);
          }
          
          // Get existing data if available
          const existingData = sessionStorage.getItem(`game_${gameId}`);
          let mockGameData;
          
          if (existingData) {
            // Update existing game data
            mockGameData = TrendGuesserService.safeJSONParse(existingData, {});
            
            
            mockGameData.status = 'active';
            mockGameData['__trendguesser.state'] = gameState;
          } else {
            // Create new game data
            mockGameData = {
              id: gameId,
              status: 'active',
              createdBy: mockUserUid,
              gameType: 'trendguesser',
              '__trendguesser.state': gameState,
              [mockUserUid]: {
                uid: mockUserUid,
                name: 'Mock Player',
                score: 0
              }
            };
          }
          
          // Save to session storage
          sessionStorage.setItem(`game_${gameId}`, JSON.stringify(mockGameData));
          console.log('Stored mock game data:', mockGameData);
          
          // IMPORTANT FIX: We need to store the current game ID in a special key
          // This ensures we can access it across page refreshes
          sessionStorage.setItem('current_game_id', gameId);
          console.log('Set current game ID in session storage:', gameId);
          
          // Deactivate any other active games to avoid conflicts
          const gameKeys = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith('game_') && key !== `game_${gameId}`) {
              try {
                const data = TrendGuesserService.safeJSONParse(sessionStorage.getItem(key) || '{}', {}) as GameData;
                if (data.status === 'active') {
                  data.status = 'inactive';
                  sessionStorage.setItem(key, JSON.stringify(data));
                  console.log('Deactivated other game to avoid conflicts:', key);
                }
              } catch (e) {
                // Ignore parsing errors
              }
              gameKeys.push(key);
            }
          }
        }
      }
      
      // Return the created game state for immediate use
      return gameState;
      
    } catch (error) {
      console.error('Error starting game:', error);
      
      if (USE_MOCK_DATA) {
        console.log('Falling back to basic mock game state due to error');
        // Create and return a basic mock game state
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
        
        // Store the fallback state in session storage
        if (typeof window !== 'undefined') {
          const mockUserUid = sessionStorage.getItem('mock_user_uid') || 'mock_user';
          const mockGameData = {
            id: gameId,
            status: 'active',
            createdBy: mockUserUid,
            gameType: 'trendguesser',
            '__trendguesser.state': fallbackState,
            [mockUserUid]: {
              uid: mockUserUid,
              name: 'Mock Player',
              score: 0
            }
          };
          
          sessionStorage.setItem(`game_${gameId}`, JSON.stringify(mockGameData));
          sessionStorage.setItem('current_game_id', gameId);
          console.log('Created fallback game state in session storage:', fallbackState);
        }
        
        return fallbackState;
      }
      
      throw error;
    }
  }

private static safeJSONParse<T>(value: string | null | undefined, defaultValue: T): T {
  if (!value) {
    return defaultValue;
  }
  
  try {
    return JSON.parse(value) as T;
  } catch (e) {
    console.warn('[TrendGuesserService] Error parsing JSON, using default value:', e);
    return defaultValue;
  }
}

private static async retryOperation(operation: () => Promise<any>, maxRetries = 3): Promise<any> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      lastError = error;
      
      // Exponential backoff with jitter
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
  
static async makeGuess(
  gameId: string, 
  playerUid: string, 
  isHigher: boolean, 
  clientGameState?: TrendGuesserGameState | null
): Promise<boolean> {
  try {
    // SIMPLE FIX: Add reentrancy check to prevent multiple simultaneous processing
    if (TrendGuesserService.isProcessingGuess) {
      console.log('[TrendGuesserService.makeGuess] Already processing a guess, skipping');
      return false;
    }
    
    // Set the flag to prevent reentrancy
    TrendGuesserService.isProcessingGuess = true;
    
    // Handle mock mode
    if (USE_MOCK_DATA) {
      console.log('[TrendGuesserService.makeGuess] Starting with:', { gameId, playerUid, isHigher });
      
      // Get game data from session storage
      if (typeof window !== 'undefined') {
        // Check if we need to use the current_game_id instead
        const currentGameId = sessionStorage.getItem('current_game_id');
        if (currentGameId && currentGameId !== gameId) {
          console.warn('[TrendGuesserService.makeGuess] WARNING: gameId mismatch. Using current_game_id:', currentGameId, 'instead of:', gameId);
          gameId = currentGameId;
        }
        
        const storedGameData = sessionStorage.getItem(`game_${gameId}`);
        if (!storedGameData) {
          console.error('[TrendGuesserService.makeGuess] No game data found for ID:', gameId);
          TrendGuesserService.isProcessingGuess = false; // Clear flag before throwing
          throw new Error('No active game found');
        }
        
        // Parse the game data and extract important parts
        let gameData;
        try {
          gameData = TrendGuesserService.safeJSONParse(storedGameData, {});
          console.log('[TrendGuesserService.makeGuess] Game data loaded, status:', gameData.status);
        } catch (e) {
          console.error('[TrendGuesserService.makeGuess] Error parsing game data:', e);
          TrendGuesserService.isProcessingGuess = false; // Clear flag before throwing
          throw new Error('Invalid game data format');
        }
        
        // Get the game state - create a deep copy to avoid reference issues
        const gameState = TrendGuesserService.safeJSONParse(JSON.stringify(gameData['__trendguesser.state']), {}) as TrendGuesserGameState;
        if (!gameState) {
          console.error('[TrendGuesserService.makeGuess] No game state found in data');
          TrendGuesserService.isProcessingGuess = false; // Clear flag before throwing
          throw new Error('Game state not found');
        }
        
        // Ensure the game is in active state - fix any inconsistencies
        if (!gameState.started || gameState.finished) {
          console.warn('[TrendGuesserService.makeGuess] Game state was inactive but continuing anyway:', 
            gameState.started ? 'started' : 'not started', 
            gameState.finished ? 'finished' : 'not finished'
          );
          // Force it to be active
          gameState.started = true;
          gameState.finished = false;
          console.log('[TrendGuesserService.makeGuess] Forced game to active state');
          
          // Also update the game data in sessionStorage to ensure consistency
          if (typeof window !== 'undefined') {
            const updatedData = TrendGuesserService.safeJSONParse(storedGameData, {}) as GameData;
            if (updatedData['__trendguesser.state']) {
              updatedData['__trendguesser.state'].started = true;
              updatedData['__trendguesser.state'].finished = false;
              updatedData.status = 'active';
              sessionStorage.setItem(`game_${gameId}`, JSON.stringify(updatedData));
              console.log('[TrendGuesserService.makeGuess] Updated session storage with forced active state');
            }
          }
        }
        
        // Get the player data
        const mockUserUid = sessionStorage.getItem('mock_user_uid') || playerUid || 'mock_user';
        let player = gameData[mockUserUid];
        if (!player) {
          console.log('[TrendGuesserService.makeGuess] Player data not found, creating new');
          player = {
            uid: mockUserUid,
            name: 'Player',
            score: 0
          };
          gameData[mockUserUid] = player;
        }
        
        // Ensure the game state has valid terms before proceeding
        if (!gameState.knownTerm) {
          console.warn('[TrendGuesserService.makeGuess] No knownTerm found, creating fallback');
          gameState.knownTerm = {
            id: `fallback-${Date.now()}-1`,
            term: "Fallback Known Term",
            volume: 1000,
            category: gameState.category || 'technology',
            imageUrl: "https://via.placeholder.com/800x600?text=Fallback+Term",
            timestamp: Timestamp.now()
          };
        }
        
        if (!gameState.hiddenTerm) {
          console.warn('[TrendGuesserService.makeGuess] No hiddenTerm found, creating fallback');
          gameState.hiddenTerm = {
            id: `fallback-${Date.now()}-2`,
            term: "Fallback Hidden Term",
            volume: 500,
            category: gameState.category || 'technology',
            imageUrl: "https://via.placeholder.com/800x600?text=Fallback+Term",
            timestamp: Timestamp.now()
          };
        }
        
        // Log current game state with safe property access
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
        
        // Extract the volumes for comparison - ensure they exist with fallbacks
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
        
        // Create a new game data object to avoid reference issues
        const updatedGameData = TrendGuesserService.safeJSONParse(JSON.stringify(gameData), {})
        
        // Process the guess result
        if (isCorrect) {
          console.log('[TrendGuesserService.makeGuess] Correct guess - preparing next round');
          
          // Update player score
          const newScore = (player.score || 0) + 1;
          player.score = newScore;
          updatedGameData[mockUserUid] = player;
          
          console.log('[TrendGuesserService.makeGuess] Updated player score to:', newScore);
          
          // Check if we have more terms
          if (gameState.terms && gameState.terms.length > 0) {
            // Create new game state with deep copies to avoid reference issues
            const updatedGameState = TrendGuesserService.safeJSONParse(JSON.stringify(gameState), {}) as TrendGuesserGameState;
            
            // Set up next round
            updatedGameState.currentRound = gameState.currentRound + 1;
            updatedGameState.knownTerm = TrendGuesserService.safeJSONParse(JSON.stringify(gameState.hiddenTerm), {}) as SearchTerm;
            updatedGameState.hiddenTerm = TrendGuesserService.safeJSONParse(JSON.stringify(gameState.terms[0]), {}) as SearchTerm;
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
            
            // Update the game data object with the new state
            updatedGameData['__trendguesser.state'] = updatedGameState;
            
            console.log('[TrendGuesserService.makeGuess] Updated game state for next round');
          } else {
            // No more terms available - fetch new terms instead of ending
            console.log('[TrendGuesserService.makeGuess] No more terms - fetching new batch');
            
            // Get more terms for the SAME category (critically important)
            let newTerms = [];
            
            if (typeof window !== 'undefined') {
              // CRITICAL FIX: Always log the current category to see if it changes
              console.log(`[TrendGuesserService.makeGuess] Fetching new terms for category: ${gameState.category}`);
              
              // For mock mode, reuse sample terms that match the current category
              const categoryTerms = sampleSearchTerms
                // CRITICAL FIX: Filter to only include terms from the SAME category
                .filter(term => term.category === gameState.category)
                // Filter out the current known and hidden terms
                .filter(term => term.id !== gameState.knownTerm.id && term.id !== gameState.hiddenTerm.id)
                // Random order
                .sort(() => Math.random() - 0.5);
              
              console.log(`[TrendGuesserService.makeGuess] Found ${categoryTerms.length} matching terms for category: ${gameState.category}`);
              
              // Take up to 10 terms for next rounds
              newTerms = categoryTerms.slice(0, 10);
            }
            
            // If we still don't have enough terms, create fallback terms IN THE SAME CATEGORY
            if (newTerms.length < 5) {
              console.log(`[TrendGuesserService.makeGuess] Creating fallback terms for category: ${gameState.category}`);
              
              // Generate category-appropriate term names
              const getCategoryTerm = (category: string, index: number) => {
                switch(category) {
                  case 'snacks':
                    return [`Cookies ${index}`, `Chips ${index}`, `Candies ${index}`, `Crackers ${index}`, `Popcorn ${index}`][index % 5];
                  case 'technology':
                    return [`Smartphone ${index}`, `Laptop ${index}`, `Tablet ${index}`, `Headphones ${index}`, `Smart Watch ${index}`][index % 5];
                  case 'sports':
                    return [`Soccer ${index}`, `Basketball ${index}`, `Tennis ${index}`, `Golf ${index}`, `Football ${index}`][index % 5];
                  case 'landmarks':
                    return [`Monument ${index}`, `Tower ${index}`, `Museum ${index}`, `Castle ${index}`, `Cathedral ${index}`][index % 5];
                  case 'fashion':
                    return [`Dress ${index}`, `Shoes ${index}`, `Bag ${index}`, `Jacket ${index}`, `Sunglasses ${index}`][index % 5];
                  default:
                    return `${gameState.category.charAt(0).toUpperCase() + gameState.category.slice(1)} Item ${index}`;
                }
              };
              
              // Create 5 backup terms with random volumes, but in the SAME category
              for (let i = 0; i < 5; i++) {
                const termName = getCategoryTerm(gameState.category, i+1);
                
                const backupTerm = {
                  id: `fallback-${Date.now()}-${i}`,
                  term: termName,
                  volume: Math.floor(Math.random() * 900000) + 100000,
                  category: gameState.category, // CRITICAL: Maintain the SAME category
                  imageUrl: ImageConfig.pexels.getUrl(`${gameState.category} ${termName}`, 800, 600),
                  timestamp: Timestamp.now()
                };
                newTerms.push(backupTerm);
              }
              
              console.log(`[TrendGuesserService.makeGuess] Added ${5} fallback terms, total terms: ${newTerms.length}`);
            }
            
            // Create updated game state
            const updatedGameState = TrendGuesserService.safeJSONParse(JSON.stringify(gameState), {}) as TrendGuesserGameState;
            updatedGameState.currentRound = gameState.currentRound + 1;
            
            // Current hidden term becomes the new known term
            updatedGameState.knownTerm = TrendGuesserService.safeJSONParse(JSON.stringify(gameState.hiddenTerm), {}) as SearchTerm;
            
            // First term from new terms becomes the hidden term
            updatedGameState.hiddenTerm = TrendGuesserService.safeJSONParse(JSON.stringify(newTerms[0]), {}) as SearchTerm;
            
            // CRITICAL FIX: Explicitly ensure category is maintained
            updatedGameState.category = gameState.category;
            
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
            
            // Update the game data object
            updatedGameData['__trendguesser.state'] = updatedGameState;
          }
          
          // Save updated game data to session storage
          sessionStorage.setItem(`game_${gameId}`, JSON.stringify(updatedGameData));
          console.log('[TrendGuesserService.makeGuess] Saved updated game data to session storage');
          
          // Clear processing flag before returning
          TrendGuesserService.isProcessingGuess = false;
          
          // Return success
          return true;
        } else {
          // Wrong guess - game over, but don't update the UI state immediately
          // Just mark the game as finished in the stored data
          console.log('[TrendGuesserService.makeGuess] Incorrect guess - returning false');
          
          // FIX: Don't mark the game as finished yet - let the UI handle that transition
          // This prevents the premature "Game Over" flash and allows the UI to control the
          // timing of revealing the hidden term's volume.
          
          // Save the final score for high score tracking
          const finalScore = player.score || 0;
          
          // Update high score if needed
          try {
            await this.updateHighScore(
              mockUserUid, 
              gameState.category, 
              finalScore
            );
            console.log('[TrendGuesserService.makeGuess] Updated high score for game over');
          } catch (highScoreErr) {
            console.error('[TrendGuesserService.makeGuess] Failed to update high score, but game is still over:', highScoreErr);
          }
          
          // Clear processing flag before returning
          TrendGuesserService.isProcessingGuess = false;
          
          // Return failure - let the UI handle the game over transition
          return false;
        }
      }
      
      // Clear processing flag before returning fallback
      TrendGuesserService.isProcessingGuess = false;
      
      // Fallback if no session storage (shouldn't happen)
      return false;
    }
    
    // Regular Firestore implementation
    console.log('[TrendGuesserService.makeGuess] Using Firestore for:', { gameId, playerUid, isHigher });
    
    const gameRef = doc(db, 'games', gameId.toUpperCase());
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      TrendGuesserService.isProcessingGuess = false; // Clear flag before throwing
      throw new Error('Game does not exist');
    }
    
    let gameData = gameDoc.data();
    
    // More detailed error checking with useful console logs
    if (!gameData) {
      console.error('[TrendGuesserService.makeGuess] No game data found in document');
      console.log('[TrendGuesserService.makeGuess] Creating fallback game data');
      // Instead of throwing an error, create fallback game data
      gameData = {
        id: gameId,
        status: 'active',
        gameType: 'trendguesser',
        createdBy: playerUid,
        createdAt: Timestamp.now()
      };
      
      // Update Firestore with the basic game data structure to prevent future errors
      try {
        await setDoc(gameRef, gameData);
        console.log('[TrendGuesserService.makeGuess] Created basic game data in Firestore');
      } catch (err) {
        console.error('[TrendGuesserService.makeGuess] Failed to create basic game data:', err);
      }
    }
    
    // Need to check for all possible name variants - many different formats have been used
    const hasOldState = gameData['__trendguesser'] ? true : false;
    const hasNewState = gameData['__trendguesser.state'] ? true : false;
    const hasTrendGuesserState = gameData['trendguesser.state'] ? true : false;
    const hasTrendGuesser = gameData['trendguesser'] ? true : false;
    
    if (!hasNewState && !hasOldState && !hasTrendGuesserState && !hasTrendGuesser) {
      console.error('[TrendGuesserService.makeGuess] No game state found in document - will report error and let UI handle it');
      console.log('[TrendGuesserService.makeGuess] Document data:', gameData);
      
      // Instead of throwing, let's create a minimal game state to work with
      // This prevents the error from bubbling up in production
      console.log('[TrendGuesserService.makeGuess] Creating minimal game state for recovery');
      const recoveryState = {
        started: true,
        finished: false,
        category: 'technology' as SearchCategory,
        knownTerm: { term: 'Recovery Term', volume: 100 },
        hiddenTerm: { term: 'Recovery Term 2', volume: 200 },
        usedTerms: [],
        terms: [],
        currentRound: 1
      };
      
      gameData['__trendguesser.state'] = recoveryState;
      
      // Try to update the Firebase document with this recovery state
      try {
        await updateDoc(gameRef, {
          '__trendguesser.state': recoveryState,
          status: 'active'
        });
        console.log('[TrendGuesserService.makeGuess] Updated Firestore with recovery state');
      } catch (updateErr) {
        console.error('[TrendGuesserService.makeGuess] Failed to update with recovery state:', updateErr);
      }
    } else {
      // Handle case where we have old state format but not new format
      if (hasOldState && !hasNewState) {
        console.log('[TrendGuesserService.makeGuess] Found old state format, converting to new format');
        gameData['__trendguesser.state'] = gameData['__trendguesser'];
      } else if (hasTrendGuesserState && !hasNewState) {
        console.log('[TrendGuesserService.makeGuess] Found trendguesser.state format, converting to new format');
        gameData['__trendguesser.state'] = gameData['trendguesser.state'];
      } else if (hasTrendGuesser && !hasNewState) {
        console.log('[TrendGuesserService.makeGuess] Found trendguesser format, converting to new format');
        gameData['__trendguesser.state'] = gameData['trendguesser'];
      }
    }
    
    const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
    
    // Check if we have the minimal required properties and make sure they're non-null
    if (!gameState.category) {
      console.warn('[TrendGuesserService.makeGuess] Missing category, defaulting to technology');
      gameState.category = 'technology' as SearchCategory;
    }
    
    // Make sure arrays are initialized but DON'T create fallback terms
    // We want to preserve the original terms as much as possible
    if (!Array.isArray(gameState.usedTerms)) {
      console.warn('[TrendGuesserService.makeGuess] usedTerms is not an array, initializing empty array');
      gameState.usedTerms = [];
    }
    
    if (!Array.isArray(gameState.terms)) {
      console.warn('[TrendGuesserService.makeGuess] terms is not an array, initializing empty array');
      gameState.terms = [];
    }
    
    // Log warnings for missing terms but don't create fallbacks yet
    if (!gameState.knownTerm || !gameState.hiddenTerm) {
      console.warn('[TrendGuesserService.makeGuess] Missing terms in game state - UI will handle with local state');
    }
    
    // Always create a player if one doesn't exist
    let player = gameData[playerUid] as TrendGuesserPlayer;
    if (!player) {
      console.warn('[TrendGuesserService.makeGuess] No player data found, creating default player');
      player = {
        uid: playerUid,
        name: 'Player',
        score: 0
      };
      
      // Update Firestore with the player data to prevent future errors
      try {
        await setDoc(gameRef, {
          [playerUid]: player
        }, { merge: true });
        console.log('[TrendGuesserService.makeGuess] Updated Firestore with default player data');
      } catch (updateErr) {
        console.error('[TrendGuesserService.makeGuess] Failed to update Firestore with player data:', updateErr);
        // Continue anyway since we'll use the local player for this request
      }
    }
    
    // Store the initial player score for reference
    const initialPlayerScore = player.score || 0;
    
    // CRITICAL FIX: Always ensure the game is in active state
    console.log('[TrendGuesserService.makeGuess] Game state BEFORE fix:', {
      started: gameState.started,
      finished: gameState.finished
    });
    
    // Force the game to be active
    gameState.started = true;
    gameState.finished = false;
    console.log('[TrendGuesserService.makeGuess] Forced game to active state');
    
    // Update Firestore with the corrected state
    try {
      await updateDoc(gameRef, {
        '__trendguesser.state.started': true,
        '__trendguesser.state.finished': false,
        status: 'active'
      });
      console.log('[TrendGuesserService.makeGuess] Updated Firestore with forced active state');
    } catch (updateErr) {
      console.error('[TrendGuesserService.makeGuess] Failed to update Firestore with active state:', updateErr);
      // Continue anyway since we'll use the corrected state for this request
    }
    
    // Check if the guess is correct
    console.log('[TrendGuesserService.makeGuess] Firestore comparison:', {
      knownTerm: gameState.knownTerm?.term,
      knownVolume: gameState.knownTerm?.volume,
      hiddenTerm: gameState.hiddenTerm?.term,
      hiddenVolume: gameState.hiddenTerm?.volume,
      playerGuessedHigher: isHigher
    });
    
    // Determine if the guess is correct
    let isCorrect;
    
    // First check if we have a client-provided game state we can use
    if (clientGameState && 
        clientGameState.knownTerm && 
        clientGameState.hiddenTerm && 
        clientGameState.knownTerm.volume !== undefined && 
        clientGameState.hiddenTerm.volume !== undefined) {
      
      console.log('[TrendGuesserService.makeGuess] Using client-provided game state:', {
        knownTerm: clientGameState.knownTerm.term,
        knownVolume: clientGameState.knownTerm.volume,
        hiddenTerm: clientGameState.hiddenTerm.term,
        hiddenVolume: clientGameState.hiddenTerm.volume
      });
      
      // Use client data for comparison
      if (clientGameState.hiddenTerm.volume === clientGameState.knownTerm.volume) {
        console.log('[TrendGuesserService.makeGuess] Equal volumes detected in client data - counting as correct!');
        isCorrect = true;
      } else {
        const actuallyHigher = clientGameState.hiddenTerm.volume > clientGameState.knownTerm.volume;
        isCorrect = isHigher === actuallyHigher;
        
        console.log('[TrendGuesserService.makeGuess] Client state comparison:', {
          actuallyHigher,
          userGuessed: isHigher ? 'HIGHER' : 'LOWER',
          result: isCorrect ? 'CORRECT' : 'INCORRECT'
        });
      }
      
      // Update the server state with client data
      try {
        await updateDoc(gameRef, {
          "__trendguesser.state": clientGameState
        });
        console.log('[TrendGuesserService.makeGuess] Updated Firestore with client game state');
      } catch (updateErr) {
        console.error('[TrendGuesserService.makeGuess] Failed to update Firestore with client state:', updateErr);
      }
    }
    // Check if server state has complete term objects
    else if (!gameState.knownTerm || !gameState.hiddenTerm || 
        gameState.knownTerm.volume === undefined || gameState.hiddenTerm.volume === undefined) {
      console.log('[TrendGuesserService.makeGuess] Missing or incomplete term data in Firestore:', {
        knownTerm: gameState.knownTerm,
        hiddenTerm: gameState.hiddenTerm
      });

      // Use the gamestate from the UI (sent via param, if available)
      if (gameState.knownTerm?.term) {
        console.log('[TrendGuesserService.makeGuess] Using available partial term data for basic comparison');
        
        // EDGE CASE: If at least one volume is available, use that
        if (gameState.knownTerm?.volume !== undefined && gameState.hiddenTerm?.volume !== undefined) {
          // Check for equality first
          if (gameState.hiddenTerm.volume === gameState.knownTerm.volume) {
            console.log('[TrendGuesserService.makeGuess] Equal volumes detected - counting as correct!');
            isCorrect = true;
          } else {
            isCorrect = isHigher 
              ? gameState.hiddenTerm.volume > gameState.knownTerm.volume
              : gameState.hiddenTerm.volume < gameState.knownTerm.volume;
          }
        } else {
          // Try client state values as a fallback
          if (clientGameState && 
              clientGameState.knownTerm?.volume !== undefined && 
              clientGameState.hiddenTerm?.volume !== undefined) {
            
            console.log('[TrendGuesserService.makeGuess] Using client volumes for server terms');
            if (clientGameState.hiddenTerm.volume === clientGameState.knownTerm.volume) {
              isCorrect = true;
            } else {
              isCorrect = isHigher 
                ? clientGameState.hiddenTerm.volume > clientGameState.knownTerm.volume
                : clientGameState.hiddenTerm.volume < clientGameState.knownTerm.volume;
            }
          } else {
            // Last resort - coin flip
            console.log('[TrendGuesserService.makeGuess] No volumes available, falling back to 50/50 guess');
            isCorrect = Math.random() > 0.5;
          }
        }
      } else if (clientGameState && clientGameState.knownTerm && clientGameState.hiddenTerm) {
        // If server has no term data but client does, use client data
        console.log('[TrendGuesserService.makeGuess] Using client-side term data completely');
        
        if (clientGameState.hiddenTerm.volume === clientGameState.knownTerm.volume) {
          isCorrect = true;
        } else {
          isCorrect = isHigher 
            ? clientGameState.hiddenTerm.volume > clientGameState.knownTerm.volume 
            : clientGameState.hiddenTerm.volume < clientGameState.knownTerm.volume;
        }
      } else {
        // Complete fallback - just return success for user experience
        console.log('[TrendGuesserService.makeGuess] No term data available at all, defaulting to correct for UX');
        isCorrect = true;
      }
    } else {
      // Normal case - we have both terms with volumes
      // EDGE CASE: If volumes are exactly equal, the guess is ALWAYS correct
      if (gameState.hiddenTerm.volume === gameState.knownTerm.volume) {
        console.log('[TrendGuesserService.makeGuess] Equal volumes detected (Firestore) - counting as correct!');
        isCorrect = true;
      } else {
        isCorrect = isHigher 
          ? gameState.hiddenTerm.volume > gameState.knownTerm.volume
          : gameState.hiddenTerm.volume < gameState.knownTerm.volume;
      }
    }
    
    console.log(`[TrendGuesserService.makeGuess] Firestore guess result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    
    if (isCorrect) {
      // Correct guess - prepare next round
      const nextRound = gameState.currentRound + 1;
      const newPlayerScore = (player.score || 0) + 1;
      
      console.log(`[TrendGuesserService.makeGuess] Updating player score from ${initialPlayerScore} to ${newPlayerScore}`);
      
      // Build a complete batch update to ensure consistency
      let updatedFields: any = {};
      
      // Update player score
      updatedFields[`${playerUid}.score`] = newPlayerScore;
      
      // If we have more terms, set up next round
      if (gameState.terms && gameState.terms.length > 0) {
        const nextTerm = gameState.terms[0];
        const remainingTerms = gameState.terms.slice(1);
        
        // Create deep copies to avoid reference issues
        const newKnownTerm = TrendGuesserService.safeJSONParse(JSON.stringify(gameState.hiddenTerm), {}) as SearchTerm;
        const newHiddenTerm = TrendGuesserService.safeJSONParse(JSON.stringify(nextTerm), {}) as SearchTerm;
        
        // CRITICAL FIX: Create state with explicit properties, not using ...spread
        const updatedState: TrendGuesserGameState = {
          currentRound: nextRound,
          knownTerm: newKnownTerm,
          hiddenTerm: newHiddenTerm,
          // Explicitly set the category to ensure it's never undefined
          category: gameState.category || ('technology' as SearchCategory),
          started: true,
          finished: false,
          // Ensure arrays are always properly initialized
          usedTerms: Array.isArray(gameState.usedTerms) 
            ? [...gameState.usedTerms, nextTerm.id] 
            : [gameState.knownTerm.id, gameState.hiddenTerm.id, nextTerm.id],
          terms: Array.isArray(remainingTerms) ? remainingTerms : [],
          // Preserve custom term if it exists
          customTerm: gameState.customTerm || null
        };
        
        updatedFields['__trendguesser.state'] = updatedState;
        updatedFields['status'] = 'active';
        
        // CRITICAL: Use setDoc with merge to ensure we update the document properly
        try {
          await setDoc(gameRef, updatedFields, { merge: true });
          console.log('[TrendGuesserService.makeGuess] Firestore - Complete update with next round');
        } catch (err) {
          console.error('[TrendGuesserService.makeGuess] Failed to update Firestore with new round:', err);
          // Still return success since we handled the guess correctly
        }
      } else {
        // No more terms available - fetch new terms from database
        console.log('[TrendGuesserService.makeGuess] Firestore - No more terms, fetching new batch');
        
        // Get more terms for the same category using existing method
        let newTerms: SearchTerm[] = [];
        
        try {
          // Use the existing method to fetch terms by category
          try {
            // CRITICAL FIX: Always log current category for debugging
            console.log(`[TrendGuesserService.makeGuess] Current category: ${gameState.category}`);
            
            if (gameState.category === 'custom' && gameState.customTerm) {
              // For custom categories, fetch related terms
              console.log(`[TrendGuesserService.makeGuess] Fetching custom terms for: ${gameState.customTerm}`);
              newTerms = await this.fetchCustomTermWithRelated(gameState.customTerm);
            } else {
              // CRITICAL FIX: Always pass the current category, never default to 'technology'
              const currentCategory = gameState.category;
              console.log(`[TrendGuesserService.makeGuess] Fetching terms for category: ${currentCategory}`);
              newTerms = await this.fetchTermsByCategory(currentCategory);
            }
            
            // CRITICAL FIX: Filter fetched terms to ensure they match the category
            if (newTerms.length > 0) {
              const termsBeforeFilter = newTerms.length;
              newTerms = newTerms.filter(term => term.category === gameState.category);
              console.log(`[TrendGuesserService.makeGuess] Filtered terms by category: ${termsBeforeFilter} -> ${newTerms.length}`);
            }
          } catch (fetchErr) {
            console.error('[TrendGuesserService.makeGuess] Error in fetch method:', fetchErr);
            // Create fallback terms if fetch fails
            newTerms = [];
          }
          
          // CRITICAL FIX: Always create category-appropriate fallback terms if needed
          if (newTerms.length < 5) {
            console.log(`[TrendGuesserService.makeGuess] Creating fallback terms for category: ${gameState.category}`);
            
            // Generate category-specific names for more appropriate terms
            const getCategoryTerm = (category: string, index: number) => {
              switch(category) {
                case 'snacks':
                  return [`Cookies ${index}`, `Chips ${index}`, `Candies ${index}`, `Crackers ${index}`, `Popcorn ${index}`][index % 5];
                case 'technology':
                  return [`Smartphone ${index}`, `Laptop ${index}`, `Tablet ${index}`, `Headphones ${index}`, `Smart Watch ${index}`][index % 5];
                case 'sports':
                  return [`Soccer ${index}`, `Basketball ${index}`, `Tennis ${index}`, `Golf ${index}`, `Football ${index}`][index % 5];
                case 'landmarks':
                  return [`Monument ${index}`, `Tower ${index}`, `Museum ${index}`, `Castle ${index}`, `Cathedral ${index}`][index % 5];
                case 'fashion':
                  return [`Dress ${index}`, `Shoes ${index}`, `Bag ${index}`, `Jacket ${index}`, `Sunglasses ${index}`][index % 5];
                default:
                  return `${category.charAt(0).toUpperCase() + category.slice(1)} Item ${index}`;
              }
            };
            
            // Create enough fallback terms to reach at least 5 total
            const neededTerms = Math.max(0, 5 - newTerms.length);
            for (let i = 0; i < neededTerms; i++) {
              const termName = getCategoryTerm(gameState.category, i+1);
              
              try {
                const image = await ImageConfig.pexels.getUrl(`${gameState.category} ${termName}`, 800, 600);
                newTerms.push({
                  id: `fallback-fetch-${Date.now()}-${i}`,
                  term: termName,
                  volume: Math.floor(Math.random() * 900000) + 100000,
                  category: gameState.category, // CRITICAL FIX: Always use current category!
                  imageUrl: image,
                  timestamp: Timestamp.now()
                });
              } catch (imgErr) {
                // Even if image fails, still create the term with a placeholder
                newTerms.push({
                  id: `fallback-fetch-${Date.now()}-${i}`,
                  term: termName,
                  volume: Math.floor(Math.random() * 900000) + 100000,
                  category: gameState.category,
                  imageUrl: `https://picsum.photos/seed/${encodeURIComponent(termName)}/${800}/${600}`,
                  timestamp: Timestamp.now()
                });
              }
            }
            
            console.log(`[TrendGuesserService.makeGuess] Added ${neededTerms} fallback terms, total terms: ${newTerms.length}`);
          }
          
          // Safely filter out terms that have already been used
          if (gameState.usedTerms && Array.isArray(gameState.usedTerms)) {
            const usedTermIds = new Set(gameState.usedTerms);
            newTerms = newTerms.filter(term => !usedTermIds.has(term.id));
            console.log(`[TrendGuesserService.makeGuess] Filtered out ${gameState.usedTerms.length} already used terms`);
          } else {
            console.log('[TrendGuesserService.makeGuess] No usedTerms array found or it is not iterable');
            // Initialize usedTerms if missing
            gameState.usedTerms = gameState.usedTerms || [];
          }
          
          console.log(`[TrendGuesserService.makeGuess] Found ${newTerms.length} new terms`);
        } catch (error) {
          console.error('[TrendGuesserService.makeGuess] Error fetching new terms:', error);
          
          // If an error occurs, create some backup terms
          newTerms = [];
          for (let i = 0; i < 5; i++) {
            const termName = `${gameState.category.charAt(0).toUpperCase() + gameState.category.slice(1)} Item ${i+1}`;
            
            try {
              const image = await ImageConfig.pexels.getUrl(`${gameState.category} term ${i+1}`, 800, 600);
              const backupTerm: SearchTerm = {
                id: `backup-${Date.now()}-${i}`,
                term: termName,
                volume: Math.floor(Math.random() * 900000) + 100000,
                category: gameState.category, // CRITICAL FIX: Use current category!
                imageUrl: image,
                timestamp: Timestamp.now()
              };
              newTerms.push(backupTerm);
            } catch (imgErr) {
              // If image fetch fails, use fallback URL
              newTerms.push({
                id: `backup-${Date.now()}-${i}`,
                term: termName,
                volume: Math.floor(Math.random() * 900000) + 100000,
                category: gameState.category,
                imageUrl: `https://picsum.photos/seed/${gameState.category}-${i+1}/800/600`,
                timestamp: Timestamp.now()
              });
            }
          }
        }
        
        if (newTerms.length === 0) {
          // If we still have no terms, end the game
          const updatedState: TrendGuesserGameState = {
            ...gameState,
            finished: true,
            winner: playerUid
          };
          
          await updateDoc(gameRef, {
            '__trendguesser.state': updatedState,
            status: 'finished'
          });
          
          // Update high score separately with error handling
          try {
            await this.updateHighScore(playerUid, gameState.category, newPlayerScore);
            console.log('[TrendGuesserService.makeGuess] Successfully updated high score during end of terms');
          } catch (highScoreErr) {
            console.error('[TrendGuesserService.makeGuess] Failed to update high score during end of terms:', highScoreErr);
          }
          
          console.log('[TrendGuesserService.makeGuess] Firestore - No new terms available, ending game');
        } else {
          // Continue game with new terms
          // Create deep copies to avoid reference issues
          const newKnownTerm = TrendGuesserService.safeJSONParse(JSON.stringify(gameState.hiddenTerm), {}) as SearchTerm;
          const newHiddenTerm = TrendGuesserService.safeJSONParse(JSON.stringify(newTerms[0]), {}) as SearchTerm;
          
          // CRITICAL FIX: Create state with explicit properties, not using ...spread
          const updatedState: TrendGuesserGameState = {
            currentRound: nextRound,
            knownTerm: newKnownTerm,
            hiddenTerm: newHiddenTerm,
            // Explicitly set the category to ensure it's never undefined
            category: gameState.category || ('technology' as SearchCategory),
            started: true,
            finished: false,
            // Ensure arrays are always properly initialized
            usedTerms: Array.isArray(gameState.usedTerms) 
              ? [...gameState.usedTerms, newTerms[0].id] 
              : [gameState.knownTerm.id, gameState.hiddenTerm.id, newTerms[0].id],
            terms: Array.isArray(newTerms) && newTerms.length > 1 ? newTerms.slice(1) : [],
            // Preserve custom term if it exists
            customTerm: gameState.customTerm || null
          };
          
          // Build a complete update with all fields
          const completeUpdate = {
            '__trendguesser.state': updatedState,
            status: 'active',
            [`${playerUid}.score`]: newPlayerScore
          };
          
          // Use setDoc with merge for reliability
          try {
            await setDoc(gameRef, completeUpdate, { merge: true });
            console.log('[TrendGuesserService.makeGuess] Firestore - Complete update with new terms');
          } catch (err) {
            console.error('[TrendGuesserService.makeGuess] Failed to update with new terms:', err);
            // Continue anyway since the local state is still correct
          }
        }
      }
      
      // Clear processing flag before returning
      TrendGuesserService.isProcessingGuess = false;
      return true;
    } else {
      // Incorrect guess - don't immediately end the game
      // FIX: Return false and let the UI handle the game over transition
      // This prevents the "Game Over" flicker and premature search volume reveal
      
      // Update high score as needed
      try {
        await this.updateHighScore(playerUid, gameState.category, player.score || 0);
        console.log('[TrendGuesserService.makeGuess] Updated high score for incorrect guess');
      } catch (highScoreErr) {
        console.error('[TrendGuesserService.makeGuess] Failed to update high score:', highScoreErr);
      }
      
      // Clear processing flag before returning
      TrendGuesserService.isProcessingGuess = false;
      
      // Return false to indicate incorrect guess
      return false;
    }
    
  } catch (error) {
    // SIMPLE FIX: Always clear the flag on error
    TrendGuesserService.isProcessingGuess = false;
    console.error('[TrendGuesserService.makeGuess] Error:', error);
    throw error;
  }
}
  
  // End the game and update high scores
static async endGame(gameId: string, playerUid: string, finalScore: number): Promise<void> {
  try {
    console.log(`[TrendGuesserService.endGame] Ending game ${gameId} for player ${playerUid} with score ${finalScore}`);
    
    // Handle mock mode
    if (USE_MOCK_DATA && typeof window !== 'undefined') {
      console.log('[TrendGuesserService.endGame] Using mock data for ending game:', gameId);
      
      // Get current game ID from session storage if needed
      const currentGameId = sessionStorage.getItem('current_game_id');
      if (currentGameId && currentGameId !== gameId) {
        console.warn('[TrendGuesserService.endGame] WARNING: gameId mismatch. Using current_game_id:', currentGameId);
        gameId = currentGameId;
      }
      
      // Get game data from session storage
      const storedGameData = sessionStorage.getItem(`game_${gameId}`);
      if (storedGameData) {
        try {
          const gameData = TrendGuesserService.safeJSONParse(storedGameData, {}) as GameData;
          const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
          
          if (gameState && gameState.started) {
            // Mark game as finished - this is the primary operation
            gameState.finished = true;
            gameData.status = 'finished';
            
            // Save updated game data
            sessionStorage.setItem(`game_${gameId}`, JSON.stringify(gameData));
            console.log('[TrendGuesserService.endGame] Updated mock game data as finished');
            
            // IMPROVED: Update high score separately with error handling
            if (gameState.category) {
              try {
                // Call the improved updateHighScore method
                await this.updateHighScore(playerUid, gameState.category, finalScore);
                console.log('[TrendGuesserService.endGame] Successfully updated high score after mock game end');
              } catch (highScoreErr) {
                console.error('[TrendGuesserService.endGame] Failed to update high score, but mock game is still marked as finished:', highScoreErr);
                // Don't rethrow - we've successfully ended the game
              }
            } else {
              console.error('[TrendGuesserService.endGame] No category found in game state');
            }
          } else {
            console.log('[TrendGuesserService.endGame] Game not started, skipping high score update');
          }
        } catch (e) {
          console.error('[TrendGuesserService.endGame] Error processing game data:', e);
        }
      } else {
        console.error('[TrendGuesserService.endGame] No game data found for ID:', gameId);
      }
      
      return;
    }
  
    // REAL FIREBASE MODE
    console.log('[TrendGuesserService.endGame] Using Firestore for ending game');
    const gameRef = doc(db, 'games', gameId.toUpperCase());
    
    // Declare gameState variable at this scope to be accessible in catch block
    let foundCategory: SearchCategory | null = null;
    
    // End the game in Firestore - this is the primary operation
    let gameEndSuccessful = false;
    try {
      const gameDoc = await getDoc(gameRef);
      
      if (!gameDoc.exists()) {
        console.error('[TrendGuesserService.endGame] Game does not exist');
        throw new Error('Game does not exist');
      }
      
      const gameData = gameDoc.data();
      const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
      
      if (!gameState) {
        console.error('[TrendGuesserService.endGame] No game state found');
        throw new Error('No game state found');
      }
      
      // Store the category for use outside this try block
      foundCategory = gameState.category;
      
      // Log the game state for debugging
      console.log('[TrendGuesserService.endGame] Game state found:', {
        category: gameState.category,
        started: gameState.started,
        finished: gameState.finished,
        currentRound: gameState.currentRound
      });
      
      // Only update if game was actually started
      if (gameState.started) {
        // Mark game as finished
        try {
          await updateDoc(gameRef, {
            status: 'finished',
            '__trendguesser.state.finished': true
          });
          
          console.log('[TrendGuesserService.endGame] Marked game as finished in Firestore');
          gameEndSuccessful = true;
        } catch (updateErr) {
          console.error('[TrendGuesserService.endGame] Failed to mark game as finished:', updateErr);
          // Continue to high score update anyway
        }
      } else {
        console.log('[TrendGuesserService.endGame] Game not started, skipping game end update');
      }
    } catch (firebaseError) {
      console.error('[TrendGuesserService.endGame] Firebase operation error:', firebaseError);
      
      // Try to extract category from session storage if Firestore failed
      if (typeof window !== "undefined") {
        try {
          const currentGameId = sessionStorage.getItem('current_game_id');
          if (currentGameId === gameId) {
            const gameData = sessionStorage.getItem(`game_${gameId}`);
            if (gameData) {
              const parsedData = TrendGuesserService.safeJSONParse(gameData, {});
              foundCategory = parsedData['__trendguesser.state']?.category;
              
              if (foundCategory) {
                console.log(`[TrendGuesserService.endGame] Found category ${foundCategory} from sessionStorage`);
              }
            }
          }
        } catch (e) {
          console.error('[TrendGuesserService.endGame] Error extracting category from sessionStorage:', e);
        }
      }
    }
    
    // IMPROVED: Update high score as a separate operation with retry logic
    if (foundCategory) {
      try {
        // Call the improved updateHighScore method
        await this.updateHighScore(playerUid, foundCategory, finalScore);
        console.log('[TrendGuesserService.endGame] Successfully updated high score after game end');
      } catch (highScoreErr) {
        console.error('[TrendGuesserService.endGame] Failed to update high score, but game end was still attempted:', highScoreErr);
        // Don't rethrow - we've tried our best to end the game
      }
    } else {
      console.error('[TrendGuesserService.endGame] No category found, cannot update high score');
    }
    
    // Return without error even if some operations failed
    // At this point we've done our best to end the game and update high scores
  } catch (error) {
    console.error('[TrendGuesserService.endGame] Unexpected error ending game:', error);
    throw error;
  }
}
  
  // Create a new game session
  static async createGame(createdBy: string, playerName: string): Promise<string> {
    try {
      // Generate a short 6-character game ID (uppercase)
      const gameId = this.generateGameId();
      
      if (USE_MOCK_DATA) {
        console.log('Using mock data for game creation');
        
        // Create an empty initial game state in sessionStorage for immediate access
        if (typeof window !== 'undefined') {
          const mockUserUid = sessionStorage.getItem('mock_user_uid') || createdBy || 'mock_user';
          const initialGameData = {
            id: gameId,
            status: 'waiting',
            createdBy: mockUserUid,
            gameType: 'trendguesser',
            [mockUserUid]: {
              uid: mockUserUid,
              name: playerName || 'Player',
              score: 0
            }
          };
          sessionStorage.setItem(`game_${gameId}`, JSON.stringify(initialGameData));
          console.log('Created initial mock game data:', initialGameData);
          
          // Make sure current_game_id is set to this new game
          sessionStorage.setItem('current_game_id', gameId);
        }
        
        // Artificial delay to simulate network request
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(gameId);
          }, 300);
        });
      }
      
      const gameRef = doc(db, 'games', gameId);
      
      // Initialize player data
      const playerData: TrendGuesserPlayer = {
        uid: createdBy,
        name: playerName || 'Player',
        score: 0
      };
      
      // Initial game data
      const gameData = {
        id: gameId,
        createdAt: serverTimestamp(),
        createdBy,
        gameType: 'trendguesser',
        status: 'waiting',
        [createdBy]: playerData
      };
      
      await setDoc(gameRef, gameData);
      return gameId;
      
    } catch (error) {
      console.error('Error creating game:', error);
      
      if (USE_MOCK_DATA) {
        console.log('Falling back to mock data due to error');
        return this.generateGameId();
      }
      
      throw error;
    }
  }
  
  // Fetch leaderboard for a category
  static async getLeaderboard(category: SearchCategory): Promise<TrendGuesserPlayer[]> {
    try {
      if (USE_MOCK_DATA) {
        console.log('Using mock data for leaderboard');
        // Sort and filter the mock leaderboard based on the requested category
        return sampleLeaderboard
          .filter(player => player.highScores && player.highScores[category])
          .sort((a, b) => {
            const scoreA = a.highScores?.[category] || 0;
            const scoreB = b.highScores?.[category] || 0;
            return scoreB - scoreA;
          })
          .slice(0, 10);
      }
      
      const leaderboardRef = collection(db, 'leaderboard');
      const q = query(
        leaderboardRef,
        where('category', '==', category),
        orderBy('score', 'desc'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(q);
      const leaderboard: TrendGuesserPlayer[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        leaderboard.push({
          uid: data.uid,
          name: data.name,
          score: data.score,
          highScores: data.highScores
        });
      });
      
      return leaderboard;
      
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      
      if (USE_MOCK_DATA) {
        console.log('Falling back to mock data due to error');
        return sampleLeaderboard.slice(0, 10);
      }
      
      throw error;
    }
  }
  
  // Helper methods
// Make method public so it can be called directly by components
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
          existingScores = TrendGuesserService.safeJSONParse(storedScores, {});
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
  
  // Skip Firestore updates in mock mode
  if (USE_MOCK_DATA) {
    console.log("[TrendGuesserService.updateHighScore] In mock mode, skipping Firestore update");
    return;
  }
  
  try {
    // Now update Firestore with retry logic
    await this.retryOperation(async () => {
      // Get the player document
      const playerRef = doc(db, "players", playerUid);
      const playerDoc = await getDoc(playerRef);
      
      if (playerDoc.exists()) {
        const playerData = playerDoc.data();
        const currentHighScore = playerData.highScores?.[category] || 0;
        
        if (score > currentHighScore) {
          console.log(`[TrendGuesserService.updateHighScore] Updating Firestore high score: ${score} > ${currentHighScore}`);
          
          // Create new high scores object with all existing scores
          const existingHighScores = playerData.highScores || {};
          const updatedHighScores = {
            ...existingHighScores,
            [category]: score
          };
          
          // Use an atomic update for reliability
          await updateDoc(playerRef, {
            highScores: updatedHighScores,
            lastUpdated: serverTimestamp()
          });
          
          console.log("[TrendGuesserService.updateHighScore] Firestore high score update successful");
          
          // Also update leaderboard if score is significant
          if (score > 2) {
            try {
              const leaderboardRef = doc(db, 'leaderboard', `${category}_${playerUid}`);
              await setDoc(leaderboardRef, {
                uid: playerUid,
                name: playerData.name || 'Player',
                score,
                category,
                updatedAt: serverTimestamp()
              }, { merge: true });
              
              console.log("[TrendGuesserService.updateHighScore] Updated leaderboard");
            } catch (leaderboardErr) {
              console.error("[TrendGuesserService.updateHighScore] Failed to update leaderboard:", leaderboardErr);
              // Don't fail the main operation if leaderboard update fails
            }
          }
        } else {
          console.log(`[TrendGuesserService.updateHighScore] Not updating Firestore high score: ${score} <= ${currentHighScore}`);
        }
      } else {
        // Player doesn't exist - create a new player document
        console.log("[TrendGuesserService.updateHighScore] Creating new player document with high score");
        
        const newPlayer = {
          uid: playerUid,
          createdAt: serverTimestamp(),
          name: 'Player',
          highScores: {
            [category]: score
          }
        };
        
        await setDoc(playerRef, newPlayer);
        
        // Also create leaderboard entry if score is significant
        if (score > 2) {
          try {
            const leaderboardRef = doc(db, 'leaderboard', `${category}_${playerUid}`);
            await setDoc(leaderboardRef, {
              uid: playerUid,
              name: 'Player',
              score,
              category,
              updatedAt: serverTimestamp()
            });
          } catch (leaderboardErr) {
            console.error("[TrendGuesserService.updateHighScore] Failed to create leaderboard entry:", leaderboardErr);
          }
        }
      }
    });
  } catch (error) {
    // Final error - we've tried our best with retries
    console.error("[TrendGuesserService.updateHighScore] Failed to update high score after retries:", error);
    
    // Add to a pending updates queue for potential future retry
    if (typeof window !== "undefined") {
      try {
        const pendingUpdatesKey = `tg_pending_highscore_updates_${playerUid}`;
        let pendingUpdates = [];
        
        // Get existing pending updates
        const storedUpdates = localStorage.getItem(pendingUpdatesKey);
        if (storedUpdates) {
          try {
            pendingUpdates = TrendGuesserService.safeJSONParse(storedUpdates, {}) as any[];
          } catch (e) {
            console.error("[TrendGuesserService.updateHighScore] Error parsing pending updates:", e);
            pendingUpdates = [];
          }
        }
        
        // Add this update to the queue
        pendingUpdates.push({
          category,
          score,
          timestamp: Date.now()
        });
        
        // Store pending updates for later retry
        localStorage.setItem(pendingUpdatesKey, JSON.stringify(pendingUpdates));
        console.log("[TrendGuesserService.updateHighScore] Saved failed update to pending queue for later retry");
      } catch (e) {
        console.error("[TrendGuesserService.updateHighScore] Error saving to pending updates queue:", e);
      }
    }
  }
}
  
  private static async fetchTermsByCategory(category: SearchCategory): Promise<SearchTerm[]> {
    try {
      // Add safety checks for the category parameter
      if (!category) {
        console.error('[TrendGuesserService.fetchTermsByCategory] Missing category parameter, defaulting to "technology"');
        category = 'technology' as SearchCategory;
      }
      
      console.log(`[TrendGuesserService.fetchTermsByCategory] Fetching terms for category: ${category}`);
      
      if (USE_MOCK_DATA) {
        console.log('[TrendGuesserService.fetchTermsByCategory] Using mock data for search terms');
        
        if (category === 'everything') {
          // Return all sample terms
          return sampleSearchTerms;
        } else if (category === 'latest') {
          // Return terms sorted by timestamp
          return [...sampleSearchTerms].sort(() => Math.random() - 0.5);
        } else {
          // Filter by category
          const filteredTerms = sampleSearchTerms.filter(term => term.category === category);
          return filteredTerms.length > 0 ? filteredTerms : sampleSearchTerms;
        }
      }
      
      const termsRef = collection(db, 'searchTerms');
      let q;
      
      if (category === 'everything') {
        // For "everything" category, get a mix of all categories
        q = query(termsRef, limit(50));
      } else if (category === 'latest') {
        // For "latest", get the most recently added terms
        q = query(termsRef, orderBy('timestamp', 'desc'), limit(50));
      } else {
        // For specific categories, with safety check
        console.log(`[TrendGuesserService.fetchTermsByCategory] Creating Firestore query for category: ${category}`);
        q = query(termsRef, where('category', '==', category), limit(50));
      }
      
      const querySnapshot = await getDocs(q);
      const terms: SearchTerm[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SearchTerm;
        terms.push({
          ...data,
          id: doc.id
        });
      });
      
      console.log(`[TrendGuesserService.fetchTermsByCategory] Found ${terms.length} terms for category ${category}`);
      return terms;
      
    } catch (error) {
      console.error('[TrendGuesserService.fetchTermsByCategory] Error fetching terms:', error);
      
      // CRITICAL: Always return fallback terms on error to prevent game from breaking
      console.log('[TrendGuesserService.fetchTermsByCategory] Using fallback terms');
      
      // Create some fallback terms
      const fallbackTerms: SearchTerm[] = [];
      for (let i = 0; i < 10; i++) {
        const image = await ImageConfig.pexels.getUrl(`Fallback Term ${i+1}`, 800, 600);
        fallbackTerms.push({
          id: `fallback-${Date.now()}-${i}`,
          term: `Fallback Term ${i+1}`,
          volume: Math.floor(Math.random() * 900000) + 100000,
          category: category || ('technology' as SearchCategory),
          imageUrl: image, // Using sync fallback for immediate UI response
          timestamp: Timestamp.now()
        });
      }
      
      return fallbackTerms;
    }
  }
  
  private static async fetchCustomTermWithRelated(customTerm: string): Promise<SearchTerm[]> {
    try {
      // This would typically call a Firebase Function to get the custom term data
      // For now, we'll simulate it with a placeholder
      
      // First term will be the custom one - use async image loading
      let customImageUrl;
      try {
        // Try to get a better image from Pexels
        customImageUrl = await this.getImageUrlForTerm(customTerm);
      } catch (imgError) {
        console.error('Error getting custom term image, using fallback:', imgError);
        customImageUrl = ImageConfig.pexels.getUrl(customTerm, 800, 600);
      }
      
      const customSearchTerm: SearchTerm = {
        id: uuidv4(),
        term: customTerm,
        volume: Math.floor(Math.random() * 100) + 1, // Placeholder volume
        category: 'custom',
        imageUrl: customImageUrl,
        timestamp: Timestamp.now()
      };
      
      // For mock mode, just get some random terms from the sample data
      if (USE_MOCK_DATA) {
        const randomTerms = [...sampleSearchTerms]
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);
        
        return [customSearchTerm, ...randomTerms];
      }
      
      // Then get some related terms from the database (random for now)
      const termsRef = collection(db, 'searchTerms');
      const q = query(termsRef, limit(20));
      const querySnapshot = await getDocs(q);
      
      const terms: SearchTerm[] = [customSearchTerm];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as SearchTerm;
        terms.push({
          ...data,
          id: doc.id
        });
      });
      
      return terms;
      
    } catch (error) {
      console.error('Error fetching custom term:', error);
      
      // Fallback to mock data for custom term
      if (USE_MOCK_DATA) {
        console.log('Falling back to mock data for custom term');
        
        // Still try to get a better image if possible
        let fallbackImageUrl;
        try {
          fallbackImageUrl = await this.getImageUrlForTerm(customTerm);
        } catch (imgError) {
          console.error('Error getting fallback image, using deterministic fallback:', imgError);
          fallbackImageUrl = ImageConfig.pexels.getUrl(customTerm, 800, 600);
        }
        
        const customSearchTerm: SearchTerm = {
          id: uuidv4(),
          term: customTerm,
          volume: Math.floor(Math.random() * 100) + 1,
          category: 'custom',
          imageUrl: fallbackImageUrl,
          timestamp: Timestamp.now()
        };
        
        return [
          customSearchTerm,
          ...sampleSearchTerms.slice(0, 10)
        ];
      }
      
      throw error;
    }
  }
  
  // Helper method to get an image URL for a term
  private static async getImageUrlForTerm(term: string): Promise<string> {
    try {
      // First try to get an image from Pexels API
      return await ImageConfig.pexels.getUrl(term, 800, 600);
    } catch (error) {
      console.error(`Error getting Pexels image for term "${term}":`, error);
      // Fallback to deterministic picsum
      return ImageConfig.pexels.getUrl(term, 800, 600);
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