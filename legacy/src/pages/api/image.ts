import { NextApiRequest, NextApiResponse } from 'next';
import { getImageUrl } from '@/utils/imageUtils';

// Cache to store image URLs by search term (lasts for 24 hours)
type ImageCache = {
  [key: string]: {
    url: string;
    timestamp: number;
    expires: number;
  };
};

const imageCache: ImageCache = {};
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { term, category, width, height } = req.query;
      
      // Validate term is a string
      if (!term || typeof term !== 'string') {
        return res.status(400).json({ error: 'Term parameter is required' });
      }
      
      // Parse width and height
      const parsedWidth = width ? parseInt(width as string, 10) : 800;
      const parsedHeight = height ? parseInt(height as string, 10) : 600;
      
      // Create a cache key for this request
      const cacheKey = `${term}_${category || ''}_${parsedWidth}x${parsedHeight}`;
      
      // Check cache first
      if (imageCache[cacheKey] && imageCache[cacheKey].expires > Date.now()) {
        return res.redirect(imageCache[cacheKey].url);
      }
      
      // Check if we have a Pexels API key
      const pexelsApiKey = process.env.PEXELS_API_KEY || process.env.NEXT_PUBLIC_PEXELS_API_KEY;
      
      let imageUrl: string;
      
      if (pexelsApiKey) {
        // Use Pexels API to get an image URL
        try {
          imageUrl = await getImageUrl(term, category as string || parsedWidth, category ? parsedHeight : undefined);
        } catch (error) {
          console.error('Error fetching from Pexels API:', error);
          // Fallback to placeholder
          const seed = term.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
          imageUrl = `https://picsum.photos/seed/${seed}/${parsedWidth}/${parsedHeight}`;
        }
      } else {
        // No API key, use placeholder service
        console.log('No Pexels API key configured, using placeholder images');
        const seed = term.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
        imageUrl = `https://picsum.photos/seed/${seed}/${parsedWidth}/${parsedHeight}`;
      }
      
      // Cache the result
      imageCache[cacheKey] = {
        url: imageUrl,
        timestamp: Date.now(),
        expires: Date.now() + CACHE_EXPIRY
      };
      
      // Redirect to the image URL
      return res.redirect(imageUrl);
    } catch (error) {
      console.error('Error in /api/image:', error);
      // Fallback to a placeholder on error
      const fallbackSeed = Math.floor(Math.random() * 1000);
      return res.redirect(`https://picsum.photos/seed/${fallbackSeed}/800/600`);
    }
  } else {
    // Only allow GET requests
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}