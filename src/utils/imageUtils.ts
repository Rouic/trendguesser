/**
 * Utility functions for image handling in TrendGuesser
 */

/**
 * Get a high-quality image URL for a search term
 * @param term The search term to get an image for
 * @param width Optional width for the image
 * @param height Optional height for the image
 * @returns A URL string for an image related to the term
 */
export const getImageUrl = (term: string, width = 800, height = 600): string => {
  // Use Unsplash Source API with specific dimensions
  // We add a timestamp to force a refresh when using mock data
  const timestamp = Date.now();
  return `https://source.unsplash.com/featured/${width}x${height}/?${encodeURIComponent(term)}&t=${timestamp}`;
};

/**
 * Generate a fallback image URL if the primary one fails
 * @param term The search term to get an image for
 * @returns A URL string for a fallback image
 */
export const getFallbackImageUrl = (term: string): string => {
  // Use a different image service or approach for fallbacks
  // Here we're using the same service but with different parameters
  const encodedTerm = encodeURIComponent(term.split(' ')[0]);
  return `https://source.unsplash.com/random/800x600/?${encodedTerm}`;
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
  // Create a hash from the term
  const hash = term.split('').reduce((acc, char, i) => {
    return acc + char.charCodeAt(0) * (i + 1);
  }, seed);
  
  // Use the hash to create a predictable ID for an image
  const imageId = Math.abs(hash % 1000); // Get a number between 0-999
  
  // Return a URL with the ID embedded
  return `https://picsum.photos/seed/${imageId}/800/600`;
};