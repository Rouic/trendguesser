import { v4 as uuidv4 } from 'uuid';
import { SearchCategory, SearchTerm, GameState, IPlayer, TermsResponse, ApiResponse } from '../types';

// Platform-specific storage implementations will be provided by the platform-specific code
export interface IStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Platform-specific API service implementation
export interface IApiService {
  get<T>(url: string): Promise<ApiResponse<T>>;
  post<T>(url: string, data: any): Promise<ApiResponse<T>>;
  patch<T>(url: string, data: any): Promise<ApiResponse<T>>;
}

export class TrendGuesserService {
  private static instance: TrendGuesserService;
  private isProcessingGuess: boolean = false;
  private termCache: { [category: string]: SearchTerm[] } = {};
  private lastTermIds: { [category: string]: string } = {};
  private hasMoreTerms: { [category: string]: boolean } = {};
  
  // Dependencies injected through constructor
  private storage: IStorage;
  private apiService: IApiService;
  private sampleTerms: SearchTerm[];
  private sampleLeaderboard: IPlayer[];
  
  private constructor(
    storage: IStorage, 
    apiService: IApiService,
    sampleTerms: SearchTerm[],
    sampleLeaderboard: IPlayer[]
  ) {
    this.storage = storage;
    this.apiService = apiService;
    this.sampleTerms = sampleTerms;
    this.sampleLeaderboard = sampleLeaderboard;
  }
  
  // Singleton pattern with dependency injection
  public static getInstance(
    storage: IStorage, 
    apiService: IApiService,
    sampleTerms: SearchTerm[],
    sampleLeaderboard: IPlayer[]
  ): TrendGuesserService {
    if (!TrendGuesserService.instance) {
      TrendGuesserService.instance = new TrendGuesserService(
        storage, 
        apiService,
        sampleTerms,
        sampleLeaderboard
      );
    }
    return TrendGuesserService.instance;
  }

  // Create a new game session
  async createGame(createdBy: string, playerName: string): Promise<string> {
    try {
      // Generate a short 6-character game ID
      const gameId = this.generateGameId();
      
      // Create an initial game state and store it locally
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

      // Store current game ID
      await this.storage.setItem('current_game_id', gameId);
      
      // Make API call to create game on the server
      try {
        await this.apiService.post('/api/games', initialGameData);
      } catch (error) {
        console.error('Failed to create game on server:', error);
        // Continue anyway - we'll rely on local storage
      }

      return gameId;
    } catch (error) {
      console.error('Error creating game:', error);
      return this.generateGameId();
    }
  }

  // Start a new game with selected category using batch loading
  async startGame(gameId: string, category: SearchCategory, customTerm?: string): Promise<GameState | null> {
    try {
      console.log(`Starting game ${gameId} with category ${category}`);
      
      // Get terms for the selected category
      let terms: SearchTerm[] = [];
      
      if (category === 'custom' && customTerm) {
        // For custom games, fetch the custom term and related terms
        terms = await this.fetchCustomTermWithRelated(customTerm);
      } else {
        // For predefined categories, fetch terms using our batch loading system
        terms = await this.ensureTermsAvailable(category, 100);
      }
      
      if (terms.length < 2) {
        console.error('Not enough terms available for category:', category);
        throw new Error('Not enough terms available');
      }
      
      // Shuffle the terms
      const shuffledTerms = this.shuffleTerms(terms);
      
      // Initialize game state with first two terms
      const gameState: GameState = {
        gameId,
        score: 0,
        round: 1,
        knownTerm: shuffledTerms[0],
        hiddenTerm: shuffledTerms[1],
        category,
        finished: false,
        highScore: false
      };
      
      // Save the initial game state for offline capability
      try {
        await this.storage.setItem(
          `tg_local_state_${gameId}`,
          JSON.stringify({
            gameState,
            lastUpdate: new Date().toISOString(),
            pendingUpdates: false,
            usedTerms: [shuffledTerms[0].id, shuffledTerms[1].id],
            remainingTerms: shuffledTerms.slice(2)  // Store remaining terms
          })
        );
        console.log(`Stored initial local game state for ${gameId}`);
      } catch (e) {
        console.error('Error storing initial game state:', e);
      }
      
      // Get current game ID from storage
      const currentGameId = await this.storage.getItem('current_game_id');
      if (currentGameId !== gameId) {
        console.warn('WARNING: current_game_id mismatch. Current:', currentGameId, 'Using:', gameId);
        // Update to ensure consistency
        await this.storage.setItem('current_game_id', gameId);
      }
      
      // In the background, update the server with the initial state
      this.syncGameStateWithServer(gameId, gameState).catch(err => {
        console.warn('Background server sync failed for initial game state:', err);
      });
      
      // Return the created game state for immediate use
      return gameState;
    } catch (error) {
      console.error('Error starting game:', error);
      
      // Create a fallback game state using sample data
      const fallbackState: GameState = {
        gameId,
        score: 0,
        round: 1,
        knownTerm: this.sampleTerms[0],
        hiddenTerm: this.sampleTerms[1],
        category: category || 'general',
        finished: false,
        highScore: false
      };
      
      // Store fallback state
      try {
        await this.storage.setItem(
          `tg_local_state_${gameId}`,
          JSON.stringify({
            gameState: fallbackState,
            lastUpdate: new Date().toISOString(),
            pendingUpdates: false,
            usedTerms: [this.sampleTerms[0].id, this.sampleTerms[1].id],
            remainingTerms: this.sampleTerms.slice(2)
          })
        );
      } catch (e) {
        console.error('Error storing fallback game state:', e);
      }
      
      return fallbackState;
    }
  }
  
