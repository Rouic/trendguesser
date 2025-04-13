import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { OpenAI } from 'openai';
import fetch from 'node-fetch';

// Pexels API response types
type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
  photographer: string;
  photographer_url: string;
  avg_color: string;
};

type PexelsSearchResponse = {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
  prev_page?: string;
};

// Image configuration
// IMPORTANT: Keep this in sync with the frontend config in src/utils/imageUtils.ts
const ImageConfig = {
  // Primary image service configuration using Pexels
  pexels: {
    baseUrl: 'https://api.pexels.com/v1',
    apiKey: functions.config().pexels?.key || '', // Get from Firebase config
    
    // Get an image URL from Pexels based on the search term
    getUrl: async (term: string, widthOrCategory?: number | string, height?: number): Promise<string> => {
      // Handle different parameter combinations for backward compatibility
      let width = 800;
      let category: string | undefined = undefined;
      
      if (typeof widthOrCategory === 'number') {
        width = widthOrCategory;
        height = height || 600;
      } else if (typeof widthOrCategory === 'string') {
        category = widthOrCategory;
        height = height || 600;
      }
      try {
        // Create enhanced search terms based on the original term and category
        const enhancedSearchTerm = enhanceSearchTerm(term, category);
        
        // Determine the best orientation based on dimensions
        const actualHeight = height || 600;
        const orientation = width > actualHeight ? 'landscape' : (width < actualHeight ? 'portrait' : 'square');
        
        // API call with enhanced parameters
        const url = `${ImageConfig.pexels.baseUrl}/search?query=${encodeURIComponent(enhancedSearchTerm)}&per_page=15&size=medium&orientation=${orientation}`;
        
        const response = await fetch(url, {
          headers: {
            Authorization: ImageConfig.pexels.apiKey
          }
        });
        
        if (!response.ok) {
          throw new Error(`Pexels API error: ${response.status}`);
        }
        
        const data = await response.json() as PexelsSearchResponse;
        
        if (data.photos && data.photos.length > 0) {
          // Sort photos by relevance to the original term
          const sortedPhotos = sortPhotosByRelevance(data.photos, term);
          
          // Take the most relevant photo
          const photo = sortedPhotos[0];
          
          // Get the appropriate sized image
          let imageUrl = '';
          
          // Choose an appropriate size based on requested dimensions
          if (width <= 400) {
            imageUrl = photo.src.small;
          } else if (width <= 800) {
            imageUrl = photo.src.medium;
          } else if (width <= 1200) {
            imageUrl = photo.src.large;
          } else {
            imageUrl = photo.src.large2x;
          }
          
          return imageUrl;
        }
        
        // If no photos found, try a more simplified search
        return await ImageConfig.pexels.getSimplifiedSearch(term, width, height);
      } catch (error) {
        console.error('Error fetching from Pexels API:', error);
        // Try the fallback approach - this returns a Pexels API endpoint, not an actual image URL
        return await ImageConfig.fallback.getUrl(term, width, height);
      }
    },
    
    // Simplified search when enhanced search returns no results
    getSimplifiedSearch: async (term: string, width = 800, height = 600): Promise<string> => {
      try {
        // Extract key nouns from the term
        const keyTerms = term.split(' ')
          .filter(word => word.length > 3) // Only keep words longer than 3 chars
          .slice(0, 2)                     // Use at most 2 key terms
          .join(' ');
          
        const url = `${ImageConfig.pexels.baseUrl}/search?query=${encodeURIComponent(keyTerms)}&per_page=15`;
        
        const response = await fetch(url, {
          headers: {
            Authorization: ImageConfig.pexels.apiKey || ''
          }
        });
        
        if (!response.ok) {
          throw new Error(`Pexels API error: ${response.status}`);
        }
        
        const data = await response.json() as PexelsSearchResponse;
        
        if (data.photos && data.photos.length > 0) {
          // Pick the first photo from simplified search
          const photo = data.photos[0];
          
          let imageUrl = '';
          
          // Choose an appropriate size based on requested dimensions
          if (width <= 400) {
            imageUrl = photo.src.small;
          } else if (width <= 800) {
            imageUrl = photo.src.medium;
          } else if (width <= 1200) {
            imageUrl = photo.src.large;
          } else {
            imageUrl = photo.src.large2x;
          }
          
          return imageUrl;
        }
        
        throw new Error('No images found in simplified search');
      } catch (error) {
        console.error('Error in simplified Pexels search:', error);
        throw error;
      }
    }
  },
  
  // Fallback image service configuration (still Pexels but with a simpler approach)
  fallback: {
    baseUrl: 'https://api.pexels.com/v1',
    getUrl: async (term: string, width = 800, height = 600): Promise<string> => {
      try {
        // For fallback, try to match with general category terms
        const generalCategory = determineGeneralCategory(term);
        
        const url = `${ImageConfig.pexels.baseUrl}/search?query=${encodeURIComponent(generalCategory)}&per_page=15`;
        
        const response = await fetch(url, {
          headers: {
            Authorization: ImageConfig.pexels.apiKey
          }
        });
        
        if (!response.ok) {
          throw new Error(`Fallback Pexels API error: ${response.status}`);
        }
        
        const data = await response.json() as PexelsSearchResponse;
        
        if (data.photos && data.photos.length > 0) {
          // Create a seed based on the term for deterministic selection
          const seed = term.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
          const photoIndex = seed % data.photos.length;
          const photo = data.photos[photoIndex];
          
          let imageUrl = '';
          
          // Choose an appropriate size based on requested dimensions
          if (width <= 400) {
            imageUrl = photo.src.small;
          } else if (width <= 800) {
            imageUrl = photo.src.medium;
          } else if (width <= 1200) {
            imageUrl = photo.src.large;
          } else {
            imageUrl = photo.src.large2x;
          }
          
          return imageUrl;
        }
        
        // Last resort: curated photos
        return await getBackupFromCurated(term, width, height);
      } catch (error) {
        console.error('Fallback search also failed:', error);
        return `https://via.placeholder.com/${width}x${height}?text=${encodeURIComponent(term)}`;
      }
    }
  }
};

