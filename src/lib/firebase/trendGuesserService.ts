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
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || 
                       process.env.NODE_ENV === 'development';

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
  
  // Make a guess (higher or lower)
  static async makeGuess(gameId: string, playerUid: string, isHigher: boolean): Promise<boolean> {
    try {
      // Handle mock mode
      if (USE_MOCK_DATA) {
        console.log('Using mock data for guess:', { gameId, playerUid, isHigher });
        
        // Get game data from session storage
        if (typeof window !== 'undefined') {
          // Check if we need to use the current_game_id instead
          const currentGameId = sessionStorage.getItem('current_game_id');
          if (currentGameId && currentGameId !== gameId) {
            console.warn('WARNING: gameId mismatch in makeGuess. Using current_game_id:', currentGameId, 'instead of:', gameId);
            gameId = currentGameId;
          }
          
          const storedGameData = sessionStorage.getItem(`game_${gameId}`);
          if (!storedGameData) {
            console.error('Mock game not found:', gameId);
            // Try to find any game in session storage as a fallback
            const allKeys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key && key.startsWith('game_')) {
                allKeys.push(key);
                try {
                  const data = JSON.parse(sessionStorage.getItem(key) || '{}');
                  if (data['__trendguesser.state']?.started) {
                    console.log('Found alternative active game:', key);
                    // Update current_game_id and use this game instead
                    const alternativeGameId = key.replace('game_', '');
                    sessionStorage.setItem('current_game_id', alternativeGameId);
                    gameId = alternativeGameId;
                    const altData = sessionStorage.getItem(key);
                    if (altData) {
                      console.log('Using alternative game data');
                      return this.makeGuess(alternativeGameId, playerUid, isHigher);
                    }
                  }
                } catch (e) {
                  // Ignore parsing errors
                }
              }
            }
            
            // If we get here, we couldn't find any active games
            if (allKeys.length > 0) {
              console.log('Found game keys but none are active:', allKeys);
            }
            throw new Error('No active game found');
          }
          
          const gameData = JSON.parse(storedGameData);
          const gameState = gameData['__trendguesser.state'] as TrendGuesserGameState;
          const mockUserUid = sessionStorage.getItem('mock_user_uid') || playerUid || 'mock_user';
          
          // Create player data if it doesn't exist
          let player = gameData[mockUserUid] as TrendGuesserPlayer;
          if (!player) {
            console.log('Player data not found, creating new player data');
            player = {
              uid: mockUserUid,
              name: 'Player',
              score: 0
            };
            gameData[mockUserUid] = player;
          }
          
          if (!gameState) {
            console.error('No game state found in game data:', gameData);
            throw new Error('Game state not found');
          }
          
          if (!gameState.started || gameState.finished) {
            console.error('Game is not in active state:', 
              gameState.started ? 'started' : 'not started', 
              gameState.finished ? 'finished' : 'not finished'
            );
            throw new Error('Game is not active');
          }
          
          // Check if the guess is correct
          // Log volumes for debugging
          console.log('Guess evaluation:', {
            isHigher,
            knownTermVolume: gameState.knownTerm.volume,
            hiddenTermVolume: gameState.hiddenTerm.volume,
            knownTerm: gameState.knownTerm.term,
            hiddenTerm: gameState.hiddenTerm.term
          });
          
          // Determine if the guess is correct
          let isCorrect;
          
          // Store volumes for clarity
          const knownVolume = gameState.knownTerm.volume;
          const hiddenVolume = gameState.hiddenTerm.volume;
          
          // EDGE CASE: If volumes are exactly equal, the guess is ALWAYS correct
          // regardless of whether the player chose "higher" or "lower"
          if (hiddenVolume === knownVolume) {
            console.log('Equal volumes detected! ALWAYS counting guess as correct!');
            isCorrect = true;
          } else {
            // Clear logic for determining correctness:
            // - If player guessed higher, it's correct when hidden volume > known volume
            // - If player guessed lower, it's correct when hidden volume < known volume
            const actuallyHigher = hiddenVolume > knownVolume;
            isCorrect = isHigher ? actuallyHigher : !actuallyHigher;
          }
          
          // Log the result for debugging with very clear information
          console.log(`
            --------- GUESS EVALUATION ---------
            Known term: ${gameState.knownTerm.term} (${knownVolume})
            Hidden term: ${gameState.hiddenTerm.term} (${hiddenVolume})
            Player guessed: ${isHigher ? 'HIGHER' : 'LOWER'}
            Actual relation: Hidden term is ${hiddenVolume > knownVolume ? 'HIGHER' : hiddenVolume < knownVolume ? 'LOWER' : 'EQUAL'} than known term
            Guess result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}
            -------------------------------------
          `);
          
          
          if (isCorrect) {
            // Correct guess - prepare next round
            const nextRound = gameState.currentRound + 1;
            const newPlayerScore = (player.score || 0) + 1;
            
            // Update player score
            player.score = newPlayerScore;
            gameData[mockUserUid] = player;
            
            if (gameState.terms.length > 0) {
              // If we have more terms, set up next round
              const nextTerm = gameState.terms[0];
              const remainingTerms = gameState.terms.slice(1);
              
              // Update game state
              gameState.currentRound = nextRound;
              gameState.knownTerm = gameState.hiddenTerm;
              gameState.hiddenTerm = nextTerm;
              gameState.usedTerms = [...gameState.usedTerms, nextTerm.id];
              gameState.terms = remainingTerms;
            } else {
              // No more terms - player wins
              gameState.finished = true;
              gameState.winner = mockUserUid;
              gameData.status = 'finished';
            }
            
            // Save updated game data
            sessionStorage.setItem(`game_${gameId}`, JSON.stringify(gameData));
            console.log('Updated mock game data after correct guess:', gameData);
            
            return true;
          } else {
            // Wrong guess - game over
            gameState.finished = true;
            gameData.status = 'finished';
            
            // Save updated game data
            sessionStorage.setItem(`game_${gameId}`, JSON.stringify(gameData));
            console.log('Updated mock game data after wrong guess:', gameData);
            
            return false;
          }
        }
        
        return Math.random() > 0.5; // Fallback if no session storage
      }
      
      // Regular Firestore implementation
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
      // Log volumes for debugging
      console.log('Guess evaluation (Firestore):', {
        isHigher,
        knownTermVolume: gameState.knownTerm.volume,
        hiddenTermVolume: gameState.hiddenTerm.volume,
        knownTerm: gameState.knownTerm.term,
        hiddenTerm: gameState.hiddenTerm.term
      });
      
      // Determine if the guess is correct
      let isCorrect;
      
      // EDGE CASE: If volumes are exactly equal, the guess is ALWAYS correct
      // regardless of whether the player chose "higher" or "lower"
      if (gameState.hiddenTerm.volume === gameState.knownTerm.volume) {
        console.log('Equal volumes detected! ALWAYS counting guess as correct!');
        isCorrect = true;
      } else {
        isCorrect = isHigher 
          ? gameState.hiddenTerm.volume > gameState.knownTerm.volume
          : gameState.hiddenTerm.volume < gameState.knownTerm.volume;
      }
      
      // Log the result for debugging
      console.log(`Guess result (Firestore): ${isCorrect ? 'CORRECT' : 'INCORRECT'} (${isHigher ? 'HIGHER' : 'LOWER'})`);
      
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
          
          const updatedState: TrendGuesserGameState = {
            ...gameState,
            currentRound: nextRound,
            knownTerm: gameState.hiddenTerm,
            hiddenTerm: nextTerm,
            usedTerms: [...gameState.usedTerms, nextTerm.id],
            terms: remainingTerms
          };
          
          await updateDoc(gameRef, {
            '__trendguesser.state': updatedState
          });
        } else {
          // No more terms - player wins by completing all terms
          const updatedState: TrendGuesserGameState = {
            ...gameState,
            finished: true,
            winner: playerUid
          };
          
          await updateDoc(gameRef, {
            '__trendguesser.state': updatedState,
            status: 'finished'
          });
          
          // Update high score if needed
          await this.updateHighScore(playerUid, gameState.category, newPlayerScore);
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
        
        return false;
      }
      
    } catch (error) {
      console.error('Error making guess:', error);
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