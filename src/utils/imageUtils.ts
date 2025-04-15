/**
 * Utility functions for image handling in TrendGuesser
 */

// Add a type for the Pexels API response
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

// Cache to store image results
type ImageCache = {
  [key: string]: {
    url: string;
    timestamp: number;
    expires: number;
  };
};

// Simple cache for image URLs by search term (lasts for 24 hours)
const imageCache: ImageCache = {};
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Configuration for image sources - centralized for easy updates
 * when APIs change or to switch between different image providers
 */
export const ImageConfig = {
  // Pexels API configuration
  pexels: {
    baseUrl: 'https://api.pexels.com/v1',
    apiKey: process.env.NEXT_PUBLIC_PEXELS_API_KEY || process.env.PEXELS_API_KEY,
    
    /**
     * Fetch an image URL from Pexels based on the search term
     * @param term Search term to find images for
     * @param widthOrCategory Optional width or category string
     * @param height Optional image height
     * @returns Promise resolving to an image URL
     */
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
      
      // Check cache first
      const cacheKey = `pexels_${term}_${category || ''}_${width}x${height || 600}`;
      
      if (imageCache[cacheKey] && imageCache[cacheKey].expires > Date.now()) {
        return imageCache[cacheKey].url;
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
            Authorization: ImageConfig.pexels.apiKey || ''
          }
        });
        
        if (!response.ok) {
          throw new Error(`Pexels API error: ${response.status}`);
        }
        
        const data: PexelsSearchResponse = await response.json();
        
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
          
          // Cache the result
          imageCache[cacheKey] = {
            url: imageUrl,
            timestamp: Date.now(),
            expires: Date.now() + CACHE_EXPIRY
          };
          
          return imageUrl;
        }
        
        // If no photos found, try a more simplified search
        return await ImageConfig.pexels.getSimplifiedSearch(term, width, height);
      } catch (error) {
        console.error('Error fetching from Pexels API:', error);
        // Fall back to backup approach
        return await ImageConfig.backup.getUrl(term, width, height);
      }
    },
    
    /**
     * Simplified search when enhanced search returns no results
     * @param term Search term to find images for
     * @param width Optional image width
     * @param height Optional image height
     * @returns Promise resolving to an image URL
     */
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
        
        const data: PexelsSearchResponse = await response.json();
        
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
  
  // Backup image service configuration using curated collections
  backup: {
    baseUrl: 'https://api.pexels.com/v1',
    
    /**
     * Fetch a backup image URL from Pexels based on general category matching
     * @param term Search term to find images for
     * @param width Optional image width
     * @param height Optional image height
     * @returns Promise resolving to an image URL
     */
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
        
        const data: PexelsSearchResponse = await response.json();
        
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
        return `https://picsum.photos/seed/${encodeURIComponent(term)}/${width}/${height}`
      }
    }
  }
};

/**
 * Get a high-quality image URL for a search term using Pexels API
 * @param term The search term to get an image for
 * @param widthOrCategory Optional width or category string
 * @param height Optional height for the image
 * @returns Promise resolving to a URL string for an image related to the term
 */
export const getImageUrl = async (term: string, widthOrCategory?: number | string, height?: number): Promise<string> => {
  try {
    // Use Pexels API for images with backward compatibility
    return await ImageConfig.pexels.getUrl(term, widthOrCategory, height);
  } catch (error) {
    console.error('Error getting image from Pexels:', error);
    
    // Determine parameters for fallback
    let width = 800;
    if (typeof widthOrCategory === 'number') {
      width = widthOrCategory;
      height = height || 600;
    }
    
    // Fallback to category-based approach
    return await ImageConfig.backup.getUrl(term, width, height || 600);
  }
};

/**
 * Generate a backup image URL from Pexels curated collection
 * @param term The search term to get an image for
 * @param width Optional width for the image
 * @param height Optional height for the image
 * @returns A URL string for a backup image from Pexels
 */
export const getBackupFromCurated = async (term: string, width = 800, height = 600): Promise<string> => {
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
    
    const data: PexelsSearchResponse = await response.json();
    
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
    return `https://picsum.photos/seed/${encodeURIComponent(term)}/${width}/${height}`
  }
};