// Helper function: Get backup from curated collection
async function getBackupFromCurated(term: string, width = 800, height = 600): Promise<string> {
  try {
    const seed = term.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
    const page = (seed % 30) + 1; // Get a page between 1-30
    
    const url = `${ImageConfig.pexels.baseUrl}/curated?per_page=15&page=${page}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: ImageConfig.pexels.apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Curated Pexels API error: ${response.status}`);
    }
    
    const data = await response.json() as PexelsSearchResponse;
    
    if (data.photos && data.photos.length > 0) {
      const photoIndex = seed % data.photos.length;
      const photo = data.photos[photoIndex];
      
      let imageUrl = '';
      
      if (width <= 400) {
        imageUrl = photo.src.small;
      } else if (width <= 800) {
        imageUrl = photo.src.medium;
      } else if (width <= 1200) {
        imageUrl = photo.src.large;
      } else {
        imageUrl = photo.src.large2x;
      }
      
      return imageUrl;
    }
    
    throw new Error('No curated images found');
  } catch (error) {
    console.error('Error fetching from curated collection:', error);
    return `https://via.placeholder.com/${width}x${height}?text=${encodeURIComponent(term)}`;
  }
}

// Helper function: Enhance search term based on term and category
function enhanceSearchTerm(term: string, category?: string): string {
  // Remove common stop words
  const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'about'];
  const cleanedTerm = term.split(' ')
    .filter(word => !stopWords.includes(word.toLowerCase()))
    .join(' ');
  
  // Add category-specific enhancements
  if (category) {
    switch (category.toLowerCase()) {
      case 'news':
        return `${cleanedTerm} news event current affairs journalism`;
      case 'entertainment':
        return `${cleanedTerm} entertainment celebrity media`;
      case 'technology':
        return `${cleanedTerm} technology digital electronics`;
      case 'sports':
        return `${cleanedTerm} sports athletic competition`;
      case 'gaming':
        return `${cleanedTerm} game gaming video-game`;
      case 'famous landmarks':
          return `${cleanedTerm} famous landmarks travel tourism`;
      case 'british snacks':
          return `${cleanedTerm} british snacks food culture`;
      case 'fashion':
          return `${cleanedTerm} fashion style clothing`;
      case 'car brands':
          return `${cleanedTerm} car brands automobile vehicle`;
      case 'celebrities':
          return `${cleanedTerm} celebrities famous people`;
      case 'historical figureheads':
          return `${cleanedTerm} historical figureheads history culture`;
      default:
        return `${cleanedTerm} clear high-quality`;
    }
  }
  
  // Add general quality terms if no category
  return `${cleanedTerm} high-quality`;
}

// Helper function: Sort photos by relevance to the original term
function sortPhotosByRelevance(photos: PexelsPhoto[], term: string): PexelsPhoto[] {
  const termWords = term.toLowerCase().split(' ');
  
  return photos.sort((a, b) => {
    const aScore = calculateRelevanceScore(a, termWords);
    const bScore = calculateRelevanceScore(b, termWords);
    
    return bScore - aScore; // Sort by highest score first
  });
}