  // Helper method to sync game state with server in the background
  private async syncGameStateWithServer(gameId: string, gameState: GameState): Promise<boolean> {
    try {
      // Update game state on the server
      const response = await this.apiService.patch(`/api/games/${gameId}`, {
        status: gameState.finished ? 'finished' : 'active',
        '__trendguesser.state': gameState
      });

      if (!response.success) {
        console.warn(`Failed to sync game state on server`);
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
  async makeGuess(
    gameId: string, 
    playerUid: string, 
    isHigher: boolean
  ): Promise<boolean> {
    // Prevent multiple simultaneous processing
    if (this.isProcessingGuess) {
      console.log('Already processing a guess, skipping');
      return false;
    }
    
    this.isProcessingGuess = true;
    
    try {
      // Get current game ID 
      const currentGameId = await this.storage.getItem("current_game_id");
      if (currentGameId && currentGameId !== gameId) {
        console.warn('WARNING: gameId mismatch. Using current_game_id:', currentGameId, 'instead of:', gameId);
        gameId = currentGameId;
      }
      
      // Get game state from storage
      const localStateKey = `tg_local_state_${gameId}`;
      const localStateJson = await this.storage.getItem(localStateKey);
      
      if (!localStateJson) {
        throw new Error('No local game state found');
      }
      
      const localStateData = JSON.parse(localStateJson);
      const gameState = localStateData.gameState as GameState;
      const usedTerms = localStateData.usedTerms || [];
      const remainingTerms = localStateData.remainingTerms || [];
      
      if (!gameState || !gameState.knownTerm || !gameState.hiddenTerm) {
        throw new Error('Invalid game state - missing term data');
      }
      
      // Extract volumes for comparison
      const knownVolume = gameState.knownTerm.volume ?? 100;
      const hiddenVolume = gameState.hiddenTerm.volume ?? 200;
      
      // Determine if the guess is correct
      let isCorrect;
      
      // If volumes are exactly equal, the guess is always correct
      if (hiddenVolume === knownVolume) {
        isCorrect = true;
      } else {
        const actuallyHigher = hiddenVolume > knownVolume;
        isCorrect = isHigher ? actuallyHigher : !actuallyHigher;
      }
      
      // Store round result
      const roundKey = `round_${gameState.round}`;
      localStateData[roundKey] = {
        knownTerm: gameState.knownTerm,
        hiddenTerm: gameState.hiddenTerm,
        isHigherGuess: isHigher,
        result: isCorrect,
        timestamp: new Date().toISOString()
      };
      
      if (isCorrect) {
        // Update score
        gameState.score += 1;
        
        // Move to next round
        gameState.round += 1;
        
        // The current hidden term becomes the known term
        gameState.knownTerm = { ...gameState.hiddenTerm };
        
        // Get the next term from remaining terms
        if (remainingTerms.length === 0) {
          // Load more terms if available
          if (this.hasMoreTerms[gameState.category]) {
            this.loadMoreTermsInBackground(gameState.category, gameId).catch(err => {
              console.warn('Failed to load additional terms in background:', err);
            });
          }
          
          // If no more terms, create a random one
          gameState.hiddenTerm = {
            id: uuidv4(),
            term: `Term ${Math.floor(Math.random() * 1000)}`,
            category: gameState.category,
            volume: Math.floor(Math.random() * 100) + 1
          };
        } else {
          // Use the next available term
          gameState.hiddenTerm = remainingTerms.shift() as SearchTerm;
        }
        
        // Add new known term to used terms
        usedTerms.push(gameState.knownTerm.id);
        
        // Update local storage
        localStateData.gameState = gameState;
        localStateData.usedTerms = usedTerms;
        localStateData.remainingTerms = remainingTerms;
        localStateData.lastUpdate = new Date().toISOString();
        localStateData.pendingUpdates = true;
        
        await this.storage.setItem(localStateKey, JSON.stringify(localStateData));
        
        // Sync with server in background
        this.syncGameStateWithServer(gameId, gameState).catch(err => {
          console.warn('Background server sync failed:', err);
        });
        
        this.isProcessingGuess = false;
        return true;
      } else {
        // Game over - incorrect guess
        gameState.finished = true;
        
        // Update local storage with game over state
        localStateData.gameState = gameState;
        localStateData.gameOver = true;
        localStateData.lastUpdate = new Date().toISOString();
        
        await this.storage.setItem(localStateKey, JSON.stringify(localStateData));
        
        // Update high score
        await this.updateHighScore(playerUid, gameState.category, gameState.score);
        
        // Sync game over with server
        this.syncGameStateWithServer(gameId, gameState).catch(err => {
          console.warn('Error syncing game over state with server:', err);
        });
        
        this.isProcessingGuess = false;
        return false;
      }
    } catch (error) {
      console.error('Error making guess:', error);
      this.isProcessingGuess = false;
      return false;
    }
  }
  
  // Load more terms in the background when running low
  private async loadMoreTermsInBackground(category: SearchCategory, gameId: string): Promise<void> {
    try {
      console.log(`Loading more terms for ${category}`);
      
      // Check if we have a lastTermId for pagination
      const lastTermId = this.lastTermIds[category];
      
      if (!lastTermId) {
        console.warn('No lastTermId available for pagination');
        return;
      }
      
      // Load next batch of terms
      const { terms } = await this.loadNextTermsBatch(category, lastTermId);
      
      if (!terms || terms.length === 0) {
        console.log('No additional terms available');
        return;
      }
      
      console.log(`Loaded ${terms.length} additional terms`);
      
      // Update the game state with the new terms
      const localStateKey = `tg_local_state_${gameId}`;
      const localStateJson = await this.storage.getItem(localStateKey);
      
      if (localStateJson) {
        const localStateData = JSON.parse(localStateJson);
        
        if (localStateData.gameState) {
          // Add new terms to the remaining terms array
          const currentTerms = localStateData.remainingTerms || [];
          const updatedTerms = [...currentTerms, ...terms];
          
          // Update state with new terms
          localStateData.remainingTerms = updatedTerms;
          localStateData.termsRefreshed = new Date().toISOString();
          
          // Save back to storage
          await this.storage.setItem(localStateKey, JSON.stringify(localStateData));
          console.log(`Updated game state with ${terms.length} new terms. Total now: ${updatedTerms.length}`);
        }
      }
    } catch (error) {
      console.error('Error loading more terms:', error);
    }
  }
  
  // End the game and update high scores
  async endGame(gameId: string, playerUid: string, finalScore: number): Promise<void> {
    try {
      console.log(`Ending game ${gameId} for player ${playerUid} with score ${finalScore}`);
      
      // Get current game ID if needed
      const currentGameId = await this.storage.getItem('current_game_id');
      if (currentGameId && currentGameId !== gameId) {
        console.warn('WARNING: gameId mismatch. Using current_game_id:', currentGameId);
        gameId = currentGameId;
      }
      
      // Get game data from storage
      const localStateKey = `tg_local_state_${gameId}`;
      const localStateJson = await this.storage.getItem(localStateKey);
      
      if (localStateJson) {
        const localStateData = JSON.parse(localStateJson);
        if (localStateData.gameState) {
          const gameState = localStateData.gameState as GameState;
          const category = gameState.category;
          
          // Mark as finished in storage
          gameState.finished = true;
          localStateData.gameState = gameState;
          localStateData.gameOver = true;
          localStateData.endedAt = new Date().toISOString();
          
          // Save back to storage
          await this.storage.setItem(localStateKey, JSON.stringify(localStateData));
          
          // Update high score
          if (category) {
            await this.updateHighScore(playerUid, category, finalScore);
          }
          
          // Sync with server in background
          this.syncGameStateWithServer(gameId, gameState).catch(err => {
            console.warn('Background server sync failed:', err);
          });
          
          // Clean up local state after a delay
          setTimeout(async () => {
            try {
              await this.storage.removeItem(localStateKey);
              console.log(`Cleaned up local state for game ${gameId}`);
            } catch (e) {
              console.warn('Failed to clean up local state:', e);
            }
          }, 60000); // Keep for 1 minute after game end
        }
      }
    } catch (error) {
      console.error('Unexpected error ending game:', error);
    }
  }

  // Update high score
  async updateHighScore(
    playerUid: string, 
    category: SearchCategory, 
    score: number,
    playerName?: string
  ): Promise<void> {
    // Skip if no user ID or category
    if (!playerUid || !category) {
      console.warn("Missing required parameters for updateHighScore:", {
        playerUid, category, score
      });
      return;
    }
    
    // Skip if score is unreasonable
    if (score < 0 || score > 10000) {
      console.warn("Score value out of reasonable range:", score);
      return;
    }
    
    // Standardize category
    if (typeof category === 'string') {
      category = category.toLowerCase() as SearchCategory;
    }
    
    // Try to get player name if not provided
    if (!playerName) {
      playerName = await this.storage.getItem("tg_player_name") || undefined;
    }
    
    console.log(`Updating high score for ${playerUid} (${playerName || 'unnamed'}) in category ${category} with score ${score}`);
    
    // Update local high score
    try {
      const highScoresKey = `tg_highscores_${playerUid}`;
      let existingScores = {};
      
      const storedScores = await this.storage.getItem(highScoresKey);
      if (storedScores) {
        try {
          existingScores = JSON.parse(storedScores);
        } catch (e) {
          console.error("Error parsing stored scores:", e);
        }
      }
      
      // Only update if new score is higher
      const currentHighScore = existingScores[category] || 0;
      
      if (score > currentHighScore) {
        console.log(`New high score for ${category}: ${score} > ${currentHighScore}`);
        
        // Update with new high score
        const updatedScores = {
          ...existingScores,
          [category]: score
        };
        
        // Save to storage
        await this.storage.setItem(highScoresKey, JSON.stringify(updatedScores));
        console.log("Updated storage with new high score");
      } else {
        console.log(`Not a new high score: ${score} <= ${currentHighScore}`);
      }
    } catch (e) {
      console.error("Error updating local high score:", e);
    }
    
    // Update on server
    try {
      const response = await this.apiService.post('/api/highscores', {
        playerUid,
        category,
        score,
        playerName
      });
      
      if (response.success) {
        console.log('Successfully updated high score on server');
      } else {
        console.warn('Failed to update high score on server');
      }
    } catch (err) {
      console.error('Error updating high score on server:', err);
    }
  }

  // Fetch leaderboard for a category
  async getLeaderboard(category: SearchCategory): Promise<IPlayer[]> {
    try {
      // Call the leaderboard API
      const response = await this.apiService.get<IPlayer[]>(`/api/leaderboard?category=${encodeURIComponent(category)}`);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error('Failed to fetch leaderboard');
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      
      // Fallback to sample data
      return this.sampleLeaderboard
        .filter(player => player.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    }
  }

  // Helper methods
  private async fetchTermsByCategory(
    category: SearchCategory,
    batchSize: number = 0,
    lastTermId?: string
  ): Promise<SearchTerm[]> {
    try {
      // Ensure valid category
      if (!category) {
        console.error('Missing category parameter, defaulting to "general"');
        category = 'general';
      }
      
      console.log(`Fetching terms for category: ${category}, batchSize: ${batchSize}, lastTermId: ${lastTermId || 'none'}`);
      
      // Build the API URL with pagination parameters
      let url = `/api/terms?category=${encodeURIComponent(category)}`;
      
      if (batchSize > 0) {
        url += `&batch=true&count=${batchSize}`;
        if (lastTermId) {
          url += `&lastId=${encodeURIComponent(lastTermId)}`;
        }
      }
      
      // Call the terms API
      const response = await this.apiService.get<TermsResponse | SearchTerm[]>(url);
      
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch terms');
      }
      
      // Handle different response formats based on batching
      if (batchSize > 0 && 'terms' in response.data) {
        const data = response.data as TermsResponse;
        
        console.log(`Loaded batch of ${data.terms.length} terms for category ${category}, hasMore: ${data.hasMore}`);
        
        // Update cache state
        this.hasMoreTerms[category] = data.hasMore;
        if (data.lastId) {
          this.lastTermIds[category] = data.lastId;
        }
        
        return data.terms;
      } else {
        // Original format for backward compatibility
        const terms = response.data as SearchTerm[];
        console.log(`Found ${terms.length} terms for category ${category}`);
        return terms;
      }
    } catch (error) {
      console.error('Error fetching terms:', error);
      
      // Fallback to sample data
      console.log('Using fallback terms');
      
      // Simulate batch behavior with sample data
      let filteredTerms;
      
      if (category === 'general') {
        // Return all sample terms
        filteredTerms = this.sampleTerms;
      } else {
        // Filter by category
        filteredTerms = this.sampleTerms.filter(term => term.category === category);
        if (filteredTerms.length === 0) {
          filteredTerms = this.sampleTerms;
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
  async loadInitialTermsBatch(category: SearchCategory, batchSize: number = 100): Promise<{
    terms: SearchTerm[],
    lastTermId: string | null,
    hasMore: boolean
  }> {
    try {
      // Check if we already have cached terms for this category
      if (this.termCache[category] && this.termCache[category].length > 0) {
        console.log(`Using ${this.termCache[category].length} cached terms for ${category}`);
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
      console.error('Error loading initial terms batch:', error);
      return {
        terms: [],
        lastTermId: null,
        hasMore: false
      };
    }
  }
  
  // Load next batch of terms for a category
  async loadNextTermsBatch(category: SearchCategory, lastTermId: string, batchSize: number = 100): Promise<{
    terms: SearchTerm[],
    lastTermId: string | null,
    hasMore: boolean
  }> {
    try {
      // Only fetch if we believe there are more terms
      if (!this.hasMoreTerms[category]) {
        console.log(`No more terms available for ${category}`);
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
      console.error('Error loading next terms batch:', error);
      return {
        terms: [],
        lastTermId: null,
        hasMore: false
      };
    }
  }
  
  // Get all cached terms for a category, fetching more if needed
  async ensureTermsAvailable(category: SearchCategory, minRequiredTerms: number = 10): Promise<SearchTerm[]> {
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
  
  private async fetchCustomTermWithRelated(customTerm: string): Promise<SearchTerm[]> {
    try {
      // Call the custom term API
      const response = await this.apiService.get<SearchTerm[]>(`/api/terms/custom?term=${encodeURIComponent(customTerm)}`);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error('Failed to fetch custom term');
    } catch (error) {
      console.error('Error fetching custom term:', error);
      
      // Create custom term with fallback
      const customSearchTerm: SearchTerm = {
        id: uuidv4(),
        term: customTerm,
        volume: Math.floor(Math.random() * 100) + 1,
        category: 'custom'
      };
      
      // Get some random terms from the sample data
      const randomTerms = [...this.sampleTerms]
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
      
      return [customSearchTerm, ...randomTerms];
    }
  }
  
  private shuffleTerms(terms: SearchTerm[]): SearchTerm[] {
    const shuffled = [...terms];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  private generateGameId(): string {
    // Generate a 6-character alphanumeric code (uppercase)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusable characters
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}