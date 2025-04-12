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
        customTerm: category === 'custom' ? customTerm : undefined
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
          category: category || 'everything',
          started: true,
          finished: false,
          usedTerms: [sampleSearchTerms[0].id, sampleSearchTerms[1].id],
          terms: sampleSearchTerms.slice(2),
          customTerm: category === 'custom' ? customTerm : undefined
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
          throw new Error('No active game found');
        }
        
        // Parse the game data and extract important parts
        let gameData;
        try {
          gameData = JSON.parse(storedGameData);
          console.log('[TrendGuesserService.makeGuess] Game data loaded, status:', gameData.status);
        } catch (e) {
          console.error('[TrendGuesserService.makeGuess] Error parsing game data:', e);
          throw new Error('Invalid game data format');
        }
        
        // Get the game state - create a deep copy to avoid reference issues
        const gameState = JSON.parse(JSON.stringify(gameData['__trendguesser.state']));
        if (!gameState) {
          console.error('[TrendGuesserService.makeGuess] No game state found in data');
          throw new Error('Game state not found');
        }
        
        // Verify game is active
        if (!gameState.started || gameState.finished) {
          console.error('[TrendGuesserService.makeGuess] Game is not active:', 
            gameState.started ? 'started' : 'not started', 
            gameState.finished ? 'finished' : 'not finished'
          );
          throw new Error('Game is not active');
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
          
          // Return failure
          return false;
        }
      }
      
      // Fallback if no session storage (shouldn't happen)
      return false;
    }
    
    // Regular Firestore implementation - unchanged
    console.log('[TrendGuesserService.makeGuess] Using Firestore for:', { gameId, playerUid, isHigher });
    
    const gameRef = doc(db, 'games', gameId.toUpperCase());
    const gameDoc = await getDoc(gameRef);
    
    if (!gameDoc.exists()) {
      throw new Error('Game does not exist');
    }
    
    const gameData = gameDoc.data();
    const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
    const player = gameData[playerUid] as TrendGuesserPlayer;
    
    if (!gameState || !gameState.started || gameState.finished) {
      throw new Error('Game is not active');
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
      
      // Update player score
      await updateDoc(gameRef, {
        [`${playerUid}.score`]: newPlayerScore
      });
      
      // If we have more terms, set up next round
      if (gameState.terms.length > 0) {
        const nextTerm = gameState.terms[0];
        const remainingTerms = gameState.terms.slice(1);
        
        // Create deep copies to avoid reference issues
        const newKnownTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm));
        const newHiddenTerm = JSON.parse(JSON.stringify(nextTerm));
        
        const updatedState: TrendGuesserGameState = {
          ...gameState,
          currentRound: nextRound,
          knownTerm: newKnownTerm,
          hiddenTerm: newHiddenTerm,
          usedTerms: [...gameState.usedTerms, nextTerm.id],
          terms: remainingTerms,
          finished: false  // Explicitly set to false
        };
        
        await updateDoc(gameRef, {
          '__trendguesser.state': updatedState
        });
        
        console.log('[TrendGuesserService.makeGuess] Firestore - Updated state for next round');
      } else {
        // No more terms available - fetch new terms from database
        console.log('[TrendGuesserService.makeGuess] Firestore - No more terms, fetching new batch');
        
        // Get more terms for the same category using existing method
        let newTerms: SearchTerm[] = [];
        
        try {
          // Use the existing method to fetch terms by category
          if (gameState.category === 'custom' && gameState.customTerm) {
            // For custom categories, fetch related terms
            newTerms = await this.fetchCustomTermWithRelated(gameState.customTerm);
          } else {
            // For standard categories, fetch by category
            newTerms = await this.fetchTermsByCategory(gameState.category);
          }
          
          // Filter out terms that have already been used
          const usedTermIds = new Set(gameState.usedTerms);
          newTerms = newTerms.filter(term => !usedTermIds.has(term.id));
          
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
          
          const updatedState: TrendGuesserGameState = {
            ...gameState,
            currentRound: nextRound,
            knownTerm: newKnownTerm,
            hiddenTerm: newHiddenTerm,
            usedTerms: [...gameState.usedTerms, newTerms[0].id],
            terms: newTerms.slice(1),
            finished: false
          };
          
          await updateDoc(gameRef, {
            '__trendguesser.state': updatedState
          });
          
          console.log('[TrendGuesserService.makeGuess] Firestore - Continuing game with new terms');
        }
      }
      
      return true;
    } else {
      // Incorrect guess - game over
      const updatedState: TrendGuesserGameState = {
        ...gameState,
        finished: true
      };
      
      await updateDoc(gameRef, {
        '__trendguesser.state': updatedState,
        status: 'finished'
      });
      
      // Update high score if needed
      await this.updateHighScore(playerUid, gameState.category, player.score || 0);
      
      console.log('[TrendGuesserService.makeGuess] Firestore - Game over, incorrect guess');
      
      return false;
    }
    
  } catch (error) {
    console.error('[TrendGuesserService.makeGuess] Error:', error);
    throw error;
  }
}
  
  // End the game and update high scores
  static async endGame(gameId: string, playerUid: string, finalScore: number): Promise<void> {
    try {
      // Handle mock mode
      if (USE_MOCK_DATA && typeof window !== 'undefined') {
        console.log('Using mock data for ending game:', gameId);
        
        // Get current game ID from session storage if needed
        const currentGameId = sessionStorage.getItem('current_game_id');
        if (currentGameId && currentGameId !== gameId) {
          console.warn('WARNING: gameId mismatch in endGame. Using current_game_id:', currentGameId);
          gameId = currentGameId;
        }
        
        // Get game data from session storage
        const storedGameData = sessionStorage.getItem(`game_${gameId}`);
        if (storedGameData) {
          const gameData = JSON.parse(storedGameData);
          const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
          
          if (gameState && gameState.started) {
            // Mark game as finished
            gameState.finished = true;
            gameData.status = 'finished';
            
            // Save updated game data
            sessionStorage.setItem(`game_${gameId}`, JSON.stringify(gameData));
            console.log('Updated mock game data as finished:', gameData);
          }
        }
        
        return;
      }
    
      const gameRef = doc(db, 'games', gameId.toUpperCase());
      const gameDoc = await getDoc(gameRef);
      
      if (!gameDoc.exists()) {
        throw new Error('Game does not exist');
      }
      
      const gameData = gameDoc.data();
      const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
      
      if (!gameState) {
        throw new Error('No game state found');
      }
      
      // Only update if game was actually started
      if (gameState.started) {
        // Mark game as finished
        await updateDoc(gameRef, {
          status: 'finished',
          '__trendguesser.state': {
            ...gameState,
            finished: true
          }
        });
        
        // Update high score if needed
        await this.updateHighScore(playerUid, gameState.category, finalScore);
      }
      
    } catch (error) {
      console.error('Error ending game:', error);
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
      // In mock mode, store high score in sessionStorage
      if (USE_MOCK_DATA && typeof window !== 'undefined') {
        const highScoresData = sessionStorage.getItem('highScores');
        let highScores = highScoresData ? JSON.parse(highScoresData) : {};
        
        // Initialize user's high scores if they don't exist
        if (!highScores[playerUid]) {
          highScores[playerUid] = {};
        }
        
        // Update high score if the new score is higher
        const currentHighScore = highScores[playerUid][category] || 0;
        if (score > currentHighScore) {
          highScores[playerUid][category] = score;
          sessionStorage.setItem('highScores', JSON.stringify(highScores));
          console.log(`Updated high score for ${playerUid} in category ${category}: ${score}`);
        }
        
        return;
      }
    
      const playerRef = doc(db, 'players', playerUid);
      const playerDoc = await getDoc(playerRef);
      
      if (playerDoc.exists()) {
        const playerData = playerDoc.data();
        const currentHighScore = playerData.highScores?.[category] || 0;
        
        if (score > currentHighScore) {
          // Update player's high score for this category
          await updateDoc(playerRef, {
            [`highScores.${category}`]: score
          });
          
          // Also update leaderboard if score is significant
          if (score > 5) {
            const leaderboardRef = doc(db, 'leaderboard', `${category}_${playerUid}`);
            await setDoc(leaderboardRef, {
              uid: playerUid,
              name: playerData.name || 'Unknown Player',
              score,
              category,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        }
      }
      
    } catch (error) {
      console.error('Error updating high score:', error);
      // Don't throw, just log - this is a non-critical operation
    }
  }
  
  private static async fetchTermsByCategory(category: SearchCategory): Promise<SearchTerm[]> {
    try {
      if (USE_MOCK_DATA) {
        console.log('Using mock data for search terms');
        
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
        // For specific categories
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
      
      return terms;
      
    } catch (error) {
      console.error('Error fetching terms:', error);
      
      if (USE_MOCK_DATA) {
        console.log('Falling back to mock data due to error');
        return sampleSearchTerms;
      }
      
      throw error;
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