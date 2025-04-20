# 🎮 TrendGuesser

Welcome to **TrendGuesser** – the ultimate higher/lower guessing game where you predict which trending search term has the higher search volume! 🚀 Whether you're a casual player or a tech aficionado, get ready to have fun, challenge your intuition, and climb the leaderboards!

![TrendGuesser Screenshot](/public/images/social-cover.png) 

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [API Routes](#api-routes)
- [Mobile Apps](#mobile-apps)
- [Deployment](#deployment)
- [License & Acknowledgements](#license--acknowledgements)

---

## Overview

**TrendGuesser** is a fun and engaging game that challenges players to guess whether a hidden search term has a higher or lower search volume compared to a revealed term. With a visually appealing and mobile-friendly design inspired by Balatro, this game offers quick play sessions, customizable challenges, and competitive score-tracking across various categories.

---

## Features

- **Game Mechanics** 🎲:
  - Start with one revealed term displaying its search volume.
  - Guess whether a hidden term has a *higher* or *lower* search volume.
  - On a correct guess: the hidden term becomes the new known term and a new challenge term is presented.
  - On an incorrect guess: the game ends, and your score (the count of consecutive correct guesses) is recorded.

- **Categories & Customization** 🎯:
  - Choose from predefined categories like animals, celebrities, technology, games, and more!
  - Play in *custom mode* by entering your own search term.
  - Track high scores for each category per player.

- **Sleek UI/UX** 💫:
  - Balatro-inspired neon design with a card-based UI.
  - Fully responsive layout – play comfortably on any device.
  - Dynamic backgrounds with royalty-free images for each term.

- **Backend & Data** 🚀:
  - **Next.js API Routes**: Serverless functions for game data and leaderboard.
  - **Neon PostgreSQL**: Serverless PostgreSQL database for production data storage.
  - **SWR Integration**: Fast, efficient data fetching with stale-while-revalidate strategy.
  - **Fallback Mechanism**: Development mode uses mock data when no database is configured.
  - Note: Search volume data is simulated.

- **Cross-Platform Support** 📱:
  - **Web**: Play in any modern browser.
  - **iOS**: Native iPhone and iPad app.
  - **Android**: Native Android app.
  - **macOS**: Native Mac desktop app.
  - **Apple TV**: tvOS app for big screen gaming.

---

## Project Structure

The project is structured as a monorepo with shared code across platforms:

- **`apps/web/`**  
  Next.js web application.

- **`apps/mobile/`**  
  React Native mobile application using Expo.

- **`packages/shared/`**  
  Shared TypeScript code used by both web and mobile apps.

- **`data/`**  
  JSON files for data persistence.

---

## Getting Started

### Prerequisites

- **Node.js**: v18+
- **npm** or **yarn**
- **Expo Go app** (for mobile development)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/trendguesser.git
   cd trendguesser
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the web development server
   ```bash
   npm run dev
   ```
   
   This will create a default `.env.local` file if one doesn't exist and start the development server with mock data.

4. (Optional) Set up a database for development
   ```bash
   npm run db:setup
   ```
   
   This script will:
   - Create a `.env.local` file if it doesn't exist
   - Ask for your Neon PostgreSQL connection string
   - Generate a secure API key for database operations
   - Test the database connection
   - Initialize the database schema

---

## Development

### Available Scripts

- **dev**: Run the web development server with environment setup
  ```bash
  npm run dev
  ```

- **dev:plain**: Run the Next.js dev server directly
  ```bash
  npm run dev:plain
  ```

- **build**: Build the web project for production
  ```bash
  npm run build
  ```

- **start**: Start the web production server
  ```bash
  npm run start
  ```

- **lint**: Run ESLint to check code quality
  ```bash
  npm run lint
  ```

- **deploy**: Deploy to Vercel with Neon PostgreSQL setup
  ```bash
  npm run deploy
  ```

- **db:setup**: Interactive database setup wizard
  ```bash
  npm run db:setup
  ```

- **db:check**: Test database connection and schema
  ```bash
  npm run db:check
  ```

- **db:init**: Initialize database schema (requires NEON_DATABASE_URL)
  ```bash
  npm run db:init
  ```

- **clean**: Clean build artifacts and dependencies
  ```bash
  npm run clean
  ```

- **expo:start**: Start the Expo development server for mobile apps
  ```bash
  npm run expo:start
  ```

- **expo:ios**: Start iOS simulator
  ```bash
  npm run expo:ios
  ```

- **expo:android**: Start Android emulator
  ```bash
  npm run expo:android
  ```

- **expo:web**: Start web version of Expo app
  ```bash
  npm run expo:web
  ```

- **prebuild**: Generate native projects for iOS/Android
  ```bash
  npm run prebuild
  ```

- **build:ios**: Build iOS app
  ```bash
  npm run build:ios
  ```

- **build:android**: Build Android app
  ```bash
  npm run build:android
  ```

### Data Structure

TrendGuesser stores its data in a Neon PostgreSQL database with the following schema:

- **terms**: Search terms with volumes and categories
- **games**: Active and past game sessions
- **players**: Player data including high scores
- **leaderboard**: Global leaderboard data

The database is automatically seeded from the project's seed data located in:
- `data/seed/terms.json` (preferred) - Generated automatically from the CSV file
- `data/seed/data.csv` - Original CSV data source

For local development without a database connection, the application falls back to mock data.

---

## API Routes

TrendGuesser uses Next.js API routes for server functionality:

- **/api/terms**: Get terms by category
- **/api/terms/custom**: Get custom terms with related terms
- **/api/games**: Create and manage game sessions
- **/api/games/[id]**: Manage specific game by ID
- **/api/highscores**: Update player high scores
- **/api/leaderboard**: Get leaderboard data by category
- **/api/image**: Generate images for search terms
- **/api/import-csv**: Import terms from CSV data
- **/api/db-init**: Initialize database schema (protected by API key)

---

## Mobile Apps

TrendGuesser is available as native mobile apps for iOS and Android, as well as macOS, iPad, and Apple TV.

### Mobile Development

1. Start the Expo development server:
   ```bash
   npm run expo:start
   ```

2. Run on iOS simulator:
   ```bash
   npm run expo:ios
   ```

3. Run on Android emulator:
   ```bash
   npm run expo:android
   ```

4. Run in web browser:
   ```bash
   npm run expo:web
   ```

### Building Mobile Apps

1. Generate native projects:
   ```bash
   npm run prebuild
   ```

2. Build for iOS:
   ```bash
   npm run build:ios        # Production build
   npm run build:preview:ios # Preview build
   npm run build:dev:ios    # Development build
   ```

3. Build for Android:
   ```bash
   npm run build:android        # Production build
   npm run build:preview:android # Preview build
   npm run build:dev:android    # Development build
   ```

### Architecture

The mobile apps use:
- **React Native**: Core framework
- **Expo**: Development platform and build tools
- **Shared Code**: Core game logic shared with web version
- **AsyncStorage**: Local storage for offline capabilities
- **React Navigation**: Navigation between screens

---

## Deployment

### Vercel Deployment (Web)

The web project is configured for deployment on Vercel with Neon PostgreSQL:

```bash
npm run deploy
```

This script guides you through:
1. Setting up your Neon PostgreSQL database connection
2. Configuring environment variables
3. Deploying to Vercel
4. Initializing the database schema

### Mobile App Deployment

The mobile apps can be deployed to app stores using EAS (Expo Application Services):

```bash
npm run build:ios    # Build iOS app for App Store
npm run build:android # Build Android app for Google Play
```

### Environment Variables

The project uses the following environment variables:

#### Required for Production
- `NEON_DATABASE_URL`: Neon PostgreSQL connection string
- `DB_INIT_API_KEY`: Secret key to protect the database initialization API

#### Optional
- `API_TIMEOUT`: Custom timeout for API routes (in milliseconds)
- `NEXT_PUBLIC_APP_URL`: Your application's public URL
- `DEBUG`: Set to "true" to enable verbose logging

### Database Setup

1. Create a free account at [Neon](https://neon.tech)
2. Create a new project and database
3. Get your connection string from the dashboard
4. Use it during deployment or add it to your .env.local file for development

For local development, sample data is used when no database connection is available.

---

## License & Acknowledgements

- Images are generated via placeholder services for demonstration purposes.
- Game data is simulated and does not reflect actual search volumes.
- Inspired by higher/lower style games and Balatro's aesthetic.

## Mobile Development Details

For detailed information about the mobile apps:

- [Mobile Development Guide](./docs/MOBILE_DEV.md) - Guide for mobile app development
- [Mobile Build Guide](./docs/MOBILE_BUILD.md) - Instructions for building and publishing mobile apps

## License
MIT