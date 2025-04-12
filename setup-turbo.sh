#!/bin/bash

# Create web directory for Next.js application
mkdir -p web

# Move Next.js app files to web directory
echo "Moving Next.js files to web directory..."
find . -maxdepth 1 -type f -not -name "setup-turbo.sh" -not -name "package.json" -not -name "pnpm-workspace.yaml" -not -name "turbo.json" -not -name "*.lock" -not -name "firebase.*" -not -path "*/\.*" -exec mv {} web/ \;

# Create package.json for the web directory
echo "Creating package.json for web directory..."
cat > web/package.json << 'EOL'
{
  "name": "web",
  "description": "TrendGuesser Next.js web application",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "clean": "rm -rf .next"
  },
  "dependencies": {
    "@headlessui/react": "^2.2.0",
    "@heroicons/react": "^2.2.0",
    "@vercel/analytics": "^1.5.0",
    "autoprefixer": "^10.4.21",
    "deck-of-cards": "^0.1.8",
    "firebase": "^11.6.0",
    "framer-motion": "^12.6.3",
    "next": "15.2.4",
    "postcss": "^8.5.3",
    "react": "^19.0.0",
    "react-cookie-consent": "^9.0.0",
    "react-dom": "^19.0.0",
    "react-firebase-hooks": "^5.1.1",
    "seedrandom": "^3.0.5",
    "tailwindcss": "^4.1.1",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@next/bundle-analyzer": "^15.2.4",
    "@tailwindcss/postcss": "^4.1.1",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.2.4",
    "postcss-import": "^16.1.0",
    "tailwindcss": "^4.1.1",
    "typescript": "^5"
  }
}
EOL

# Create a new root package.json for the monorepo
echo "Creating new root package.json..."
cat > package.json.new << 'EOL'
{
  "name": "trendguesser-monorepo",
  "description": "Monorepo for TrendGuesser app and Firebase functions",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "web",
    "functions",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^1.10.16"
  }
}
EOL

# Replace the root package.json
mv package.json.new package.json

echo "Setup complete! Now run:"
echo "npm install"
echo "npm run dev"