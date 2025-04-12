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

// Development mode flag
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || 
                       process.env.NODE_ENV === 'development';

export class TrendGuesserService {
  // Start a new game with selected category
  static async startGame(gameId: string, category: SearchCategory, customTerm?: string): Promise<void> {
    try {
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
      } else {
        // In mock mode, we just log what would have happened
        console.log('Mock: Game started with category:', category);
        
        // Store the game state in sessionStorage for mock mode
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`game_${gameId}`, JSON.stringify({
            status: 'active',
            '__trendguesser.state': gameState,
            [sessionStorage.getItem('mock_user_uid') || 'mock_user']: {
              uid: sessionStorage.getItem('mock_user_uid') || 'mock_user',
              name: 'Mock Player',
              score: 0
            }
          }));
        }
      }
      
    } catch (error) {
      console.error('Error starting game:', error);
      
      if (USE_MOCK_DATA) {
        console.log('Falling back to mock game state due to error');
        // Create a basic mock game state
        return;
      }
      
      throw error;
    }
  }
  
  // Make a guess (higher or lower)
  static async makeGuess(gameId: string, playerUid: string, isHigher: boolean): Promise<boolean> {
    try {
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
      const isCorrect = isHigher 
        ? gameState.hiddenTerm.volume > gameState.knownTerm.volume
        : gameState.hiddenTerm.volume < gameState.knownTerm.volume;
      
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
        // Return the game ID without actually writing to Firestore
        return gameId;
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
        imageUrl: `https://source.unsplash.com/featured/?${encodeURIComponent(customTerm)}`,
        timestamp: Timestamp.now()
      };
      
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