# 🎮 TrendGuesser

A higher/lower guessing game based on trending search terms. Players guess whether a new term has higher or lower search volume than the previous term.

![TrendGuesser Screenshot](web/public/images/social-cover.png) 

## Project Structure

This project uses Turborepo to manage the monorepo containing:

- **web/**: Next.js application for the frontend
- **functions/**: Firebase Cloud Functions backend
- **packages/**: Shared packages (if needed)

## Features

- **Game Mechanics**: Guess if hidden search terms have higher or lower search volume than the revealed term
- **Categories**: Choose from various categories (animals, celebrities, technology, etc.) or create custom games
- **Score Tracking**: Keep track of high scores for each category
- **Mobile-Friendly**: Fully responsive design works on all devices
- **Leaderboards**: See top players by category

## Tech Stack

- **Frontend**: NextJS with TypeScript, TailwindCSS, Framer Motion
- **Backend**: Firebase (Authentication, Firestore, Functions)
- **Data**: Search volume data collected from trending searches
- **Styling**: Balatro-inspired design with neon colors and card-based UI

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/trendguesser.git
cd trendguesser
```

2. Run the Turbo setup script (first time only):
```bash
./setup-turbo.sh
```

3. Install dependencies:
```bash
npm install
```

4. Configure Firebase:
   - Create a Firebase project
   - Enable Authentication (Anonymous)
   - Set up Firestore
   - Configure Firebase Functions

5. Start all development servers at once:
```bash
npm run dev
```

This will start:
- Next.js at [http://localhost:3000](http://localhost:3000)
- Firebase Functions emulator at [http://localhost:5001](http://localhost:5001)
- Firestore emulator at [http://localhost:8080](http://localhost:8080)
- Firebase Auth emulator at [http://localhost:9099](http://localhost:9099)
- Firebase emulator UI at [http://localhost:4000](http://localhost:4000)

### Development

You can also run each service separately:

```bash
# Just the Next.js app
cd web && npm run dev

# Just the Firebase Functions
cd functions && npm run dev
```

## Firebase Functions

TrendGuesser uses Firebase Cloud Functions for:

1. **fetchSearchVolume**: Fetches search volume data for custom terms
2. **updateTrendingTerms**: Updates the database with fresh trending terms daily

## Deployment

Deploy to Vercel:

```bash
vercel
```

Deploy Firebase Functions:

```bash
cd functions
npm run deploy
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Search volume data is simulated but would typically come from services like Google Trends
- Images are sourced from Unsplash