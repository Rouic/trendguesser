#!/bin/bash

# Colors for console output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== TrendGuesser Development Server =====${NC}"

# Check if .env.local file exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}No .env.local file found. Creating with local development settings...${NC}"
    cat <<EOT > .env.local
# TrendGuesser Local Development Environment Variables

# Neon PostgreSQL Database
# To use a real database during development, uncomment and fill these
# NEON_DATABASE_URL=postgres://user:password@hostname/database
# DB_INIT_API_KEY=local_dev_key

# When database connection is not provided, mock data will be used

# Pexels API for images 
# Get a free API key from https://www.pexels.com/api/
# PEXELS_API_KEY=your_pexels_api_key

# Without a Pexels API key, placeholder images will be used

# API Configuration
# Uncomment to increase the timeout for API routes (in milliseconds)
# API_TIMEOUT=30000

# Debugging
# Uncomment to enable verbose logging
# DEBUG=true

# Application Settings
NEXT_PUBLIC_APP_NAME=TrendGuesser
NEXT_PUBLIC_APP_DESCRIPTION="A game where you guess the trend of search terms over time"
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Development Mode
NODE_ENV=development
EOT
    echo -e "${GREEN}.env.local file created. Edit it to add your database connection if needed.${NC}"
fi

# Check if database is configured
if grep -q "^NEON_DATABASE_URL=" .env.local; then
    echo -e "${GREEN}Found database configuration in .env.local${NC}"
    echo -e "${BLUE}Initializing database schema...${NC}"
    
    # Initialize the database before starting the server
    npm run db:init
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Database schema initialized successfully!${NC}"
    else
        echo -e "${YELLOW}Database initialization failed. Will fall back to mock data.${NC}"
    fi
else
    echo -e "${YELLOW}No database configured. The app will use mock data for development.${NC}"
    echo -e "${YELLOW}To use a real database, edit .env.local and add your Neon PostgreSQL connection.${NC}"
fi

# Start Next.js dev server
echo -e "${GREEN}Starting Next.js dev server...${NC}"
echo -e "${BLUE}Web server starting at http://localhost:3000${NC}"

next dev