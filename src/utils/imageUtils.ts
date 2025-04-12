/**
 * Utility functions for image handling in TrendGuesser
 */

/**
 * Configuration for image sources - centralized for easy updates
 * when APIs change or to switch between different image providers
 */
export const ImageConfig = {
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
  
  // Fallback image service configuration
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

/**
 * Get a high-quality image URL for a search term
 * @param term The search term to get an image for
 * @param width Optional width for the image
 * @param height Optional height for the image
 * @returns A URL string for an image related to the term
 */
export const getImageUrl = (term: string, width = 800, height = 600): string => {
  // Use the primary image service
  return ImageConfig.primary.getUrl(term, width, height);
};

/**
 * Generate a fallback image URL if the primary one fails
 * @param term The search term to get an image for
 * @returns A URL string for a fallback image
 */
export const getFallbackImageUrl = (term: string): string => {
  // Use fallback image service
  return ImageConfig.fallback.getUrl(term);
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
 * Get a deterministic image based on the term
 * This ensures the same term always gets the same image
 * @param term The search term
 * @param seed An optional additional seed to vary images for the same term
 * @returns A URL string for a deterministic image
 */
export const getDeterministicImageUrl = (term: string, seed = 0): string => {
  // This is now implemented in the primary image config
  return ImageConfig.primary.getUrl(term, 800, 600);
};