/**
 * Check if an image URL is valid and accessible
 * @param url The image URL to check
 * @returns Promise resolving to true if valid, false otherwise
 */
export const isImageUrlValid = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('Error checking image URL:', error);
    return false;
  }
};

/**
 * Helper function: Enhance search term based on term and category
 * @param term The original search term
 * @param category Optional category for context-aware enhancement
 * @returns Enhanced search term for better image results
 */
function enhanceSearchTerm(term: string, category?: string): string {
  // Remove common stop words
  const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'about'];
  const cleanedTerm = term.split(' ')
    .filter(word => !stopWords.includes(word.toLowerCase()))
    .join(' ');
  
  // Add category-specific enhancements
  if (category) {
    switch (category.toLowerCase()) {
    case 'technology':
      return `${cleanedTerm} technology digital electronics`;
    case 'sports':
      return `${cleanedTerm} sports athletic competition`;
    case 'landmarks':
      return `${cleanedTerm} famous landmarks travel tourism`;
    case 'snacks':
      return `${cleanedTerm} snacks food culture`;
    default:
      return `${cleanedTerm} high-quality`;
  }
  }
  
  // Add general quality terms if no category
  return `${cleanedTerm} high-quality`;
}

/**
 * Helper function: Sort photos by relevance to the original term
 * @param photos Array of PexelsPhoto objects
 * @param term Original search term
 * @returns Sorted array of photos with most relevant first
 */
function sortPhotosByRelevance(photos: PexelsPhoto[], term: string): PexelsPhoto[] {
  const termWords = term.toLowerCase().split(' ');
  
  return photos.sort((a, b) => {
    const aScore = calculateRelevanceScore(a, termWords);
    const bScore = calculateRelevanceScore(b, termWords);
    
    return bScore - aScore; // Sort by highest score first
  });
}

/**
 * Helper function: Calculate relevance score based on alt text and other metadata
 * @param photo PexelsPhoto object
 * @param termWords Array of words from the original search term
 * @returns Numerical score representing relevance
 */
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

/**
 * Helper function: Determine a general category for fallback
 * @param term Original search term
 * @returns General category that might match the term
 */
function determineGeneralCategory(term: string): string {
  const termLower = term.toLowerCase();
  
  // Map of keywords to categories
  const categoryKeywords: Record<string, string[]> = {
    'technology': ['tech', 'iphone', 'android', 'computer', 'software', 'hardware', 'digital', 'ai', 'artificial intelligence', 'app'],
    'sports': ['sport', 'football', 'soccer', 'basketball', 'tennis', 'baseball', 'golf', 'olympic', 'athlete'],
    'snacks': ['snack', 'crisps', 'chocolate', 'candy', 'sweets', 'biscuits', 'treats'],
    'celebrities': ['celebrity', 'famous', 'star', 'icon', 'legend'],
    'cars': ['car', 'automobile', 'vehicle', 'brand', 'model'],
    'pets': ['pet', 'dog', 'cat', 'animal', 'puppy', 'kitten', 'fish', 'bird'],
    'landmarks': ['landmark', 'monument', 'building', 'structure', 'site'],
    'fashion': ['fashion', 'style', 'clothing', 'apparel', 'designer', 'trend']
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

/**
 * Get a deterministic image based on the term using Pexels curated collection
 * This is a synchronous version that returns a Pexels URL
 * @param term The search term
 * @returns A URL string for a deterministic Pexels API call
 */
export const getDeterministicImageUrl = (term: string): string => {
  // Create a hash from the term for deterministic image selection
  const hash = term.split('').reduce((acc, char, i) => {
    return acc + char.charCodeAt(0) * (i + 1);
  }, 0);
  
  // Use the hash to create a deterministic page number for curated photos
  const page = Math.abs(hash % 100) + 1;
  
  // Return the API URL (client will need to fetch this)
  return `${ImageConfig.backup.baseUrl}/curated?per_page=15&page=${page}`;
};