// Helper function: Calculate relevance score based on alt text and other metadata
function calculateRelevanceScore(photo: PexelsPhoto, termWords: string[]): number {
  let score = 0;
  
  // Check if alt text contains any of the term words
  if (photo.alt) {
    const altWords = photo.alt.toLowerCase().split(' ');
    
    termWords.forEach(word => {
      if (altWords.includes(word)) {
        score += 3; // High score for exact alt text match
      } else if (altWords.some(altWord => altWord.includes(word) || word.includes(altWord))) {
        score += 1; // Lower score for partial match
      }
    });
  }
  
  // Prefer photos with alt text (higher quality metadata)
  if (photo.alt && photo.alt.length > 0) {
    score += 1;
  }
  
  return score;
}

// Helper function: Determine a general category for fallback
function determineGeneralCategory(term: string): string {
  const termLower = term.toLowerCase();
  
  // Map of keywords to categories
  const categoryKeywords: Record<string, string[]> = {
    'technology': ['tech', 'iphone', 'android', 'computer', 'software', 'hardware', 'digital', 'ai', 'artificial intelligence', 'app'],
    'business': ['business', 'finance', 'economy', 'market', 'stock', 'company', 'startup', 'entrepreneur'],
    'entertainment': ['movie', 'film', 'music', 'celebrity', 'actor', 'actress', 'hollywood', 'tv', 'television', 'star'],
    'sports': ['sport', 'football', 'soccer', 'basketball', 'tennis', 'baseball', 'golf', 'olympic', 'athlete'],
    'politics': ['politics', 'government', 'election', 'president', 'congress', 'senate', 'democracy', 'law'],
    'science': ['science', 'research', 'study', 'scientist', 'space', 'astronomy', 'physics', 'biology', 'chemistry'],
    'health': ['health', 'medical', 'doctor', 'hospital', 'disease', 'medicine', 'wellness', 'fitness', 'diet'],
    'travel': ['travel', 'vacation', 'tourism', 'destination', 'hotel', 'flight', 'beach', 'resort'],
    'gaming': ['game', 'gaming', 'playstation', 'xbox', 'nintendo', 'esports', 'fortnite', 'minecraft'],
    'famous landmarks': ['landmark', 'monument', 'building', 'structure', 'historical', 'tourist attraction'],
    'british snacks': ['snack', 'food', 'candy', 'chocolate', 'crisps', 'biscuits', 'sweets'],
    'fashion': ['fashion', 'style', 'clothing', 'apparel', 'accessories', 'trends'],
    'car brands': ['car', 'automobile', 'vehicle', 'motor', 'brand', 'model', 'engine'],
    'celebrities': ['celebrity', 'famous', 'star', 'icon', 'public figure'],
    'historical figureheads': ['historical', 'figurehead', 'leader', 'icon', 'legacy']
  };
  
  // Find matching category
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => termLower.includes(keyword))) {
      return category;
    }
  }
  
  // Default fallback
  return 'contemporary';
}

// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();

// Maximum terms per category to maintain in the database
const MAX_TERMS_PER_CATEGORY = 50;

// Initial seed terms pool - will now be used to seed the Firestore collection
const BUILTIN_TERMS_POOL: Record<string, string[]> = {
  news: ['Ukraine conflict', 'COVID-19 updates', 'US elections', 'Climate change', 'Stock market news', 'Olympics', 'Stimulus package', 'Brexit', 'Middle East peace', 'Federal Reserve'],
  entertainment: ['Taylor Swift', 'Spider-Man movie', 'Beyonce', 'Star Wars', 'Stranger Things', 'Marvel', 'Harry Potter', 'Game of Thrones', 'Bridgerton', 'Squid Game', 'Black Mirror'],
  technology: ['iPhone 14', 'Tesla Model Y', 'Artificial Intelligence', 'Metaverse', 'Web3', 'Bitcoin price', 'Windows 11', 'SpaceX launch', 'Virtual Reality', 'NFT marketplace'],
  sports: ['World Cup', 'NBA Finals', 'Super Bowl', 'Olympics 2024', 'Wimbledon', 'UFC', 'Formula 1', 'Premier League', 'NFL draft', 'Champions League'],
  gaming: ['Elden Ring', 'Fortnite Chapter 4', 'Minecraft 1.19', 'Call of Duty Modern Warfare 2', 'GTA 6', 'God of War Ragnarok', 'Hogwarts Legacy', 'Valorant', 'League of Legends', 'Roblox'],
  'british snacks': ['Cadbury chocolate', 'Walkers crisps', 'Jaffa Cakes', 'Digestives', 'Maltesers', 'Tunnock\'s Tea Cakes', 'Pork scratchings', 'Hula Hoops', 'Twiglets', 'Bounty'],
  'famous landmarks': ['Eiffel Tower', 'Great Wall of China', 'Machu Picchu', 'Statue of Liberty', 'Taj Mahal', 'Colosseum', 'Big Ben', 'Sydney Opera House', 'Christ the Redeemer', 'Pyramids of Giza'],
  'car brands': ['Toyota', 'Ford', 'BMW', 'Mercedes-Benz', 'Honda', 'Chevrolet', 'Volkswagen', 'Audi', 'Porsche', 'Lexus'],
  'historical figureheads': ['Cleopatra', 'Alexander the Great', 'Julius Caesar', 'Marie Curie', 'Albert Einstein', 'Nelson Mandela', 'Mahatma Gandhi', 'Winston Churchill', 'Queen Elizabeth I', 'Martin Luther King Jr.'],
  celebrities: ['Kim Kardashian', 'Dwayne Johnson', 'Selena Gomez', 'Kylie Jenner', 'Justin Bieber', 'Ariana Grande', 'Beyonce', 'Taylor Swift', 'Chris Hemsworth', 'Rihanna'],
  fashion: ['Chanel', 'Gucci', 'Louis Vuitton', 'Prada', 'Versace', 'Dior', 'Burberry', 'Dolce & Gabbana', 'Armani', 'Yves Saint Laurent']
};

