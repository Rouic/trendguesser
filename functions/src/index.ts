import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();

// Cache for search volumes to avoid excessive API calls
const volumeCache: Record<string, {
  volume: number;
  timestamp: number;
  expires: number;
}> = {};

// Cache TTL in milliseconds (12 hours)
const CACHE_TTL = 12 * 60 * 60 * 1000;

// Interface for trend data
interface TrendData {
  term: string;
  volume: number;
  imageUrl?: string;
  relatedTerms?: string[];
}

// Configuration switch to use mock data even in production
const FORCE_MOCK_DATA = process.env.FORCE_MOCK_DATA === 'true';

// Function to fetch search volume for a term
export const fetchSearchVolume = functions.https.onCall(async (data, context) => {
  const { term } = data;
  
  if (!term || typeof term !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a valid search term.'
    );
  }
  
  try {
    // Fetch the search volume
    const trendData = await getSearchVolume(term);
    
    // Store data in Firestore
    const termId = term.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await db.collection('searchTerms').doc(termId).set({
      term: term,
      volume: trendData.volume,
      category: 'custom',
      imageUrl: trendData.imageUrl,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Store related terms if available
    if (trendData.relatedTerms && trendData.relatedTerms.length > 0) {
      const batch = db.batch();
      
      for (const relatedTerm of trendData.relatedTerms) {
        if (relatedTerm) {
          const relatedTermData = await getSearchVolume(relatedTerm);
          const relatedTermId = relatedTerm.toLowerCase().replace(/[^a-z0-9]/g, '-');
          
          const docRef = db.collection('searchTerms').doc(relatedTermId);
          batch.set(docRef, {
            term: relatedTerm,
            volume: relatedTermData.volume,
            category: 'custom',
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
    throw new functions.https.HttpsError(
      'internal',
      'Failed to fetch search volume data.'
    );
  }
});

// Function to update trending terms
export const updateTrendingTerms = functions.pubsub.schedule('0 0 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      // Fetch trending terms for each category
      const categories = ['animals', 'celebrities', 'games', 'technology', 'questions'];
      
      for (const category of categories) {
        const trendingTerms = await getTrendingTermsForCategory(category);
        const batch = db.batch();
        
        for (const termData of trendingTerms) {
          const termId = termData.term.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const docRef = db.collection('searchTerms').doc(termId);
          
          batch.set(docRef, {
            term: termData.term,
            volume: termData.volume,
            category: category,
            imageUrl: termData.imageUrl,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
        
        await batch.commit();
      }
      
      return null;
    } catch (error) {
      console.error('Error updating trending terms:', error);
      return null;
    }
  });

// Helper Functions

// Get search volume for a term
async function getSearchVolume(term: string): Promise<TrendData> {
  try {
    // Check if we have a cached value that's still valid
    if (volumeCache[term] && volumeCache[term].expires > Date.now()) {
      console.log(`Using cached data for term: ${term}`);
      return {
        term,
        volume: volumeCache[term].volume,
        imageUrl: `https://source.unsplash.com/featured/?${encodeURIComponent(term)}`,
        relatedTerms: generateRelatedTerms(term)
      };
    }
    
    // If FORCE_MOCK_DATA is true, always use mock data
    if (FORCE_MOCK_DATA) {
      return getMockSearchVolume(term);
    }
    
    // Try to get real data first
    try {
      // Attempt to scrape search volume data
      const volume = await scrapeSearchVolume(term);
      
      // Cache the result
      volumeCache[term] = {
        volume,
        timestamp: Date.now(),
        expires: Date.now() + CACHE_TTL
      };
      
      // Get an image for the term using Unsplash
      const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(term)}`;
      
      // Generate some related terms
      const relatedTerms = await fetchRelatedTerms(term);
      
      return {
        term,
        volume,
        imageUrl,
        relatedTerms
      };
    } catch (error) {
      console.error('Error scraping real search volume data:', error);
      console.log('Falling back to mock data for term:', term);
      
      // Fall back to mock data if scraping fails
      return getMockSearchVolume(term);
    }
  } catch (error) {
    console.error('Error getting search volume:', error);
    
    // Ultimate fallback
    console.log('Using emergency fallback for term:', term);
    return {
      term,
      volume: Math.floor(Math.random() * 10000000) + 1000,
      imageUrl: `https://source.unsplash.com/featured/?${encodeURIComponent(term)}`,
      relatedTerms: generateRelatedTerms(term)
    };
  }
}

// Mock data version of getSearchVolume
function getMockSearchVolume(term: string): TrendData {
  // Generate a deterministic but random-seeming volume based on the term
  // Using the term as a seed ensures the same term always gets the same volume
  const seed = term.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rng = seedRandom(seed);
  const randomVolume = Math.floor(rng() * 10000000) + 1000;
  
  // Cache the result for consistency
  if (!volumeCache[term]) {
    volumeCache[term] = {
      volume: randomVolume,
      timestamp: Date.now(),
      expires: Date.now() + CACHE_TTL
    };
  }
  
  // Get an image for the term using Unsplash
  const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(term)}`;
  
  // Generate some related terms
  const relatedTerms = generateRelatedTerms(term);
  
  return {
    term,
    volume: volumeCache[term].volume,
    imageUrl,
    relatedTerms
  };
}

// Simple seeded random number generator
function seedRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

// Scrape search volume data (this is a placeholder - implement real scraping logic)
async function scrapeSearchVolume(term: string): Promise<number> {
  try {
    // This is where you would implement real scraping logic
    // For demonstration, I'll just simulate a network request and return a random value
    
    // You would typically make a request to a search volume API or scrape a website
    // Example with cheerio (simplified and doesn't reflect real scraping logic):
    const response = await axios.get(`https://example.com/search?q=${encodeURIComponent(term)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 5000 // 5-second timeout
    });
    
    // Simulate parsing the response
    // In a real implementation, you'd use cheerio to parse the HTML and extract the search volume
    const $ = cheerio.load(response.data);
    const volumeText = $('.search-volume-metric').text();
    
    // Simulate extracting a number from the text
    // In reality, this would be real parsing logic
    const volume = parseInt(volumeText.replace(/[^0-9]/g, ''));
    
    // If we couldn't parse a valid volume, generate a random one
    if (isNaN(volume) || volume <= 0) {
      throw new Error('Could not parse valid search volume');
    }
    
    return volume;
  } catch (error) {
    console.error('Error scraping search volume:', error);
    
    // Since this is just a demonstration, throw an error to trigger the fallback
    throw new Error('Scraping failed (expected in this demo)');
  }
}

// Fetch related search terms (placeholder)
async function fetchRelatedTerms(term: string): Promise<string[]> {
  try {
    // In a real implementation, this would call an API or scrape a website
    // For now, just return generated mock related terms
    return generateRelatedTerms(term);
  } catch (error) {
    console.error('Error fetching related terms:', error);
    return generateRelatedTerms(term);
  }
}

// Get trending terms for a category
async function getTrendingTermsForCategory(category: string): Promise<TrendData[]> {
  try {
    // If FORCE_MOCK_DATA is true, always use mock data
    if (FORCE_MOCK_DATA) {
      return getMockTrendingTerms(category);
    }
    
    // Try to get real trending data first
    try {
      // This would call a real API or scrape trending terms
      const trendingTerms = await scrapeTrendingTerms(category);
      return trendingTerms;
    } catch (error) {
      console.error('Error scraping trending terms:', error);
      console.log('Falling back to mock data for category:', category);
      
      // Fall back to mock data if scraping fails
      return getMockTrendingTerms(category);
    }
  } catch (error) {
    console.error('Error getting trending terms for category:', error);
    
    // Ultimate fallback
    return getMockTrendingTerms(category);
  }
}

// Scrape trending terms (placeholder)
async function scrapeTrendingTerms(category: string): Promise<TrendData[]> {
  // This would be real scraping logic in a production environment
  // For now, just throw an error to trigger the fallback
  throw new Error('Scraping trending terms not implemented');
}

// Get mock trending terms
function getMockTrendingTerms(category: string): Promise<TrendData[]> {
  // For now, we'll return placeholder data for each category
  const termsByCategory: Record<string, string[]> = {
    animals: ['cats', 'dogs', 'pandas', 'tigers', 'elephants', 'giraffes', 'monkeys', 'lions', 'penguins', 'koalas'],
    celebrities: ['Taylor Swift', 'Beyonce', 'Brad Pitt', 'Leonardo DiCaprio', 'Tom Cruise', 'Jennifer Lawrence', 'Rihanna', 'Zendaya', 'Robert Downey Jr', 'Scarlett Johansson'],
    games: ['Minecraft', 'Fortnite', 'Call of Duty', 'GTA 5', 'League of Legends', 'Roblox', 'Among Us', 'Valorant', 'Cyberpunk 2077', 'FIFA 23'],
    technology: ['iPhone', 'Samsung Galaxy', 'Tesla', 'Bitcoin', 'AI', 'ChatGPT', 'Virtual Reality', 'Metaverse', 'Blockchain', 'Cloud Computing'],
    questions: ['how to lose weight', 'what time is it', 'how to make money online', 'how to tie a tie', 'when is the super bowl', 'how to screenshot', 'how to download youtube videos', 'what is bitcoin', 'how to create a website', 'what is NFT']
  };
  
  const terms = termsByCategory[category] || [];
  
  return Promise.all(terms.map(async (term) => {
    // Get a deterministic volume for consistency
    const seed = term.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rng = seedRandom(seed);
    // Generate random volume between 10,000 and 5,000,000
    const volume = Math.floor(rng() * 5000000) + 10000;
    
    // Get an image for the term
    const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(term)}`;
    
    return {
      term,
      volume,
      imageUrl
    };
  }));
}

// Generate related terms based on a seed term
function generateRelatedTerms(term: string): string[] {
  // In a real implementation, this would use an API to get related searches
  // For now, we'll generate some placeholders
  
  const prefixes = ['best', 'top', 'how to', 'why', 'when', 'what is', 'who is'];
  const suffixes = ['near me', 'online', 'price', 'reviews', 'vs', 'meaning', 'definition'];
  
  const related: string[] = [];
  
  // Generate a deterministic but random-seeming selection based on the term
  const seed = term.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rng = seedRandom(seed);
  
  // Add a few prefixed terms
  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(rng() * prefixes.length);
    const randomPrefix = prefixes[randomIndex];
    related.push(`${randomPrefix} ${term}`);
  }
  
  // Add a few suffixed terms
  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(rng() * suffixes.length);
    const randomSuffix = suffixes[randomIndex];
    related.push(`${term} ${randomSuffix}`);
  }
  
  return related;
}