"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTrendingTerms = exports.fetchSearchVolume = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase
admin.initializeApp();
const db = admin.firestore();
// Function to fetch search volume for a term
exports.fetchSearchVolume = functions.https.onCall(async (data, context) => {
    const { term } = data;
    if (!term || typeof term !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid search term.');
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
    }
    catch (error) {
        console.error('Error fetching search volume:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch search volume data.');
    }
});
// Function to update trending terms
exports.updateTrendingTerms = functions.pubsub.schedule('0 0 * * *')
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
    }
    catch (error) {
        console.error('Error updating trending terms:', error);
        return null;
    }
});
// Helper Functions
// Get search volume for a term
async function getSearchVolume(term) {
    try {
        // In a real implementation, this would use an API or web scraping
        // For now, we'll generate a random volume between 1,000 and 10,000,000
        const randomVolume = Math.floor(Math.random() * 10000000) + 1000;
        // Get an image for the term using Unsplash
        const imageUrl = `https://source.unsplash.com/featured/?${encodeURIComponent(term)}`;
        // Generate some related terms (in a real app, these would come from an API)
        const relatedTerms = generateRelatedTerms(term);
        return {
            term,
            volume: randomVolume,
            imageUrl,
            relatedTerms
        };
    }
    catch (error) {
        console.error('Error getting search volume:', error);
        throw error;
    }
}
// Get trending terms for a category
async function getTrendingTermsForCategory(category) {
    // In a real implementation, this would fetch data from Google Trends API
    // or scrape trending terms from a suitable source
    // For now, we'll return placeholder data for each category
    const termsByCategory = {
        animals: ['cats', 'dogs', 'pandas', 'tigers', 'elephants', 'giraffes', 'monkeys', 'lions', 'penguins', 'koalas'],
        celebrities: ['Taylor Swift', 'Beyonce', 'Brad Pitt', 'Leonardo DiCaprio', 'Tom Cruise', 'Jennifer Lawrence', 'Rihanna', 'Zendaya', 'Robert Downey Jr', 'Scarlett Johansson'],
        games: ['Minecraft', 'Fortnite', 'Call of Duty', 'GTA 5', 'League of Legends', 'Roblox', 'Among Us', 'Valorant', 'Cyberpunk 2077', 'FIFA 23'],
        technology: ['iPhone', 'Samsung Galaxy', 'Tesla', 'Bitcoin', 'AI', 'ChatGPT', 'Virtual Reality', 'Metaverse', 'Blockchain', 'Cloud Computing'],
        questions: ['how to lose weight', 'what time is it', 'how to make money online', 'how to tie a tie', 'when is the super bowl', 'how to screenshot', 'how to download youtube videos', 'what is bitcoin', 'how to create a website', 'what is NFT']
    };
    const terms = termsByCategory[category] || [];
    return Promise.all(terms.map(async (term) => {
        // Generate random volume between 10,000 and 5,000,000
        const volume = Math.floor(Math.random() * 5000000) + 10000;
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
function generateRelatedTerms(term) {
    // In a real implementation, this would use an API to get related searches
    // For now, we'll generate some placeholders
    const prefixes = ['best', 'top', 'how to', 'why', 'when', 'what is', 'who is'];
    const suffixes = ['near me', 'online', 'price', 'reviews', 'vs', 'meaning', 'definition'];
    const related = [];
    // Add a few prefixed terms
    for (let i = 0; i < 3; i++) {
        const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        related.push(`${randomPrefix} ${term}`);
    }
    // Add a few suffixed terms
    for (let i = 0; i < 3; i++) {
        const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        related.push(`${term} ${randomSuffix}`);
    }
    return related;
}
//# sourceMappingURL=index.js.map