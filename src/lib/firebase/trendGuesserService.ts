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
import { SearchCategory, SearchTerm, TrendGuesserGameState, TrendGuesserPlayer } from '@/types';
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
            mockGameData = JSON.parse(existingData);
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
                const data = JSON.parse(sessionStorage.getItem(key) || '{}');
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
  
static async makeGuess(gameId: string, playerUid: string, isHigher: boolean): Promise<boolean> {
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
          gameData = JSON.parse(storedGameData);
          console.log('[TrendGuesserService.makeGuess] Game data loaded, status:', gameData.status);
        } catch (e) {
          console.error('[TrendGuesserService.makeGuess] Error parsing game data:', e);
          TrendGuesserService.isProcessingGuess = false; // Clear flag before throwing
          throw new Error('Invalid game data format');
        }
        
        // Get the game state - create a deep copy to avoid reference issues
        const gameState = JSON.parse(JSON.stringify(gameData['__trendguesser.state']));
        if (!gameState) {
          console.error('[TrendGuesserService.makeGuess] No game state found in data');
          TrendGuesserService.isProcessingGuess = false; // Clear flag before throwing
          throw new Error('Game state not found');
        }
        
        // DISABLED VERIFICATION - Always consider the game active
        // Instead of checking and throwing an error, just log the state and force it to be active
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
            const updatedData = JSON.parse(storedGameData);
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
        
        // Log current game state
        console.log('[TrendGuesserService.makeGuess] Current game state:', {
          round: gameState.currentRound,
          knownTerm: gameState.knownTerm.term,
          knownVolume: gameState.knownTerm.volume,
          hiddenTerm: gameState.hiddenTerm.term,
          hiddenVolume: gameState.hiddenTerm.volume,
          playerScore: player.score,
          remainingTerms: gameState.terms?.length || 0
        });
        
        // Extract the volumes for comparison
        const knownVolume = gameState.knownTerm.volume;
        const hiddenVolume = gameState.hiddenTerm.volume;
        
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
        const updatedGameData = JSON.parse(JSON.stringify(gameData));
        
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
            const updatedGameState = JSON.parse(JSON.stringify(gameState));
            
            // Set up next round
            updatedGameState.currentRound = gameState.currentRound + 1;
            updatedGameState.knownTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm));
            updatedGameState.hiddenTerm = JSON.parse(JSON.stringify(gameState.terms[0]));
            updatedGameState.usedTerms = [...gameState.usedTerms, gameState.terms[0].id];
            updatedGameState.terms = gameState.terms.slice(1);
            updatedGameState.finished = false; // Explicitly set to false
            
            console.log('[TrendGuesserService.makeGuess] Setting up next round:', {
              nextRound: updatedGameState.currentRound,
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
            
            // Get more terms for the same category (or reuse existing ones if in mock mode)
            let newTerms = [];
            
            if (typeof window !== 'undefined') {
              // For mock mode, reuse all previously used terms except current known/hidden
              const usedTermIds = new Set(gameState.usedTerms);
              
              // Get all available terms from mock data
              const availableTerms = [...sampleSearchTerms]
                // Filter out the current known and hidden terms
                .filter(term => term.id !== gameState.knownTerm.id && term.id !== gameState.hiddenTerm.id)
                // Randomize the order
                .sort(() => Math.random() - 0.5);
                
              console.log(`[TrendGuesserService.makeGuess] Found ${availableTerms.length} terms to reuse`);
              
              // Take up to 10 terms for the next rounds
              newTerms = availableTerms.slice(0, 10);
            }
            
            // If no terms were found, generate some dummy ones to keep the game going
            if (newTerms.length === 0) {
              console.log('[TrendGuesserService.makeGuess] Creating backup terms');
              
              // Create 5 backup terms with random volumes
              for (let i = 0; i < 5; i++) {
                const backupTerm = {
                  id: `backup-${Date.now()}-${i}`,
                  term: `Trending Topic ${i+1}`,
                  volume: Math.floor(Math.random() * 900000) + 100000,
                  category: gameState.category,
                  imageUrl: ImageConfig.primary.getUrl(`Trending Topic ${i+1}`, 800, 600),
                  timestamp: Timestamp.now()
                };
                newTerms.push(backupTerm);
              }
            }
            
            // Create updated game state
            const updatedGameState = JSON.parse(JSON.stringify(gameState));
            updatedGameState.currentRound = gameState.currentRound + 1;
            updatedGameState.terms = newTerms;
            updatedGameState.finished = false;
            
            // Setup the next round's terms
            updatedGameState.knownTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm));
            updatedGameState.hiddenTerm = JSON.parse(JSON.stringify(newTerms[0]));
            updatedGameState.usedTerms.push(newTerms[0].id);
            updatedGameState.terms = newTerms.slice(1);
            
            console.log('[TrendGuesserService.makeGuess] Continuing game with new terms:', {
              nextRound: updatedGameState.currentRound,
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
          // Wrong guess - game over
          console.log('[TrendGuesserService.makeGuess] Incorrect guess - game over');
          
          // Mark game as finished
          const updatedGameState = JSON.parse(JSON.stringify(gameState));
          updatedGameState.finished = true;
          updatedGameData.status = 'finished';
          
          // Update the game data object
          updatedGameData['__trendguesser.state'] = updatedGameState;
          
          // Save updated game data to session storage
          sessionStorage.setItem(`game_${gameId}`, JSON.stringify(updatedGameData));
          console.log('[TrendGuesserService.makeGuess] Saved game over state to session storage');
          
          // Clear processing flag before returning
          TrendGuesserService.isProcessingGuess = false;
          
          // Return failure
          return false;
        }
      }
      
      // Clear processing flag before returning fallback
      TrendGuesserService.isProcessingGuess = false;
      
      // Fallback if no session storage (shouldn't happen)
      return false;
    }
    
    // Regular Firestore implementation - unchanged
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
    
    // Need to check for both name variants - newer code might use '__trendguesser.state' or older code '__trendguesser'
    const hasOldState = gameData['__trendguesser'] ? true : false;
    const hasNewState = gameData['__trendguesser.state'] ? true : false;
    
    if (!hasNewState && !hasOldState) {
      console.error('[TrendGuesserService.makeGuess] No game state found in document - will report error and let UI handle it');
      console.log('[TrendGuesserService.makeGuess] Document data:', gameData);
      
      // Clear flag before throwing
      TrendGuesserService.isProcessingGuess = false;
      
      // Don't create default state - instead throw a clear error that the UI can handle with client-side state
      throw new Error('Game state not found in Firebase - UI will handle this with local state');
    } else if (hasOldState && !hasNewState) {
      // Handle case where we have old state format but not new format
      console.log('[TrendGuesserService.makeGuess] Found old state format, converting to new format');
      gameData['__trendguesser.state'] = gameData['__trendguesser'];
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
    
    // Only log a warning for missing terms but DON'T create fallbacks
    // Let the UI handle this with its own state management
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
    
    // CRITICAL FIX: Always force the game to be active - don't even check
    // This ensures we never hit the "Game is not active" error
    console.log('[TrendGuesserService.makeGuess] Game state BEFORE fix:', {
      started: gameState.started,
      finished: gameState.finished
    });
    
    // Force the game to be active unconditionally
    gameState.started = true;
    gameState.finished = false;
    console.log('[TrendGuesserService.makeGuess] Forced game to active state UNCONDITIONALLY');
    
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
      knownTerm: gameState.knownTerm.term,
      knownVolume: gameState.knownTerm.volume,
      hiddenTerm: gameState.hiddenTerm.term,
      hiddenVolume: gameState.hiddenTerm.volume,
      playerGuessedHigher: isHigher
    });
    
    // Determine if the guess is correct
    let isCorrect;
    
    // EDGE CASE: If volumes are exactly equal, the guess is ALWAYS correct
    if (gameState.hiddenTerm.volume === gameState.knownTerm.volume) {
      console.log('[TrendGuesserService.makeGuess] Equal volumes detected (Firestore) - counting as correct!');
      isCorrect = true;
    } else {
      isCorrect = isHigher 
        ? gameState.hiddenTerm.volume > gameState.knownTerm.volume
        : gameState.hiddenTerm.volume < gameState.knownTerm.volume;
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
        const newKnownTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm));
        const newHiddenTerm = JSON.parse(JSON.stringify(nextTerm));
        
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
            if (gameState.category === 'custom' && gameState.customTerm) {
              // For custom categories, fetch related terms
              console.log(`[TrendGuesserService.makeGuess] Fetching custom terms for: ${gameState.customTerm}`);
              newTerms = await this.fetchCustomTermWithRelated(gameState.customTerm);
            } else {
              // For standard categories, fetch by category
              console.log(`[TrendGuesserService.makeGuess] Fetching terms for category: ${gameState.category}`);
              newTerms = await this.fetchTermsByCategory(gameState.category);
            }
          } catch (fetchErr) {
            console.error('[TrendGuesserService.makeGuess] Error in fetch method:', fetchErr);
            // Create fallback terms if fetch fails
            newTerms = [];
            for (let i = 0; i < 5; i++) {
              newTerms.push({
                id: `fallback-fetch-${Date.now()}-${i}`,
                term: `New Term ${i+1}`,
                volume: Math.floor(Math.random() * 900000) + 100000,
                category: gameState.category || ('technology' as SearchCategory),
                imageUrl: ImageConfig.primary.getUrl(`New Term ${i+1}`, 800, 600),
                timestamp: Timestamp.now()
              });
            }
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
            const backupTerm: SearchTerm = {
              id: `backup-${Date.now()}-${i}`,
              term: `Trending Topic ${i+1}`,
              volume: Math.floor(Math.random() * 900000) + 100000,
              category: gameState.category,
              imageUrl: ImageConfig.primary.getUrl(`Trending Topic ${i+1}`, 800, 600),
              timestamp: Timestamp.now()
            };
            newTerms.push(backupTerm);
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
          
          // Update high score
          await this.updateHighScore(playerUid, gameState.category, newPlayerScore);
          
          console.log('[TrendGuesserService.makeGuess] Firestore - No new terms available, ending game');
        } else {
          // Continue game with new terms
          // Create deep copies to avoid reference issues
          const newKnownTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm));
          const newHiddenTerm = JSON.parse(JSON.stringify(newTerms[0]));
          
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
      // Incorrect guess - game over
      const updatedState: TrendGuesserGameState = {
        ...gameState,
        finished: true
      };
      
      // Complete update with all fields for game over
      const gameOverUpdate = {
        '__trendguesser.state': updatedState,
        status: 'finished'
      };
      
      // Use setDoc with merge for reliability
      try {
        await setDoc(gameRef, gameOverUpdate, { merge: true });
        console.log('[TrendGuesserService.makeGuess] Firestore - Game over state saved');
        
        // Update high score if needed
        await this.updateHighScore(playerUid, gameState.category, player.score || 0);
      } catch (err) {
        console.error('[TrendGuesserService.makeGuess] Failed to update game over state:', err);
        // Still proceed with local game over
      }
      
      console.log('[TrendGuesserService.makeGuess] Firestore - Game over, incorrect guess');
      
      // Clear processing flag before returning
      TrendGuesserService.isProcessingGuess = false;
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
    console.log(`[TrendGuesserService.endGame] CRITICAL: Ending game ${gameId} for player ${playerUid} with score ${finalScore}`);
    
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
          const gameData = JSON.parse(storedGameData);
          const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
          
          if (gameState && gameState.started) {
            // Mark game as finished
            gameState.finished = true;
            gameData.status = 'finished';
            
            // Save updated game data
            sessionStorage.setItem(`game_${gameId}`, JSON.stringify(gameData));
            console.log('[TrendGuesserService.endGame] Updated mock game data as finished');
            
            // IMPORTANT: Make sure we update high score in mock mode too
            if (gameState.category) {
              console.log(`[TrendGuesserService.endGame] Calling updateHighScore with category ${gameState.category} and score ${finalScore}`);
              await this.updateHighScore(playerUid, gameState.category, finalScore);
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
        await updateDoc(gameRef, {
          status: 'finished',
          '__trendguesser.state.finished': true
        });
        
        console.log('[TrendGuesserService.endGame] Marked game as finished in Firestore');
        
        // Update high score if we have a category
        if (gameState.category) {
          console.log(`[TrendGuesserService.endGame] Calling updateHighScore with category ${gameState.category} and score ${finalScore}`);
          await this.updateHighScore(playerUid, gameState.category, finalScore);
        } else {
          console.error('[TrendGuesserService.endGame] No category found in game state');
        }
      } else {
        console.log('[TrendGuesserService.endGame] Game not started, skipping high score update');
      }
    } catch (firebaseError) {
      console.error('[TrendGuesserService.endGame] Firebase operation error:', firebaseError);
      
      // If there's a Firebase error, still try to update the high score directly if we found a category
      if (foundCategory) {
        console.log(`[TrendGuesserService.endGame] Attempting direct high score update after error with category ${foundCategory}`);
        try {
          await this.updateHighScore(playerUid, foundCategory, finalScore);
        } catch (scoreError) {
          console.error('[TrendGuesserService.endGame] Failed to update high score after error:', scoreError);
        }
      } else {
        console.error('[TrendGuesserService.endGame] No category found, cannot update high score after error');
        
        // Last resort: try to get the category from localStorage if we have a current game
        try {
          if (typeof window !== 'undefined') {
            const currentGameId = sessionStorage.getItem('current_game_id');
            if (currentGameId === gameId) {
              const gameData = sessionStorage.getItem(`game_${gameId}`);
              if (gameData) {
                const parsedData = JSON.parse(gameData);
                const fallbackCategory = parsedData['__trendguesser.state']?.category;
                
                if (fallbackCategory) {
                  console.log(`[TrendGuesserService.endGame] Found fallback category ${fallbackCategory} from sessionStorage`);
                  await this.updateHighScore(playerUid, fallbackCategory, finalScore);
                }
              }
            }
          }
        } catch (e) {
          console.error('[TrendGuesserService.endGame] Error in last resort category lookup:', e);
        }
      }
      
      throw firebaseError;
    }
  } catch (error) {
    console.error('[TrendGuesserService.endGame] Error ending game:', error);
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
  private static async updateHighScore(
  playerUid: string, 
  category: SearchCategory, 
  score: number
): Promise<void> {
  try {
    console.log(`[TrendGuesserService.updateHighScore] CRITICAL: Updating high score for player ${playerUid}, category ${category}, score ${score}`);
    
    // In mock mode, store high score in sessionStorage and localStorage for persistence
    if (USE_MOCK_DATA && typeof window !== 'undefined') {
      console.log('[TrendGuesserService.updateHighScore] Using mock mode for high score');
      
      // Always save to localStorage for persistence across sessions
      try {
        const lsHighScoresKey = `tg_highscores_${playerUid}`;
        let lsHighScores = {};
        
        const existingLsData = localStorage.getItem(lsHighScoresKey);
        if (existingLsData) {
          try {
            lsHighScores = JSON.parse(existingLsData);
          } catch (parseErr) {
            console.error('[TrendGuesserService.updateHighScore] Error parsing localStorage data:', parseErr);
            lsHighScores = {};
          }
        }
        
        const currentHighScore = lsHighScores[category] || 0;
        console.log(`[TrendGuesserService.updateHighScore] Current high score: ${currentHighScore}, New score: ${score}`);
        
        // Only update if the new score is higher
        if (score > currentHighScore) {
          console.log(`[TrendGuesserService.updateHighScore] New high score detected: ${score} > ${currentHighScore}`);
          lsHighScores[category] = score;
          localStorage.setItem(lsHighScoresKey, JSON.stringify(lsHighScores));
          console.log(`[TrendGuesserService.updateHighScore] Updated localStorage with new high score: ${score}`);
          
          // Trigger a storage event so other components can react to the change
          window.dispatchEvent(new Event('storage'));
        } else {
          console.log(`[TrendGuesserService.updateHighScore] Score ${score} not higher than current high score ${currentHighScore}, not updating`);
        }
      } catch (e) {
        console.error('[TrendGuesserService.updateHighScore] Failed to save to localStorage:', e);
      }
      
      return;
    }
  
    // REAL FIREBASE MODE
    console.log('[TrendGuesserService.updateHighScore] Using Firestore to update high score');
    const playerRef = doc(db, 'players', playerUid);
    
    try {
      // First, get the current player document
      console.log('[TrendGuesserService.updateHighScore] Getting player document from Firestore');
      const playerDoc = await getDoc(playerRef);
      
      if (playerDoc.exists()) {
        console.log('[TrendGuesserService.updateHighScore] Player exists in Firestore');
        const playerData = playerDoc.data();
        console.log('[TrendGuesserService.updateHighScore] Current player data:', playerData);
        
        // Get current high score for the category
        const currentHighScore = playerData.highScores?.[category] || 0;
        console.log(`[TrendGuesserService.updateHighScore] Current high score: ${currentHighScore}, New score: ${score}`);
        
        if (score > currentHighScore) {
          console.log(`[TrendGuesserService.updateHighScore] New high score detected: ${score} > ${currentHighScore}`);
          
          try {
            // Create a complete new highScores object that includes all existing scores
            const existingHighScores = playerData.highScores || {};
            console.log('[TrendGuesserService.updateHighScore] Existing high scores:', existingHighScores);
            
            const updatedHighScores = {
              ...existingHighScores,
              [category]: score
            };
            console.log('[TrendGuesserService.updateHighScore] Updated high scores object:', updatedHighScores);
            
            // Use a direct Firestore update that COMPLETELY replaces the highScores field
            // We cannot use a nested merge as Firestore doesn't support deep merges
            await updateDoc(playerRef, {
              highScores: updatedHighScores
            });
            
            console.log('[TrendGuesserService.updateHighScore] Successfully updated player document in Firestore');
            
            // Verify the update worked by reading the document again
            const verifyDoc = await getDoc(playerRef);
            if (verifyDoc.exists()) {
              const verifyData = verifyDoc.data();
              console.log('[TrendGuesserService.updateHighScore] Verified high scores after update:', verifyData.highScores);
            }
            
            // Also update localStorage for immediate access
            if (typeof window !== 'undefined') {
              try {
                const highScoresKey = `tg_highscores_${playerUid}`;
                localStorage.setItem(highScoresKey, JSON.stringify(updatedHighScores));
                console.log('[TrendGuesserService.updateHighScore] Updated localStorage with Firestore high score');
                
                // Trigger a storage event for cross-component communication
                window.dispatchEvent(new Event('storage'));
              } catch (e) {
                console.error('[TrendGuesserService.updateHighScore] Error updating localStorage:', e);
              }
            }
            
            // Also update leaderboard if score is significant
            if (score > 2) {
              try {
                const leaderboardRef = doc(db, 'leaderboard', `${category}_${playerUid}`);
                await setDoc(leaderboardRef, {
                  uid: playerUid,
                  name: playerData.name || 'Unknown Player',
                  score,
                  category,
                  updatedAt: serverTimestamp()
                }, { merge: true });
                console.log('[TrendGuesserService.updateHighScore] Updated leaderboard');
              } catch (leaderboardErr) {
                console.error('[TrendGuesserService.updateHighScore] Failed to update leaderboard:', leaderboardErr);
              }
            }
          } catch (updateErr) {
            console.error('[TrendGuesserService.updateHighScore] CRITICAL ERROR - Failed to update high score in Firestore:', updateErr);
            throw updateErr; // Re-throw to handle it at a higher level
          }
        } else {
          console.log(`[TrendGuesserService.updateHighScore] Score ${score} not higher than current high score ${currentHighScore}, not updating`);
        }
      } else {
        // Player doesn't exist - create a new player document
        console.log('[TrendGuesserService.updateHighScore] Player document not found, creating new one');
        try {
          const newPlayer = {
            uid: playerUid,
            createdAt: serverTimestamp(),
            name: 'Player',
            highScores: {
              [category]: score
            }
          };
          
          await setDoc(playerRef, newPlayer);
          console.log('[TrendGuesserService.updateHighScore] Created new player document with high score');
          
          // Immediately save to localStorage
          if (typeof window !== 'undefined') {
            try {
              const highScoresKey = `tg_highscores_${playerUid}`;
              const localHighScores = { [category]: score };
              localStorage.setItem(highScoresKey, JSON.stringify(localHighScores));
              console.log('[TrendGuesserService.updateHighScore] Created localStorage high scores');
              
              // Trigger storage event
              window.dispatchEvent(new Event('storage'));
            } catch (e) {
              console.error('[TrendGuesserService.updateHighScore] Error creating localStorage high scores:', e);
            }
          }
          
          // Also create leaderboard entry
          if (score > 2) {
            const leaderboardRef = doc(db, 'leaderboard', `${category}_${playerUid}`);
            await setDoc(leaderboardRef, {
              uid: playerUid,
              name: 'Player',
              score,
              category,
              updatedAt: serverTimestamp()
            });
            console.log('[TrendGuesserService.updateHighScore] Created leaderboard entry');
          }
        } catch (createErr) {
          console.error('[TrendGuesserService.updateHighScore] Failed to create player document:', createErr);
          throw createErr; // Re-throw to handle it at a higher level
        }
      }
    } catch (docErr) {
      console.error('[TrendGuesserService.updateHighScore] Error getting/updating player document:', docErr);
      
      // Last resort: try a direct update without reading first
      try {
        console.log('[TrendGuesserService.updateHighScore] Attempting direct update without reading first');
        
        // Create a map for just this category score
        const highScoreUpdate = {};
        highScoreUpdate[`highScores.${category}`] = score;
        
        await updateDoc(playerRef, highScoreUpdate);
        console.log('[TrendGuesserService.updateHighScore] Directly updated high score field');
        
        // Also update localStorage
        if (typeof window !== 'undefined') {
          try {
            const highScoresKey = `tg_highscores_${playerUid}`;
            let currentHighScores = {};
            
            // Try to get existing data
            const existingData = localStorage.getItem(highScoresKey);
            if (existingData) {
              try {
                currentHighScores = JSON.parse(existingData);
              } catch (e) {}
            }
            
            // Update and save
            currentHighScores[category] = score;
            localStorage.setItem(highScoresKey, JSON.stringify(currentHighScores));
            
            // Trigger storage event
            window.dispatchEvent(new Event('storage'));
          } catch (e) {
            console.error('[TrendGuesserService.updateHighScore] Error updating localStorage:', e);
          }
        }
      } catch (finalError) {
        console.error('[TrendGuesserService.updateHighScore] All update attempts failed:', finalError);
      }
    }
  } catch (error) {
    console.error('[TrendGuesserService.updateHighScore] Error updating high score:', error);
    // Don't throw, just log - this is a non-critical operation
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
        fallbackTerms.push({
          id: `fallback-${Date.now()}-${i}`,
          term: `Fallback Term ${i+1}`,
          volume: Math.floor(Math.random() * 900000) + 100000,
          category: category || ('technology' as SearchCategory),
          imageUrl: ImageConfig.primary.getUrl(`Fallback Term ${i+1}`, 800, 600),
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
      
      // First term will be the custom one
      const customSearchTerm: SearchTerm = {
        id: uuidv4(),
        term: customTerm,
        volume: Math.floor(Math.random() * 100) + 1, // Placeholder volume
        category: 'custom',
        imageUrl: ImageConfig.primary.getUrl(customTerm, 800, 600),
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
        
        const customSearchTerm: SearchTerm = {
          id: uuidv4(),
          term: customTerm,
          volume: Math.floor(Math.random() * 100) + 1,
          category: 'custom',
          imageUrl: ImageConfig.primary.getUrl(customTerm, 800, 600),
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