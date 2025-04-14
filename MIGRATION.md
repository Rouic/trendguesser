# TrendGuesser Migration: Firebase to Vercel/Next.js API Routes

This document outlines the migration of TrendGuesser from Firebase (Firestore/Functions) to Vercel with Next.js API Routes.

## Migration Summary

We've migrated the TrendGuesser game from Firebase (Firestore and Cloud Functions) to a more streamlined architecture using:

- **Next.js API Routes**: For backend functionality
- **File-based storage**: JSON files in a data directory
- **Vercel deployment**: For hosting and serverless functions
- **Client-side authentication**: Using localStorage instead of Firebase Auth

## Key Changes

### 1. Backend Architecture

**Before:**
- Firestore for data storage
- Firebase Cloud Functions for server logic
- Firebase Authentication for user management

**After:**
- Next.js API Routes for server logic
- JSON files for data persistence (in the `/data` directory)
- Simple UUID-based authentication with localStorage

### 2. API Endpoints

Created new API routes in `src/pages/api/`:

- **/api/terms**: Get terms by category
- **/api/terms/custom**: Get custom terms with related terms
- **/api/games**: Create and manage game sessions
- **/api/highscores**: Update player high scores
- **/api/leaderboard**: Get leaderboard data by category
- **/api/image**: Generate images for search terms
- **/api/import-csv**: Import terms from CSV data

### 3. Data Structure

Created a data directory with JSON files:

- **terms.json**: Search terms with volumes and categories
- **games.json**: Active and past game sessions
- **players.json**: Player data including high scores
- **leaderboard.json**: Global leaderboard data

### 4. Authentication

Replaced Firebase Authentication with a simpler client-side approach:

- Generate and store UUIDs in localStorage
- Maintain backward compatibility with existing components

### 5. Game Logic

Updated the game logic to:

- Use API routes instead of Firestore operations
- Implement better state management with SWR principles
- Maintain client-side resilience for offline/disconnected play

### 6. Service Class

Created a new service class in `src/lib/trendGuesserService.ts` that:

- Abstracts API calls behind a consistent interface
- Maintains the same method signatures as the original Firebase service
- Handles fallback to local data when API calls fail

### 7. Deployment

Updated deployment process:

- Added `vercel.json` configuration
- Created data migration script
- Added deployment script that handles data migration

## Migration Benefits

1. **Simplified Architecture**: Fewer moving parts and dependencies
2. **Better Performance**: Faster API responses without Firestore overhead
3. **Easier Deployment**: Single platform (Vercel) for hosting and serverless functions
4. **Cost Efficiency**: Vercel's free tier is generous for this use case
5. **Local Development**: Easier to run and test locally without emulators

## Migration Challenges

1. **Data Migration**: Had to parse CSV data and create JSON structure
2. **Authentication**: Ensuring backward compatibility with Firebase Auth
3. **State Management**: Ensuring game state remains consistent across API calls
4. **Offline Support**: Maintaining ability to play when API calls fail

## Phase 2: Migration to Neon PostgreSQL

After successfully migrating from Firebase to file-based JSON storage with Next.js API routes, we identified a key limitation: file-based storage doesn't work well in serverless environments. We've now migrated to Neon PostgreSQL for proper data persistence.

### 1. Why Neon PostgreSQL?

Neon provides a serverless PostgreSQL database that is:
- Fully managed and auto-scaling
- Perfect for serverless deployments on Vercel
- Offers a generous free tier
- Provides a familiar SQL interface
- Has robust data persistence (unlike file-based storage which doesn't work in serverless environments)

### 2. Database Schema

The migration creates the following tables:

1. `terms` - Stores search terms and their volumes
   - `id`: Text (Primary Key)
   - `term`: Text
   - `volume`: Integer
   - `category`: Text
   - `imageUrl`: Text (nullable)
   - `timestamp`: Timestamp

2. `games` - Stores game sessions
   - `id`: Text (Primary Key)
   - `createdAt`: Timestamp
   - `createdBy`: Text
   - `gameType`: Text
   - `status`: Text
   - `gameState`: JSONB

3. `players` - Stores player data
   - `uid`: Text (Primary Key)
   - `name`: Text
   - `score`: Integer
   - `highScores`: JSONB

4. `leaderboard` - Stores leaderboard entries
   - `id`: Text (Primary Key)
   - `playerUid`: Text
   - `playerName`: Text
   - `category`: Text
   - `score`: Integer
   - `timestamp`: Timestamp

### 3. Database Initialization

Added an API route (`/api/db-init`) that:
- Creates the necessary database tables if they don't exist
- Imports sample data into the terms table if it's empty
- Is secured with an API key
- Runs automatically via a Vercel cron job

### 4. Fallback Mechanism

When the database connection is not available (e.g., in development without a Neon database), the system will:
- Use sample data from `mockData.ts` 
- Log warnings but continue to function
- Allow the application to work properly in development environments

### 5. Environment Variables

Added support for the following environment variables:
- `NEON_DATABASE_URL`: The connection string for the Neon PostgreSQL database
- `DB_INIT_API_KEY`: A secret key to protect the database initialization API

## Future Improvements

1. **Authentication**: Add support for sign-in with social providers
2. **API Caching**: Implement more sophisticated caching strategies 
3. **Rate Limiting**: Add protection against abuse
4. **Analytics**: Integrate Vercel Analytics more deeply
5. **Database Indexing**: Add proper indexes for performance optimization

## Migration Verification

The migration maintains all key functionality of the original app:

- Game mechanics (higher/lower guessing)
- Category selection
- Custom terms
- High score tracking
- Leaderboards
- Mobile responsiveness