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

// Maximum terms per category to maintain in the database
const MAX_TERMS_PER_CATEGORY = 50;

// Initial seed terms pool - will now be used to seed the Firestore collection
const BUILTIN_TERMS_POOL: Record<string, string[]> = {
  news: ['Ukraine conflict', 'COVID-19 updates', 'US elections', 'Climate change', 'Stock market news', 'Olympics', 'Stimulus package', 'Brexit', 'Middle East peace', 'Federal Reserve'],
  entertainment: ['Taylor Swift', 'Spider-Man movie', 'Beyonce', 'Star Wars', 'Stranger Things', 'Marvel', 'Harry Potter', 'Game of Thrones', 'Bridgerton', 'Squid Game', 'Black Mirror'],
  technology: ['iPhone 14', 'Tesla Model Y', 'Artificial Intelligence', 'Metaverse', 'Web3', 'Bitcoin price', 'Windows 11', 'SpaceX launch', 'Virtual Reality', 'NFT marketplace'],
  sports: ['World Cup', 'NBA Finals', 'Super Bowl', 'Olympics 2024', 'Wimbledon', 'UFC', 'Formula 1', 'Premier League', 'NFL draft', 'Champions League'],
  gaming: ['Elden Ring', 'Fortnite Chapter 4', 'Minecraft 1.19', 'Call of Duty Modern Warfare 2', 'GTA 6', 'God of War Ragnarok', 'Hogwarts Legacy', 'Valorant', 'League of Legends', 'Roblox']
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
  try {
    // Create a prompt to generate new terms
    const prompt = `Generate ${count} new trending search terms for the category "${category}" that are distinct from these existing terms: ${existingTerms.join(', ')}. 
    Provide only the terms as a comma-separated list without numbering or additional explanation.`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an assistant that generates trending search terms for different categories.' },
        { role: 'user', content: prompt }
      ]
    });
    
    const reply = completion.choices[0].message?.content || '';
    
    // Parse the comma-separated list from ChatGPT
    const newTerms = reply
      .split(',')
      .map(term => term.trim())
      .filter(term => term && !existingTerms.includes(term));
    
    console.log(`Generated ${newTerms.length} new terms for category ${category}: ${newTerms.join(', ')}`);
    
    return newTerms;
  } catch (error) {
    console.error(`Error generating new terms for category ${category}:`, error);
    return [];
  }
}

// Function to add new terms to a category
async function addNewTermsToCategory(category: string, newTerms: string[]): Promise<void> {
  if (newTerms.length === 0) return;
  
  try {
    // Get a reference to the category document
    const docRef = db.collection('wordList').doc(category);
    
    // Use a transaction to safely update the terms array
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      
      if (!doc.exists) {
        // If the document doesn't exist, create it
        transaction.set(docRef, {
          category,
          terms: newTerms,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // If it exists, add the new terms (avoiding duplicates)
        const data = doc.data() as WordListDocument;
        const existingTerms = new Set(data.terms);
        const uniqueNewTerms = newTerms.filter(term => !existingTerms.has(term));
        
        if (uniqueNewTerms.length > 0) {
          transaction.update(docRef, {
            terms: admin.firestore.FieldValue.arrayUnion(...uniqueNewTerms),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    });
    
    console.log(`Successfully added new terms to category ${category}`);
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
      const trendData = await getSearchVolume(term);
      
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
      const categories = ['news', 'entertainment', 'technology', 'sports', 'gaming'];
      
      for (const category of categories) {
        console.log(`Processing category: ${category}`);
        
        // Step 1: Get the current terms for this category
        const existingTerms = await getTermsForCategory(category);
        console.log(`Category ${category} has ${existingTerms.length} existing terms`);
        
        // Step 2: Check if we need to add more terms
        if (existingTerms.length < MAX_TERMS_PER_CATEGORY) {
          const termsToAdd = MAX_TERMS_PER_CATEGORY - existingTerms.length;
          console.log(`Need to add ${termsToAdd} more terms to category ${category}`);
          
          // Generate new terms
          const newTerms = await generateNewTermsForCategory(
            category, 
            existingTerms, 
            Math.min(termsToAdd, 10) // Add up to 10 terms at a time
          );
          
          // Add the new terms to the category
          await addNewTermsToCategory(category, newTerms);
          
          // Update the existingTerms array with the new terms
          existingTerms.push(...newTerms);
        }
        
        // Step 3: Select a subset of terms to update their search volumes
        // We'll update about 20% of the terms each time this function runs
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

// Get trending terms for a category using the word list from Firestore
async function getTrendingTermsForCategory(category: string): Promise<TrendData[]> {
  try {
    // Get terms from the wordList collection
    const terms = await getTermsForCategory(category);
    
    // If no terms found, use the built-in pool as fallback
    if (terms.length === 0 && BUILTIN_TERMS_POOL[category]) {
      return Promise.all(BUILTIN_TERMS_POOL[category].map(async (term) => {
        return await getSearchVolume(term);
      }));
    }
    
    // Take a random subset of 10 terms (or less if fewer terms exist)
    const selectedTerms = terms
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(10, terms.length));
    
    // Get the search volume for each term
    return Promise.all(selectedTerms.map(async (term) => {
      return await getSearchVolume(term);
    }));
  } catch (error) {
    console.error(`Error getting trending terms for category ${category}:`, error);
    
    // Fallback to built-in terms if there's an error
    if (BUILTIN_TERMS_POOL[category]) {
      return Promise.all(BUILTIN_TERMS_POOL[category].map(async (term) => {
        return await getSearchVolume(term);
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