// Interface for word list documents in Firestore
interface WordListDocument {
  category: string;
  terms: string[];
  lastUpdated: admin.firestore.Timestamp;
}

// Cache for search volumes to avoid excessive API calls
const volumeCache: Record<string, { volume: number; timestamp: number; expires: number }> = {};
// Cache TTL in milliseconds (12 hours)
const CACHE_TTL = 12 * 60 * 60 * 1000;

// Cache for image URLs
const imageCache: Record<string, { url: string; timestamp: number; expires: number }> = {};
// Image cache TTL (24 hours)
const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000;

// Interface for trend data
interface TrendData {
  term: string;
  volume: number;
  imageUrl?: string;
  relatedTerms?: string[];
}

// Initialize the OpenAI client using the official OpenAI Node API
const openai = new OpenAI({
  apiKey: functions.config().openai.key,
});

// Helper function to get an image URL with caching
async function getImageUrlWithCaching(term: string, category?: string, width = 800, height = 600): Promise<string> {
  const cacheKey = `pexels_${term}_${category || ''}_${width}x${height}`;
  
  // Check if we have a cached URL that hasn't expired
  if (imageCache[cacheKey] && imageCache[cacheKey].expires > Date.now()) {
    return imageCache[cacheKey].url;
  }
  
  try {
    // Get new URL from Pexels
    const imageUrl = await ImageConfig.pexels.getUrl(term, category);
    
    // Cache the result
    imageCache[cacheKey] = {
      url: imageUrl,
      timestamp: Date.now(),
      expires: Date.now() + IMAGE_CACHE_TTL
    };
    
    return imageUrl;
  } catch (error) {
    console.error(`Error getting image URL for term ${term}:`, error);
    
    // Try the fallback approach
    try {
      const fallbackUrl = await ImageConfig.fallback.getUrl(term, width, height);
      
      // Cache the result
      imageCache[cacheKey] = {
        url: fallbackUrl,
        timestamp: Date.now(),
        expires: Date.now() + IMAGE_CACHE_TTL
      };
      
      return fallbackUrl;
    } catch (fallbackError) {
      console.error('Fallback image fetch also failed:', fallbackError);
      
      // Return a generic placeholder image as absolute last resort
      return `https://via.placeholder.com/${width}x${height}?text=${encodeURIComponent(term)}`;
    }
  }
}

