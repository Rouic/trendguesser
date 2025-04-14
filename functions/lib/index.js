"use strict";
// index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcessingStatus = exports.getCategoryStats = exports.resetProcessingState = exports.processSearchTerms = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();
// Configuration
const CONFIG = {
    BATCH_SIZE: 25, // Process 5 items at a time
    MAX_RETRIES: 3, // Maximum retries for Pexels API
    INITIAL_RETRY_DELAY: 1000, // 1 second
    PEXELS_API_KEY: ((_a = functions.config().pexels) === null || _a === void 0 ? void 0 : _a.key) || '',
    PEXELS_BASE_URL: 'https://api.pexels.com/v1',
};
// Cloud Function to process search terms from CSV into Firestore
// Runs every 15 minutes
exports.processSearchTerms = functions.runWith({
    timeoutSeconds: 540, // Maximum timeout (9 minutes)
    memory: '1GB'
}).pubsub
    .schedule('every 15 minutes')
    .timeZone('America/New_York')
    .onRun(async (context) => {
    try {
        // Get current processing state
        const stateRef = db.collection('system').doc('csvProcessingState');
        const stateDoc = await stateRef.get();
        let state;
        let csvData = [];
        // Check if we've already started processing
        if (stateDoc.exists) {
            state = stateDoc.data();
            // If already completed, exit early
            if (state.completed) {
                console.log('CSV processing already completed.');
                return null;
            }
            // Load CSV data
            csvData = await loadCsvData();
            // Verify CSV data loaded correctly
            if (!csvData || csvData.length === 0) {
                console.error('Failed to load CSV data.');
                return null;
            }
            console.log(`Resuming CSV processing from index ${state.lastProcessedIndex + 1}. Total items: ${state.totalItems}`);
        }
        else {
            // First run - initialize the state
            csvData = await loadCsvData();
            // Verify CSV data loaded correctly
            if (!csvData || csvData.length === 0) {
                console.error('Failed to load CSV data.');
                return null;
            }
            state = {
                lastProcessedIndex: -1, // Start with index 0
                totalItems: csvData.length,
                completed: false,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            };
            await stateRef.set(state);
            console.log(`Starting CSV processing. Total items: ${state.totalItems}`);
        }
        // Determine the range to process in this run
        const startIndex = state.lastProcessedIndex + 1;
        const endIndex = Math.min(startIndex + CONFIG.BATCH_SIZE - 1, csvData.length - 1);
        // Process the current batch
        console.log(`Processing batch from index ${startIndex} to ${endIndex}`);
        // Process each item in the batch
        for (let i = startIndex; i <= endIndex; i++) {
            const item = csvData[i];
            await processSearchTerm(item);
            // Update the state after each item in case we timeout
            await stateRef.update({
                lastProcessedIndex: i,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        // Check if we've completed all items
        if (endIndex >= csvData.length - 1) {
            await stateRef.update({
                completed: true,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('CSV processing completed successfully.');
        }
        else {
            console.log(`Processed ${endIndex - startIndex + 1} items. ${csvData.length - endIndex - 1} items remaining.`);
        }
        return null;
    }
    catch (error) {
        console.error('Error in processSearchTerms:', error);
        return null;
    }
});
// Function to load and parse CSV data
async function loadCsvData() {
    try {
        // Try to find the CSV file relative to the current directory
        const csvPath = path.join(__dirname, 'data.csv');
        // Check if file exists
        if (!fs.existsSync(csvPath)) {
            console.log('CSV file not found at path:', csvPath);
            return [];
        }
        // Read file contents
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        return parseCSV(csvContent);
    }
    catch (error) {
        console.error('Error reading CSV file:', error);
        return [];
    }
}
// Parse CSV content into SearchTermItem array - handles the simple format:
// Keyword,Category,Monthly Search Volume
// YouTube,Technology,1200000000
// etc.
function parseCSV(csvContent) {
    if (!csvContent)
        return [];
    const lines = csvContent.split('\n');
    if (lines.length <= 1)
        return []; // Header only or empty file
    const result = [];
    // Skip header (first line)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line)
            continue;
        const values = line.split(',');
        if (values.length >= 3) {
            result.push({
                keyword: values[0].trim(),
                category: values[1].trim().toLowerCase(),
                volume: parseInt(values[2].trim(), 10) || 0
            });
        }
    }
    return result;
}
// Process a single search term and save to Firestore
async function processSearchTerm(item) {
    var _a;
    try {
        console.log(`Processing search term: ${item.keyword} (Category: ${item.category})`);
        // Generate document ID
        const docId = item.keyword.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const docRef = db.collection('searchTerms').doc(docId);
        // Check if this term has already been processed
        const doc = await docRef.get();
        if (doc.exists && ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.imageUrl)) {
            console.log(`Term "${item.keyword}" already processed. Skipping.`);
            // Even if we skip processing the term, make sure it's in the category stats
            await updateCategoryStats(item.category, item.keyword);
            return;
        }
        // Get image URL from Pexels
        const imageUrl = await getImageUrlWithRetry(item.keyword, item.category);
        // Save to Firestore
        await docRef.set({
            term: item.keyword,
            volume: item.volume,
            category: item.category,
            imageUrl: imageUrl,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Update category statistics
        await updateCategoryStats(item.category, item.keyword);
        console.log(`Successfully processed term: ${item.keyword}`);
    }
    catch (error) {
        console.error(`Error processing search term "${item.keyword}":`, error);
        // Still create the document even if image retrieval fails
        try {
            const docId = item.keyword.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const docRef = db.collection('searchTerms').doc(docId);
            await docRef.set({
                term: item.keyword,
                volume: item.volume,
                category: item.category,
                imageUrl: `https://picsum.photos/seed/${encodeURIComponent(item.keyword)}/800/600`, // Fallback image
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            // Update category statistics even if using fallback image
            await updateCategoryStats(item.category, item.keyword);
            console.log(`Created term with fallback image: ${item.keyword}`);
        }
        catch (docError) {
            console.error(`Failed to create document for "${item.keyword}":`, docError);
        }
    }
}
// Update category statistics in Firestore
async function updateCategoryStats(category, term) {
    try {
        const categoryRef = db.collection('categoryStats').doc(category);
        // Use a transaction to safely update the stats
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(categoryRef);
            if (!doc.exists) {
                // Create new category stats if it doesn't exist
                transaction.set(categoryRef, {
                    category: category,
                    count: 1,
                    terms: [term],
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            else {
                // Update existing category stats
                const data = doc.data();
                // Only add the term if it's not already in the array
                if (!data.terms.includes(term)) {
                    transaction.update(categoryRef, {
                        count: data.count + 1,
                        terms: admin.firestore.FieldValue.arrayUnion(term),
                        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            }
        });
        console.log(`Updated category stats for "${category}" with term "${term}"`);
    }
    catch (error) {
        console.error(`Error updating category stats for "${category}":`, error);
    }
}
// Get an image URL from Pexels with retry logic
async function getImageUrlWithRetry(term, category, width = 800, height = 600) {
    let lastError = null;
    // Create enhanced search term based on category
    const searchTerm = enhanceSearchTerm(term, category);
    // Determine orientation based on dimensions
    const orientation = width > height ? 'landscape' : (width < height ? 'portrait' : 'square');
    // Try with exponential backoff
    for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
        try {
            console.log(`Attempt ${attempt + 1}/${CONFIG.MAX_RETRIES} to fetch image for "${term}"`);
            // Construct URL
            const url = `${CONFIG.PEXELS_BASE_URL}/search?query=${encodeURIComponent(searchTerm)}&per_page=15&size=medium&orientation=${orientation}`;
            // Make request
            const response = await (0, node_fetch_1.default)(url, {
                headers: {
                    Authorization: CONFIG.PEXELS_API_KEY
                }
            });
            // Handle rate limit explicitly
            if (response.status === 429) {
                const retryAfter = response.headers.get('retry-after');
                const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
                throw new Error(`Pexels API error: 429 - Rate limited. Retry after: ${waitTime}ms`);
            }
            if (!response.ok) {
                throw new Error(`Pexels API error: ${response.status}`);
            }
            const data = await response.json();
            if (data.photos && data.photos.length > 0) {
                // Sort by relevance
                const sortedPhotos = sortPhotosByRelevance(data.photos, term);
                const photo = sortedPhotos[0];
                // Choose appropriate size
                let imageUrl;
                if (width <= 400) {
                    imageUrl = photo.src.small;
                }
                else if (width <= 800) {
                    imageUrl = photo.src.medium;
                }
                else if (width <= 1200) {
                    imageUrl = photo.src.large;
                }
                else {
                    imageUrl = photo.src.large2x;
                }
                return imageUrl;
            }
            // If no photos found, try simplified search
            return await getSimplifiedImageSearch(term, width, height);
        }
        catch (error) {
            lastError = error;
            // If it's not the last attempt and it's a rate limit error
            const is429Error = error.message && error.message.includes('429');
            if (attempt < CONFIG.MAX_RETRIES - 1) {
                // Calculate exponential backoff delay with jitter
                const delay = CONFIG.INITIAL_RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 1000;
                if (is429Error) {
                    console.log(`Rate limit hit for "${term}". Retrying in ${Math.round(delay / 1000)} seconds...`);
                }
                else {
                    console.log(`Error fetching image for "${term}". Retrying in ${Math.round(delay / 1000)} seconds...`);
                }
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    // After all retries are exhausted, try fallback
    try {
        console.log(`Using fallback approach for "${term}" after exhausting retries. Last error: ${lastError === null || lastError === void 0 ? void 0 : lastError.message}`);
        return await getFallbackImage(term, category, width, height);
    }
    catch (fallbackError) {
        console.error(`Fallback image fetch also failed after previous error: ${lastError === null || lastError === void 0 ? void 0 : lastError.message}. Fallback error: ${fallbackError}`);
        // Return a generic placeholder as absolute last resort
        return `https://picsum.photos/seed/${encodeURIComponent(term)}/${width}/${height}`;
    }
}
// Simplified search when enhanced search returns no results
async function getSimplifiedImageSearch(term, width = 800, height = 600) {
    try {
        // Extract key nouns from the term
        const keyTerms = term.split(' ')
            .filter(word => word.length > 3) // Only keep words longer than 3 chars
            .slice(0, 2) // Use at most 2 key terms
            .join(' ');
        if (!keyTerms) {
            return `https://picsum.photos/seed/${encodeURIComponent(term)}/${width}/${height}`;
        }
        const url = `${CONFIG.PEXELS_BASE_URL}/search?query=${encodeURIComponent(keyTerms)}&per_page=15`;
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                Authorization: CONFIG.PEXELS_API_KEY
            }
        });
        if (!response.ok) {
            throw new Error(`Simplified Pexels API error: ${response.status}`);
        }
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            const photo = data.photos[0];
            let imageUrl;
            if (width <= 400) {
                imageUrl = photo.src.small;
            }
            else if (width <= 800) {
                imageUrl = photo.src.medium;
            }
            else if (width <= 1200) {
                imageUrl = photo.src.large;
            }
            else {
                imageUrl = photo.src.large2x;
            }
            return imageUrl;
        }
        throw new Error('No images found in simplified search');
    }
    catch (error) {
        console.error('Error in simplified Pexels search:', error);
        throw error;
    }
}
// Final fallback for image retrieval
async function getFallbackImage(term, category, width = 800, height = 600) {
    try {
        // Try with general category
        const generalCategory = determineGeneralCategory(term, category);
        const url = `${CONFIG.PEXELS_BASE_URL}/search?query=${encodeURIComponent(generalCategory)}&per_page=15`;
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                Authorization: CONFIG.PEXELS_API_KEY
            }
        });
        if (!response.ok) {
            throw new Error(`Fallback Pexels API error: ${response.status}`);
        }
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            // Create a seed based on the term for deterministic selection
            const seed = term.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
            const photoIndex = seed % data.photos.length;
            const photo = data.photos[photoIndex];
            let imageUrl;
            if (width <= 400) {
                imageUrl = photo.src.small;
            }
            else if (width <= 800) {
                imageUrl = photo.src.medium;
            }
            else if (width <= 1200) {
                imageUrl = photo.src.large;
            }
            else {
                imageUrl = photo.src.large2x;
            }
            return imageUrl;
        }
        // Last resort: curated photos
        return await getCuratedImage(term, width, height);
    }
    catch (error) {
        console.error('Fallback search failed:', error);
        return `https://picsum.photos/seed/${encodeURIComponent(term)}/${width}/${height}`;
    }
}
// Get an image from Pexels curated collection
async function getCuratedImage(term, width = 800, height = 600) {
    try {
        const seed = term.split('').reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
        const page = (seed % 30) + 1; // Get a page between 1-30
        const url = `${CONFIG.PEXELS_BASE_URL}/curated?per_page=15&page=${page}`;
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                Authorization: CONFIG.PEXELS_API_KEY
            }
        });
        if (!response.ok) {
            throw new Error(`Curated Pexels API error: ${response.status}`);
        }
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            const photoIndex = seed % data.photos.length;
            const photo = data.photos[photoIndex];
            let imageUrl;
            if (width <= 400) {
                imageUrl = photo.src.small;
            }
            else if (width <= 800) {
                imageUrl = photo.src.medium;
            }
            else if (width <= 1200) {
                imageUrl = photo.src.large;
            }
            else {
                imageUrl = photo.src.large2x;
            }
            return imageUrl;
        }
        throw new Error('No curated images found');
    }
    catch (error) {
        console.error('Error fetching from curated collection:', error);
        return `https://picsum.photos/seed/${encodeURIComponent(term)}/${width}/${height}`;
    }
}
// Helper function: Enhance search term based on category
function enhanceSearchTerm(term, category) {
    // Remove common stop words
    const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'about'];
    const cleanedTerm = term.split(' ')
        .filter(word => !stopWords.includes(word.toLowerCase()))
        .join(' ');
    // Add category-specific enhancements
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
// Helper function: Sort photos by relevance to the original term
function sortPhotosByRelevance(photos, term) {
    const termWords = term.toLowerCase().split(' ');
    return photos.sort((a, b) => {
        const aScore = calculateRelevanceScore(a, termWords);
        const bScore = calculateRelevanceScore(b, termWords);
        return bScore - aScore; // Sort by highest score first
    });
}
// Helper function: Calculate relevance score based on alt text and other metadata
function calculateRelevanceScore(photo, termWords) {
    let score = 0;
    // Check if alt text contains any of the term words
    if (photo.alt) {
        const altWords = photo.alt.toLowerCase().split(' ');
        termWords.forEach(word => {
            if (altWords.includes(word)) {
                score += 3; // High score for exact alt text match
            }
            else if (altWords.some(altWord => altWord.includes(word) || word.includes(altWord))) {
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
function determineGeneralCategory(term, category) {
    // If we already have a category, use it
    if (category && ['technology', 'sports', 'landmarks', 'snacks'].includes(category)) {
        return category;
    }
    const termLower = term.toLowerCase();
    // Map of keywords to categories
    const categoryKeywords = {
        'technology': ['tech', 'iphone', 'android', 'computer', 'software', 'hardware', 'digital', 'ai', 'artificial intelligence', 'app'],
        'sports': ['sport', 'football', 'soccer', 'basketball', 'tennis', 'baseball', 'golf', 'olympic', 'athlete'],
        'landmarks': ['landmark', 'monument', 'building', 'structure', 'historical', 'tourist attraction'],
        'snacks': ['snack', 'food', 'candy', 'chocolate', 'crisps', 'biscuits', 'sweets'],
    };
    // Find matching category
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => termLower.includes(keyword))) {
            return cat;
        }
    }
    // Default fallback
    return 'contemporary';
}
// Reset processing state - useful for testing or if process gets stuck
exports.resetProcessingState = functions.https.onCall(async (data, context) => {
    try {
        // Verify authorization (this is a simple check - implement proper auth as needed)
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
        }
        // Reset the state
        await db.collection('system').doc('csvProcessingState').set({
            lastProcessedIndex: -1,
            totalItems: 0,
            completed: false,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, message: 'Processing state reset successfully' };
    }
    catch (error) {
        console.error('Error resetting processing state:', error);
        throw new functions.https.HttpsError('internal', 'Failed to reset processing state');
    }
});
// Helper function to get category statistics
exports.getCategoryStats = functions.https.onCall(async (data, context) => {
    try {
        // If a specific category is requested
        if (data && data.category) {
            const category = data.category.toLowerCase();
            const docRef = db.collection('categoryStats').doc(category);
            const doc = await docRef.get();
            if (!doc.exists) {
                return { category, exists: false };
            }
            return Object.assign(Object.assign({}, doc.data()), { exists: true });
        }
        // Otherwise return all categories
        const snapshot = await db.collection('categoryStats').get();
        if (snapshot.empty) {
            return { categories: [] };
        }
        const categories = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                category: data.category,
                count: data.count,
                lastUpdated: data.lastUpdated,
                // Don't include terms array in summary to keep response size small
            };
        });
        return { categories };
    }
    catch (error) {
        console.error('Error getting category stats:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get category statistics');
    }
});
// Helper function to get processing status
exports.getProcessingStatus = functions.https.onCall(async (data, context) => {
    try {
        const stateRef = db.collection('system').doc('csvProcessingState');
        const stateDoc = await stateRef.get();
        if (!stateDoc.exists) {
            return {
                status: 'Not started',
                progress: 0,
                lastUpdated: null
            };
        }
        const state = stateDoc.data();
        const progress = state.totalItems > 0
            ? Math.round(((state.lastProcessedIndex + 1) / state.totalItems) * 100)
            : 0;
        return {
            status: state.completed ? 'Completed' : 'In progress',
            progress: progress,
            lastProcessedIndex: state.lastProcessedIndex,
            totalItems: state.totalItems,
            lastUpdated: state.lastUpdated
        };
    }
    catch (error) {
        console.error('Error getting processing status:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get processing status');
    }
});
//# sourceMappingURL=index.js.map