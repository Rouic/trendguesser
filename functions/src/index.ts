import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { OpenAI } from 'openai';

// Image configuration
// IMPORTANT: Keep this in sync with the frontend config in src/utils/imageUtils.ts
const ImageConfig = {
  // Primary image service configuration
  primary: {
    baseUrl: 'https://picsum.photos',
    getUrl: (term: string, width = 800, height = 600): string => {
      // Create a hash from the term for deterministic images
      const hash = term.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
      // Use the hash to create a predictable ID for an image
      const imageId = Math.abs(hash % 1000); // Get a number between 0-999
      return `${ImageConfig.primary.baseUrl}/seed/${imageId}/${width}/${height}`;
    }
  },
  
  // Fallback image service configuration (for consistency with frontend)
  fallback: {
    baseUrl: 'https://picsum.photos',
    getUrl: (term: string, width = 800, height = 600): string => {
      return `${ImageConfig.fallback.baseUrl}/id/${Math.floor(Math.random() * 1000)}/${width}/${height}`;
    }
  },
  
  // Unsplash configuration (currently not working reliably)
  unsplash: {
    baseUrl: 'https://source.unsplash.com',
    getUrl: (term: string, width = 800, height = 600): string => {
      return `${ImageConfig.unsplash.baseUrl}/random/${width}x${height}?${encodeURIComponent(term)}`;
    }
  }
};

// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();

// Easily updatable pool of built‑in terms for each category
const BUILTIN_TERMS_POOL: Record<string, string[]> = {
  news: ['Ukraine conflict', 'COVID-19 updates', 'US elections', 'Climate change', 'Stock market news', 'Olympics', 'Stimulus package', 'Brexit', 'Middle East peace', 'Federal Reserve'],
  entertainment: ['Taylor Swift', 'Spider-Man movie', 'Beyonce', 'Star Wars', 'Stranger Things', 'Marvel', 'Harry Potter', 'Game of Thrones', 'Bridgerton', 'Squid Game'],
  technology: ['iPhone 14', 'Tesla Model Y', 'Artificial Intelligence', 'Metaverse', 'Web3', 'Bitcoin price', 'Windows 11', 'SpaceX launch', 'Virtual Reality', 'NFT marketplace'],
  sports: ['World Cup', 'NBA Finals', 'Super Bowl', 'Olympics 2024', 'Wimbledon', 'UFC', 'Formula 1', 'Premier League', 'NFL draft', 'Champions League'],
  gaming: ['Elden Ring', 'Fortnite Chapter 4', 'Minecraft 1.19', 'Call of Duty Modern Warfare 2', 'GTA 6', 'God of War Ragnarok', 'Hogwarts Legacy', 'Valorant', 'League of Legends', 'Roblox']
};

// Cache for search volumes to avoid excessive API calls
const volumeCache: Record<string, { volume: number; timestamp: number; expires: number }> = {};
// Cache TTL in milliseconds (12 hours)
const CACHE_TTL = 12 * 60 * 60 * 1000;

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

// Cloud Function to fetch search volume for a term
export const fetchSearchVolume = functions.https.onCall(async (data, context) => {
  const { term } = data;
  
  if (!term || typeof term !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid search term.');
  }
  
  try {
    // Fetch the search volume using ChatGPT lookup
    const trendData = await getSearchVolume(term);
    
    // Store data in Firestore
    const termId = term.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await db.collection('searchTerms').doc(termId).set({
      term,
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
    throw new functions.https.HttpsError('internal', 'Failed to fetch search volume data.');
  }
});

// Cloud Function to update trending terms based on built‑in pool
export const updateTrendingTerms = functions.pubsub.schedule('0 0 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      // Use built‑in categories from the pool for trending term updates
      const categories = ['news', 'entertainment', 'technology', 'sports', 'gaming'];
      for (const category of categories) {
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
      }
      
      return null;
    } catch (error) {
      console.error('Error updating trending terms:', error);
      return null;
    }
});

// Primary function to get search volume for a term using ChatGPT
async function getSearchVolume(term: string): Promise<TrendData> {
  if (volumeCache[term] && volumeCache[term].expires > Date.now()) {
    console.log(`Using cached data for term: ${term}`);
    return {
      term,
      volume: volumeCache[term].volume,
      imageUrl: ImageConfig.primary.getUrl(term),
      relatedTerms: generateRelatedTerms(term)
    };
  }
  
  try {
    return await getSearchVolumeViaChatGPT(term);
  } catch (error) {
    console.error('Error fetching search volume using ChatGPT:', error);
    // Fallback to a deterministic mock value if ChatGPT lookup fails
    return getMockSearchVolume(term);
  }
}

// Function to look up search volume via ChatGPT using the OpenAI Node API
async function getSearchVolumeViaChatGPT(term: string): Promise<TrendData> {
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
  
  const imageUrl = ImageConfig.primary.getUrl(term);
  
  return {
    term,
    volume,
    imageUrl,
    relatedTerms
  };
}

// Fallback function to generate a mock search volume if ChatGPT call fails
function getMockSearchVolume(term: string): TrendData {
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
  
  const imageUrl = ImageConfig.primary.getUrl(term);
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

// Get trending terms for a category using the built‑in terms pool and ChatGPT for each term
async function getTrendingTermsForCategory(category: string): Promise<TrendData[]> {
  const terms = BUILTIN_TERMS_POOL[category] || [];
  return Promise.all(terms.map(async (term) => {
    return await getSearchVolume(term);
  }));
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
