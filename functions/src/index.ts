import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Image configuration
// IMPORTANT: Keep this in sync with the frontend config in src/utils/imageUtils.ts
const ImageConfig = {
  // Primary image service configuration
  primary: {
    baseUrl: 'https://picsum.photos',
    getUrl: (term: string, width = 800, height = 600): string => {
      // Create a hash from the term for deterministic images
      const hash = term.split('').reduce((acc, char, i) => {
        return acc + char.charCodeAt(0) * (i + 1);
      }, 0);
      
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

// Google Trends data structure
interface TrendPoint {
  time: string;
  value: number[];
}

interface TrendResult {
  value: number;
  formattedValue: string;
  hasData: boolean;
  relatedQueries?: string[];
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
        imageUrl: ImageConfig.primary.getUrl(term),
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
      const trendResult = await scrapeSearchVolume(term);
      
      // Cache the result
      volumeCache[term] = {
        volume: trendResult.value,
        timestamp: Date.now(),
        expires: Date.now() + CACHE_TTL
      };
      
      // Get an image for the term using our configured image service
      const imageUrl = ImageConfig.primary.getUrl(term);
      
      // Get related terms if available
      const relatedTerms = trendResult.relatedQueries || await fetchRelatedTerms(term);
      
      return {
        term,
        volume: trendResult.value,
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
      imageUrl: ImageConfig.primary.getUrl(term),
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
  
  // Get an image for the term using our configured image service
  const imageUrl = ImageConfig.primary.getUrl(term);
  
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

// Scrape search volume data from Google Trends
async function scrapeSearchVolume(term: string): Promise<TrendResult> {
  try {
    // Get Google Trends data via the "explore" endpoint
    // This uses a technique to make a request to the internal Google Trends API
    
    // Define the request parameters
    // Time range: past 12 months
    const timeRange = 'today 12-m';
    
    // Step 1: Get the token for the widget data
    // First, we need to make a request to the explore endpoint to get the tokens
    const exploreUrl = 'https://trends.google.com/trends/api/explore';
    const explorePayload = {
      comparisonItem: [{ keyword: term, geo: '', time: timeRange }],
      category: 0,
      property: ''
    };
    
    // Request options
    const exploreOptions = {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      params: {
        hl: 'en-US',
        tz: '-240', // Eastern Time
        req: JSON.stringify(explorePayload)
      },
      timeout: 10000 // 10-second timeout
    };
    
    // Make the request
    console.log(`Making explore request to Google Trends for term: ${term}`);
    const exploreResponse = await axios.get(exploreUrl, exploreOptions);
    
    // The response starts with ")]}'\n" which we need to remove to get valid JSON
    const exploreData = JSON.parse(exploreResponse.data.slice(5));
    
    if (!exploreData || !exploreData.widgets) {
      console.error('Invalid response from Google Trends explore API:', exploreData);
      throw new Error('Invalid response from Google Trends');
    }
    
    // Find the interest over time widget
    const interestOverTimeWidget = exploreData.widgets.find((widget: any) => 
      widget.id === 'TIMESERIES'
    );
    
    // Find the related queries widget
    const relatedQueriesWidget = exploreData.widgets.find((widget: any) => 
      widget.id === 'RELATED_QUERIES'
    );
    
    if (!interestOverTimeWidget) {
      throw new Error('Could not find interest over time data');
    }
    
    // Step 2: Get the interest over time data
    const timelineUrl = 'https://trends.google.com/trends/api/widgetdata/multiline';
    const timelinePayload = interestOverTimeWidget.request;
    const timelineOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
        'Accept': 'application/json'
      },
      params: {
        hl: 'en-US',
        tz: '-240',
        req: JSON.stringify(timelinePayload),
        token: interestOverTimeWidget.token
      },
      timeout: 10000
    };
    
    console.log(`Getting timeline data for term: ${term}`);
    const timelineResponse = await axios.get(timelineUrl, timelineOptions);
    
    // Parse the timeline data
    const timelineData = JSON.parse(timelineResponse.data.slice(5));
    
    if (!timelineData || !timelineData.default || !timelineData.default.timelineData) {
      console.error('Invalid response from Google Trends timeline API:', timelineData);
      throw new Error('Invalid response from Google Trends timeline API');
    }
    
    // Calculate the average interest over time
    const timelinePoints: TrendPoint[] = timelineData.default.timelineData;
    let totalInterest = 0;
    let pointsWithData = 0;
    
    timelinePoints.forEach((point: TrendPoint) => {
      if (point.value && point.value.length > 0 && !isNaN(point.value[0])) {
        totalInterest += point.value[0];
        pointsWithData++;
      }
    });
    
    const averageInterest = pointsWithData > 0 ? totalInterest / pointsWithData : 0;
    
    // Step 3: Get related queries if available
    let relatedQueries: string[] = [];
    
    if (relatedQueriesWidget) {
      try {
        const queriesUrl = 'https://trends.google.com/trends/api/widgetdata/relatedsearches';
        const queriesPayload = relatedQueriesWidget.request;
        const queriesOptions = {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            'Accept': 'application/json'
          },
          params: {
            hl: 'en-US',
            tz: '-240',
            req: JSON.stringify(queriesPayload),
            token: relatedQueriesWidget.token
          },
          timeout: 10000
        };
        
        console.log(`Getting related queries for term: ${term}`);
        const queriesResponse = await axios.get(queriesUrl, queriesOptions);
        
        // Parse the related queries data
        const queriesData = JSON.parse(queriesResponse.data.slice(5));
        
        if (queriesData && queriesData.default && queriesData.default.rankedList) {
          // Extract the top 5 rising queries if available
          const risingList = queriesData.default.rankedList.find((list: any) => 
            list.title === 'Rising'
          );
          
          if (risingList && risingList.rankedKeyword) {
            relatedQueries = risingList.rankedKeyword
              .slice(0, 5)
              .map((kw: any) => kw.query);
          }
          
          // If rising is not available, use top queries
          if (relatedQueries.length === 0) {
            const topList = queriesData.default.rankedList.find((list: any) => 
              list.title === 'Top'
            );
            
            if (topList && topList.rankedKeyword) {
              relatedQueries = topList.rankedKeyword
                .slice(0, 5)
                .map((kw: any) => kw.query);
            }
          }
        }
      } catch (error) {
        console.error('Error getting related queries:', error);
        // Continue even if related queries fail - we'll fall back to generated ones
      }
    }
    
    // Convert Google Trends interest score (0-100) to a more exciting number for the game
    // Scale between 50,000 and 10,000,000 for better gameplay
    const scaledVolume = Math.floor(50000 + (averageInterest * 100000));
    
    // Return the result
    return {
      value: scaledVolume,
      formattedValue: new Intl.NumberFormat('en-US').format(scaledVolume),
      hasData: pointsWithData > 0,
      relatedQueries: relatedQueries
    };
  } catch (error) {
    console.error('Error scraping Google Trends data:', error);
    
    // If Google Trends fails, try another source like Wikipedia page views
    try {
      return await scrapeWikipediaPageViews(term);
    } catch (wikiError) {
      console.error('Error getting Wikipedia page views:', wikiError);
      throw new Error(`Failed to get search volume data: ${error}`);
    }
  }
}

// Backup method: Try to get Wikipedia page views
async function scrapeWikipediaPageViews(term: string): Promise<TrendResult> {
  try {
    // Wikipedia API requires proper article titles, so we need to search first
    const searchUrl = `https://en.wikipedia.org/w/api.php`;
    const searchParams = {
      action: 'query',
      list: 'search',
      srsearch: term,
      format: 'json',
      srprop: 'size',
      srlimit: 1
    };
    
    console.log(`Searching Wikipedia for term: ${term}`);
    const searchResponse = await axios.get(searchUrl, {
      params: searchParams,
      timeout: 5000
    });
    
    if (!searchResponse.data.query || !searchResponse.data.query.search || searchResponse.data.query.search.length === 0) {
      throw new Error('No Wikipedia article found for this term');
    }
    
    // Get the top article title
    const article = searchResponse.data.query.search[0].title;
    
    // Get page views for the past 60 days
    const pageViewsUrl = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(article)}/daily/20230101/20231231`;
    
    console.log(`Getting Wikipedia page views for article: ${article}`);
    const pageViewsResponse = await axios.get(pageViewsUrl, {
      timeout: 5000
    });
    
    if (!pageViewsResponse.data || !pageViewsResponse.data.items || pageViewsResponse.data.items.length === 0) {
      throw new Error('No page view data available');
    }
    
    // Calculate average daily views
    const items = pageViewsResponse.data.items;
    const totalViews = items.reduce((sum: number, item: any) => sum + item.views, 0);
    const averageViews = Math.floor(totalViews / items.length);
    
    // Scale up the views for the game
    const scaledVolume = Math.max(averageViews * 50, 10000);
    
    return {
      value: scaledVolume,
      formattedValue: new Intl.NumberFormat('en-US').format(scaledVolume),
      hasData: true,
      relatedQueries: [] // Wikipedia doesn't provide related queries
    };
  } catch (error) {
    console.error('Error scraping Wikipedia page views:', error);
    throw error;
  }
}

// Fetch related search terms if not provided by Google Trends
async function fetchRelatedTerms(term: string): Promise<string[]> {
  try {
    // Attempt to use Google's autocomplete API
    const autocompleteUrl = 'https://suggestqueries.google.com/complete/search';
    const params = {
      client: 'firefox',
      q: term,
      hl: 'en'
    };
    
    console.log(`Getting related terms from Google Autocomplete for: ${term}`);
    const response = await axios.get(autocompleteUrl, {
      params,
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 1) {
      const suggestions = response.data[1];
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        // Filter out the original term if it's in the suggestions
        return suggestions
          .filter(suggestion => suggestion.toLowerCase() !== term.toLowerCase())
          .slice(0, 5);
      }
    }
    
    // Fall back to generated terms if API fails
    return generateRelatedTerms(term);
  } catch (error) {
    console.error('Error fetching related terms:', error);
    return generateRelatedTerms(term);
  }
}

// Get trending terms for a category (using Google Trends daily trends)
async function getTrendingTermsForCategory(category: string): Promise<TrendData[]> {
  try {
    // If FORCE_MOCK_DATA is true, always use mock data
    if (FORCE_MOCK_DATA) {
      return getMockTrendingTerms(category);
    }
    
    // Try to get real trending data
    try {
      return await scrapeTrendingTerms(category);
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

// Scrape trending terms from Google Trends daily trends
async function scrapeTrendingTerms(category: string): Promise<TrendData[]> {
  try {
    // Map our game categories to Google Trends categories
    const categoryMap: Record<string, number> = {
      news: 16,
      entertainment: 3,
      technology: 5,
      sports: 20,
      gaming: 8
    };
    
    // Get the Google Trends category ID
    const trendsCategoryId = categoryMap[category] || 0;
    
    // Get daily trends data
    const trendsUrl = 'https://trends.google.com/trends/api/dailytrends';
    const params = {
      hl: 'en-US',
      tz: '-240', // Eastern Time
      geo: 'US',
      ns: 15,
      cat: trendsCategoryId
    };
    
    console.log(`Getting trending terms for category: ${category} (ID: ${trendsCategoryId})`);
    const response = await axios.get(trendsUrl, {
      params,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    // Parse the response (removing the leading garbage characters)
    const data = JSON.parse(response.data.slice(5));
    
    if (!data || !data.default || !data.default.trendingSearchesDays) {
      console.error('Invalid response from Google Trends daily trends API:', data);
      throw new Error('Invalid response from Google Trends daily trends API');
    }
    
    // Extract trending search terms
    const trendingSearchesDays = data.default.trendingSearchesDays;
    
    if (!trendingSearchesDays || trendingSearchesDays.length === 0) {
      throw new Error('No trending searches available');
    }
    
    // Use the most recent day's trends
    const latestTrends = trendingSearchesDays[0];
    
    if (!latestTrends.trendingSearches || latestTrends.trendingSearches.length === 0) {
      throw new Error('No trending searches available for the latest day');
    }
    
    // Extract and process the trending terms
    const trendsData: TrendData[] = [];
    
    for (const trend of latestTrends.trendingSearches.slice(0, 10)) {
      if (trend.title && trend.title.query) {
        const term = trend.title.query;
        
        // Get traffic data if available
        let volume = 0;
        if (trend.formattedTraffic) {
          // Parse the traffic data (e.g., "1M+", "500K+", etc.)
          const trafficStr = trend.formattedTraffic;
          const multiplier = trafficStr.includes('M') ? 1000000 : 
                             trafficStr.includes('K') ? 1000 : 1;
          
          // Extract the number part
          const numMatch = trafficStr.match(/([0-9.]+)/);
          if (numMatch && numMatch[1]) {
            volume = Math.floor(parseFloat(numMatch[1]) * multiplier);
          }
        }
        
        // If no volume was found, generate a volume between 100K and 10M
        if (volume === 0) {
          volume = Math.floor(Math.random() * 9900000) + 100000;
        }
        
        // Add to our trends list
        trendsData.push({
          term,
          volume,
          imageUrl: ImageConfig.primary.getUrl(term)
        });
      }
    }
    
    // If we didn't get enough trends, fill in with mock data
    if (trendsData.length < 10) {
      const mockTrends = await getMockTrendingTerms(category);
      
      // Add mock trends until we have 10
      for (let i = trendsData.length; i < 10; i++) {
        trendsData.push(mockTrends[i - trendsData.length]);
      }
    }
    
    return trendsData;
  } catch (error) {
    console.error('Error scraping trending terms:', error);
    throw error;
  }
}

// Get mock trending terms when real data is unavailable
async function getMockTrendingTerms(category: string): Promise<TrendData[]> {
  // For now, we'll return placeholder data for each category
  const termsByCategory: Record<string, string[]> = {
    news: ['Ukraine conflict', 'COVID-19 updates', 'US elections', 'Climate change', 'Stock market news', 'Olympics', 'Stimulus package', 'Brexit', 'Middle East peace', 'Federal Reserve'],
    entertainment: ['Taylor Swift', 'Spider-Man movie', 'Beyonce', 'Star Wars', 'Stranger Things', 'Marvel', 'Harry Potter', 'Game of Thrones', 'Bridgerton', 'Squid Game'],
    technology: ['iPhone 14', 'Tesla Model Y', 'Artificial Intelligence', 'Metaverse', 'Web3', 'Bitcoin price', 'Windows 11', 'SpaceX launch', 'Virtual Reality', 'NFT marketplace'],
    sports: ['World Cup', 'NBA Finals', 'Super Bowl', 'Olympics 2024', 'Wimbledon', 'UFC', 'Formula 1', 'Premier League', 'NFL draft', 'Champions League'],
    gaming: ['Elden Ring', 'Fortnite Chapter 4', 'Minecraft 1.19', 'Call of Duty Modern Warfare 2', 'GTA 6', 'God of War Ragnarok', 'Hogwarts Legacy', 'Valorant', 'League of Legends', 'Roblox']
  };
  
  const terms = termsByCategory[category] || [];
  
  return Promise.all(terms.map(async (term) => {
    // Get a deterministic volume for consistency
    const seed = term.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rng = seedRandom(seed);
    // Generate random volume between 50,000 and 5,000,000
    const volume = Math.floor(rng() * 4950000) + 50000;
    
    // Get an image for the term
    const imageUrl = ImageConfig.primary.getUrl(term);
    
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