// Cloud Function to fetch search volume for a term
export const fetchSearchVolume = functions.https.onCall(async (data, context) => {
  const { term, category } = data;
  
  if (!term || typeof term !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid search term.');
  }
  
  try {
    // Fetch the search volume using ChatGPT lookup
    const trendData = await getSearchVolume(term, category);
    
    // Store data in Firestore
    const termId = term.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await db.collection('searchTerms').doc(termId).set({
      term,
      volume: trendData.volume,
      category: category || 'custom',
      imageUrl: trendData.imageUrl,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Store related terms if available
    if (trendData.relatedTerms && trendData.relatedTerms.length > 0) {
      const batch = db.batch();
      for (const relatedTerm of trendData.relatedTerms) {
        if (relatedTerm) {
          const relatedTermData = await getSearchVolume(relatedTerm, category);
          const relatedTermId = relatedTerm.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const docRef = db.collection('searchTerms').doc(relatedTermId);
          batch.set(docRef, {
            term: relatedTerm,
            volume: relatedTermData.volume,
            category: category || 'custom',
            imageUrl: relatedTermData.imageUrl,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }
      await batch.commit();
    }
    
    return trendData;
  } catch (error) {
    console.error('Error fetching search volume:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fetch search volume data.');
  }
});

// Function to initialize the word list collection if it doesn't exist
async function initializeWordListIfNeeded() {
  try {
    // Check if the wordList collection exists and has documents
    const snapshot = await db.collection('wordList').limit(1).get();
    
    if (snapshot.empty) {
      console.log('Word list collection is empty. Initializing from built-in terms...');
      
      // Create a batch to add all categories
      const batch = db.batch();
      
      // Add each category as a document with its terms
      for (const [category, terms] of Object.entries(BUILTIN_TERMS_POOL)) {
        const docRef = db.collection('wordList').doc(category);
        batch.set(docRef, {
          category,
          terms,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Commit the batch
      await batch.commit();
      console.log('Word list initialized successfully!');
    } else {
      console.log('Word list collection already exists. Skipping initialization.');
    }
  } catch (error) {
    console.error('Error initializing word list:', error);
  }
}

// Function to get terms for a category from the wordList collection
async function getTermsForCategory(category: string): Promise<string[]> {
  try {
    const docRef = db.collection('wordList').doc(category);
    const doc = await docRef.get();
    
    if (doc.exists) {
      const data = doc.data() as WordListDocument;
      return data.terms;
    }
    return [];
  } catch (error) {
    console.error(`Error getting terms for category ${category}:`, error);
    return [];
  }
}

// Generate new terms for a category using ChatGPT
async function generateNewTermsForCategory(category: string, existingTerms: string[], count: number = 5): Promise<string[]> {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // Create a prompt to generate new terms
      const prompt = `Generate ${count} new trending search terms for the category "${category}" that are distinct from these existing terms: ${existingTerms.join(', ')}. 
      Provide only the terms as a comma-separated list without numbering or additional explanation.`;
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an assistant that generates trending search terms for different categories.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8, // Add some variability to responses
        max_tokens: 150   // Limit response size
      });
      
      const reply = completion.choices[0].message?.content || '';
      
      // Parse the comma-separated list from ChatGPT
      const newTerms = reply
        .split(',')
        .map(term => term.trim())
        .filter(term => term && !existingTerms.includes(term));
      
      console.log(`Generated ${newTerms.length} new terms for category ${category}: ${newTerms.join(', ')}`);
      
      // If we got at least one term, return the results
      if (newTerms.length > 0) {
        return newTerms;
      } else {
        // If no terms were generated, try again
        console.log(`No new terms generated for ${category}, retrying...`);
        retryCount++;
      }
    } catch (error) {
      console.error(`Error generating new terms for category ${category} (attempt ${retryCount + 1}):`, error);
      retryCount++;
      
      // Wait before retrying to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // If all retries fail, use a fallback approach
  console.log(`Using fallback term generation for category ${category}`);
  return generateFallbackTerms(category, existingTerms, count);
}

// Fallback function to generate terms when the API fails
function generateFallbackTerms(category: string, existingTerms: string[], count: number): string[] {
  // Basic templates for different categories
  const templates: Record<string, string[]> = {
    news: ['Latest on ', 'Breaking news ', 'Updates about ', 'Developments in '],
    entertainment: ['New movie with ', 'TV show about ', 'Music by ', 'Celebrity '],
    technology: ['New ', ' technology', ' app', ' device', ' software update'],
    sports: [' tournament', ' championship', ' match', ' game', ' player'],
    gaming: ['New game ', ' gameplay', ' release date', ' update for '],
    'famous landmarks': ['Visiting ', 'History of ', 'Facts about ', 'Tours of '],
    'british snacks': ['New flavor of ', 'Where to buy ', 'Recipe for ', 'Best '],
    'fashion': ['2025 trends in ', ' style guide', ' designer', ' collection'],
    'car brands': ['New model from ', ' review', ' vs ', ' price'],
    'celebrities': [' interview', ' new project', ' scandal', ' relationship'],
    'historical figureheads': ['Biography of ', 'Facts about ', 'Legacy of ', 'Documentary on ']
  };
  
  // Base terms for each category to combine with templates
  const baseTerms: Record<string, string[]> = {
    news: ['politics', 'economy', 'pandemic', 'climate change', 'conflict', 'elections'],
    entertainment: ['Netflix', 'Hollywood', 'blockbuster', 'award show', 'streaming'],
    technology: ['AI', 'smartphone', 'software', 'hardware', 'internet', 'virtual reality'],
    sports: ['football', 'basketball', 'tennis', 'golf', 'Olympics', 'soccer'],
    gaming: ['console', 'RPG', 'FPS', 'multiplayer', 'esports', 'PC gaming'],
    'famous landmarks': ['tower', 'monument', 'museum', 'palace', 'castle', 'wonder'],
    'british snacks': ['crisps', 'biscuits', 'chocolate', 'sweets', 'tea', 'savory'],
    'fashion': ['dresses', 'shoes', 'accessories', 'sustainable', 'luxury', 'casual'],
    'car brands': ['electric', 'luxury', 'SUV', 'sports car', 'sedan', 'hatchback'],
    'celebrities': ['actor', 'singer', 'influencer', 'athlete', 'model', 'director'],
    'historical figureheads': ['leader', 'royalty', 'president', 'inventor', 'scientist', 'revolutionary']
  };
  
  // Default fallback if the category isn't in our templates
  const defaultTemplates = ['Top ', 'Best ', 'Popular ', 'Trending '];
  const defaultBase = ['items', 'trends', 'topics', 'news', 'stories', 'products'];
  
  const categoryTemplates = templates[category] || defaultTemplates;
  const categoryBase = baseTerms[category] || defaultBase;
  
  // Generate a seed based on the category for deterministic random selection
  const seed = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rng = (n: number) => (seed * (n + 1)) % 10000 / 10000;
  
  const newTerms: string[] = [];
  const existingSet = new Set(existingTerms);
  
  // Try to generate up to count*2 terms, keeping only unique ones until we have 'count' terms
  for (let i = 0; i < count * 2 && newTerms.length < count; i++) {
    const templateIndex = Math.floor(rng(i) * categoryTemplates.length);
    const baseIndex = Math.floor(rng(i + 100) * categoryBase.length);
    
    let term;
    if (rng(i + 200) > 0.5) {
      term = categoryTemplates[templateIndex] + categoryBase[baseIndex];
    } else {
      term = categoryBase[baseIndex] + ' ' + category;
    }
    
    // Add year or specificity to some terms
    if (rng(i + 300) > 0.7) {
      term += ' 2025';
    }
    
    // Only add if it's unique and not in existing terms
    if (!existingSet.has(term) && !newTerms.includes(term)) {
      newTerms.push(term);
    }
  }
  
  console.log(`Generated ${newTerms.length} fallback terms for category ${category}`);
  return newTerms;
}

// Function to add new terms to a category
async function addNewTermsToCategory(category: string, newTerms: string[]): Promise<void> {
  if (newTerms.length === 0) return;
  
  try {
    // Get a reference to the category document
    const docRef = db.collection('wordList').doc(category);
    
    // Split terms into smaller batches to avoid transaction size limits
    const batchSize = 10;
    for (let i = 0; i < newTerms.length; i += batchSize) {
      const termBatch = newTerms.slice(i, i + batchSize);
      
      // Use a transaction to safely update the terms array
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        
        if (!doc.exists) {
          // If the document doesn't exist, create it
          transaction.set(docRef, {
            category,
            terms: termBatch,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // If it exists, add the new terms (avoiding duplicates)
          const data = doc.data() as WordListDocument;
          const existingTerms = new Set(data.terms);
          const uniqueNewTerms = termBatch.filter(term => !existingTerms.has(term));
          
          if (uniqueNewTerms.length > 0) {
            transaction.update(docRef, {
              terms: admin.firestore.FieldValue.arrayUnion(...uniqueNewTerms),
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      });
      
      // Add a small delay between batches to avoid potential rate limiting
      if (i + batchSize < newTerms.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Successfully added ${newTerms.length} new terms to category ${category}`);
  } catch (error) {
    console.error(`Error adding new terms to category ${category}:`, error);
  }
}

// Function to update search volumes for terms in the database
async function updateSearchVolumesForTerms(category: string, termsToUpdate: string[]): Promise<void> {
  if (termsToUpdate.length === 0) return;
  
  try {
    const batch = db.batch();
    
    for (const term of termsToUpdate) {
      // Get the search volume for the term
      const trendData = await getSearchVolume(term, category);
      
      // Generate a document ID
      const termId = term.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Reference to the searchTerms document
      const docRef = db.collection('searchTerms').doc(termId);
      
      // Set the updated data
      batch.set(docRef, {
        term,
        volume: trendData.volume,
        category,
        imageUrl: trendData.imageUrl,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    
    await batch.commit();
    console.log(`Successfully updated search volumes for ${termsToUpdate.length} terms in category ${category}`);
  } catch (error) {
    console.error(`Error updating search volumes for category ${category}:`, error);
  }
}

// Cloud Function to update trending terms - now runs every 6 hours
export const updateTrendingTerms = functions.pubsub
  .schedule('every 6 hours')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      // First, make sure the word list collection is initialized
      await initializeWordListIfNeeded();
      
      // Define the categories to update
      const categories = ['news', 'entertainment', 'technology', 'sports', 'gaming', 'famous landmarks', 'british snacks', 'fashion', 'car brands', 'celebrities', 'historical figureheads'];
      
      // Process categories in smaller batches to avoid timeouts
      const batchSize = 3; // Process 3 categories at a time
      
      for (let i = 0; i < categories.length; i += batchSize) {
        const categoryBatch = categories.slice(i, i + batchSize);
        console.log(`Processing category batch: ${categoryBatch.join(', ')}`);
        
        // Process each category in the batch concurrently
        const promises = categoryBatch.map(async (category) => {
          try {
            console.log(`Processing category: ${category}`);
            
            // Step 1: Get the current terms for this category
            const existingTerms = await getTermsForCategory(category);
            console.log(`Category ${category} has ${existingTerms.length} existing terms`);
            
            // Step 2: Check if we need to add more terms
            if (existingTerms.length < MAX_TERMS_PER_CATEGORY) {
              const termsToAdd = MAX_TERMS_PER_CATEGORY - existingTerms.length;
              console.log(`Need to add ${termsToAdd} more terms to category ${category}`);
              
              // Generate new terms (with a maximum of 10 at a time)
              const newTerms = await generateNewTermsForCategory(
                category, 
                existingTerms, 
                Math.min(termsToAdd, 10)
              );
              
              // Add the new terms to the category
              await addNewTermsToCategory(category, newTerms);
              
              // Update the existingTerms array with the new terms
              existingTerms.push(...newTerms);
            }
            
            // Step 3: Select a subset of terms to update their search volumes
            const termsToUpdate = existingTerms
              .sort(() => 0.5 - Math.random()) // Shuffle the array
              .slice(0, Math.ceil(existingTerms.length * 0.2)); // Take ~20%
            
            console.log(`Updating search volumes for ${termsToUpdate.length} terms in category ${category}`);
            
            // Step 4: Update the search volumes for the selected terms
            await updateSearchVolumesForTerms(category, termsToUpdate);
            
            // Step 5: Add trending terms to the searchTerms collection
            const trendingTerms = await getTrendingTermsForCategory(category);
            const batch = db.batch();
            
            for (const termData of trendingTerms) {
              const termId = termData.term.toLowerCase().replace(/[^a-z0-9]/g, '-');
              const docRef = db.collection('searchTerms').doc(termId);
              batch.set(docRef, {
                term: termData.term,
                volume: termData.volume,
                category,
                imageUrl: termData.imageUrl,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
              }, { merge: true });
            }
            
            await batch.commit();
            console.log(`Added trending terms to searchTerms collection for category ${category}`);
            
            return { category, success: true };
          } catch (error) {
            console.error(`Error processing category ${category}:`, error);
            return { category, success: false, error };
          }
        });
        
        // Wait for all categories in this batch to complete
        const results = await Promise.all(promises);
        console.log(`Batch results: ${results.map(r => `${r.category}: ${r.success}`).join(', ')}`);
        
        // Add a small delay between batches to avoid rate limits
        if (i + batchSize < categories.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error updating trending terms:', error);
      return null;
    }
  });

// Primary function to get search volume for a term using ChatGPT
async function getSearchVolume(term: string, category?: string): Promise<TrendData> {
  if (volumeCache[term] && volumeCache[term].expires > Date.now()) {
    console.log(`Using cached data for term: ${term}`);
    
    // Get a fresh image URL (or from cache)
    const imageUrl = await getImageUrlWithCaching(term, category);
    
    return {
      term,
      volume: volumeCache[term].volume,
      imageUrl,
      relatedTerms: generateRelatedTerms(term)
    };
  }
  
  try {
    return await getSearchVolumeViaChatGPT(term, category);
  } catch (error) {
    console.error('Error fetching search volume using ChatGPT:', error);
    // Fallback to a deterministic mock value if ChatGPT lookup fails
    return getMockSearchVolume(term, category);
  }
}

// Function to look up search volume via ChatGPT using the OpenAI Node API
async function getSearchVolumeViaChatGPT(term: string, category?: string): Promise<TrendData> {
  const prompt = `Provide the latest trend search volume number for the search term "${term}" as an integer, and if available, list up to 3 related search terms separated by commas. Format your answer as: "Volume: <number>; Related: <term1, term2, term3>".`;
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are an assistant that provides up-to-date trend numbers for search terms using web search.' },
      { role: 'user', content: prompt }
    ]
  });
  
  const reply = completion.choices[0].message?.content as string;
  
  // Use regex to extract the volume and related terms from the response
  const volumeMatch = reply.match(/Volume:\s*([\d,]+)/i);
  const relatedMatch = reply.match(/Related:\s*(.*)/i);
  const volume = volumeMatch ? parseInt(volumeMatch[1].replace(/,/g, ''), 10) : Math.floor(Math.random() * 10000000) + 1000;
  
  let relatedTerms: string[] = [];
  if (relatedMatch && relatedMatch[1]) {
    relatedTerms = relatedMatch[1].split(',').map(s => s.trim()).filter(s => s);
  }
  
  // Cache the result
  volumeCache[term] = {
    volume,
    timestamp: Date.now(),
    expires: Date.now() + CACHE_TTL
  };
  
  // Get image URL from Pexels
  const imageUrl = await getImageUrlWithCaching(term, category);
  
  return {
    term,
    volume,
    imageUrl,
    relatedTerms
  };
}

// Fallback function to generate a mock search volume if ChatGPT call fails
async function getMockSearchVolume(term: string, category?: string): Promise<TrendData> {
  const seed = term.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rng = seedRandom(seed);
  const randomVolume = Math.floor(rng() * 10000000) + 1000;
  
  if (!volumeCache[term]) {
    volumeCache[term] = {
      volume: randomVolume,
      timestamp: Date.now(),
      expires: Date.now() + CACHE_TTL
    };
  }
  
  // Get image URL from Pexels
  const imageUrl = await getImageUrlWithCaching(term, category);
  const relatedTerms = generateRelatedTerms(term);
  
  return {
    term,
    volume: volumeCache[term].volume,
    imageUrl,
    relatedTerms
  };
}

// Simple seeded random number generator (used for mock data and related term generation)
function seedRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Get trending terms for a category using the word list from Firestore
async function getTrendingTermsForCategory(category: string): Promise<TrendData[]> {
  try {
    // Get terms from the wordList collection
    const terms = await getTermsForCategory(category);
    
    // If no terms found, use the built-in pool as fallback
    if (terms.length === 0 && BUILTIN_TERMS_POOL[category]) {
      return Promise.all(BUILTIN_TERMS_POOL[category].map(async (term) => {
        return await getSearchVolume(term, category);
      }));
    }
    
    // Take a random subset of 10 terms (or less if fewer terms exist)
    const selectedTerms = terms
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(10, terms.length));
    
    // Get the search volume for each term
    return Promise.all(selectedTerms.map(async (term) => {
      return await getSearchVolume(term, category);
    }));
  } catch (error) {
    console.error(`Error getting trending terms for category ${category}:`, error);
    
    // Fallback to built-in terms if there's an error
    if (BUILTIN_TERMS_POOL[category]) {
      return Promise.all(BUILTIN_TERMS_POOL[category].map(async (term) => {
        return await getSearchVolume(term, category);
      }));
    }
    
    return [];
  }
}

// Fallback utility to generate related terms if ChatGPT does not return them
function generateRelatedTerms(term: string): string[] {
  const prefixes = ['best', 'top', 'how to', 'why', 'when', 'what is', 'who is'];
  const suffixes = ['near me', 'online', 'price', 'reviews', 'vs', 'meaning', 'definition'];
  
  const related: string[] = [];
  // Generate a deterministic but varied set of related terms based on the term
  const seed = term.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rng = seedRandom(seed);
  
  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(rng() * prefixes.length);
    const randomPrefix = prefixes[randomIndex];
    related.push(`${randomPrefix} ${term}`);
  }
  
  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(rng() * suffixes.length);
    const randomSuffix = suffixes[randomIndex];
    related.push(`${term} ${randomSuffix}`);
  }
  
  return related;
}

// On-demand function to refresh the word list from scratch
export const refreshWordList = functions.https.onCall(async (data, context) => {
  try {
    // Check if caller is an admin (you'll need to implement this check)
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }
    
    // Initialize the word list from scratch
    const batch = db.batch();
    
    // Add each category as a document with its initial terms
    for (const [category, terms] of Object.entries(BUILTIN_TERMS_POOL)) {
      const docRef = db.collection('wordList').doc(category);
      batch.set(docRef, {
        category,
        terms,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Commit the batch
    await batch.commit();
    
    return { success: true, message: 'Word list refreshed successfully' };
  } catch (error) {
    console.error('Error refreshing word list:', error);
    throw new functions.https.HttpsError('internal', 'Failed to refresh word list');
  }
});