# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm run dev` - Start Next.js development server (creates .env.local if needed)
- `npm run dev:plain` - Start Next.js directly without setup script
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint on code
- `npm run clean` - Clean build artifacts and dependencies
- `npm run deploy` - Deploy to Vercel with Neon PostgreSQL setup
- `npm run db:init` - Initialize database schema (requires NEON_DATABASE_URL env var)
- `npm run expo:start` - Start Expo development server for mobile apps
- `npm run expo:ios` - Start iOS simulator
- `npm run expo:android` - Start Android emulator
- `npm run expo:web` - Start web version of Expo app
- `npm run prebuild` - Generate native projects for iOS/Android
- `npm run build:ios` - Build iOS app
- `npm run build:android` - Build Android app

## Architecture
- **Database**: Neon PostgreSQL for serverless storage
- **API Routes**: Next.js API routes for backend functionality
- **Authentication**: Client-side with localStorage/sessionStorage for user tracking
- **State Management**: SWR pattern for data fetching with contexts
- **Deployment**: Vercel for hosting and serverless functions
- **Mobile Apps**: Expo with React Native for cross-platform mobile development
- **Shared Code**: Code sharing between web and mobile apps through the shared package

## Code Style Guidelines
- **TypeScript**: Use TypeScript with explicit return types. `strictNullChecks` is disabled.
- **Imports**: Group imports by external libraries, then internal components/utils.
- **Components**: Use functional React components with hooks.
- **Naming**: PascalCase for components, camelCase for functions/variables, interfaces prefixed with 'I'.
- **Error Handling**: Use try/catch for async operations, especially database interactions.
- **State Management**: Use contexts for shared state (AuthContext, GameContext, ConsentContext).
- **Styling**: Use TailwindCSS for styling with customized configuration for web, NativeWind for React Native.
- **Database**: Follow established patterns for database interactions in `lib/db.ts`.
- **Path Aliases**: Use '@/' for src directory imports when available.