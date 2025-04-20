#!/bin/bash
set -e

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== TrendGuesser Deployment Script =====${NC}"
echo -e "${BLUE}This script helps deploy TrendGuesser to Vercel with Neon PostgreSQL${NC}"
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Vercel CLI is not installed.${NC}"
    echo -e "Please install it using: ${YELLOW}npm install -g vercel${NC}"
    exit 1
fi

# Verify the project is ready for deployment
echo -e "${BLUE}Checking project...${NC}"

# Check for required files
if [ ! -f "vercel.json" ]; then
    echo -e "${RED}vercel.json not found. Make sure you're in the project root directory.${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}package.json not found. Make sure you're in the project root directory.${NC}"
    exit 1
fi

# Make sure seed data is processed
echo -e "${BLUE}Converting CSV data to JSON for seeding...${NC}"
npm run convert-csv

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Warning: Could not convert CSV data. Will use sample data instead.${NC}"
fi

# Run build to verify everything compiles
echo -e "${BLUE}Building project to verify it compiles...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed. Please fix the errors before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}Project looks good!${NC}"
echo ""

# Setup environment variables
echo -e "${BLUE}Setting up environment variables...${NC}"
echo -e "${YELLOW}You'll need to provide your Neon PostgreSQL connection string.${NC}"
echo -e "${YELLOW}Get this from the Neon dashboard (it starts with postgres://)${NC}"
echo ""

# Ask for Neon connection string
read -p "Enter your Neon PostgreSQL connection string (postgres://...): " NEON_DB_URL

if [[ ! $NEON_DB_URL == postgres://* ]]; then
    echo -e "${RED}That doesn't look like a valid Neon connection string.${NC}"
    echo -e "${YELLOW}It should start with postgres://. Please check and try again.${NC}"
    exit 1
fi

# Generate a random API key for DB initialization
DB_INIT_KEY=$(openssl rand -hex 16)

echo -e "${GREEN}Generated a random API key for database initialization: ${DB_INIT_KEY}${NC}"
echo ""

# Confirm deployment
echo -e "${BLUE}Ready to deploy to Vercel!${NC}"
echo -e "${YELLOW}This will create a new deployment with the following settings:${NC}"
echo -e "${YELLOW}- Neon PostgreSQL for database${NC}"
echo -e "${YELLOW}- Vercel for hosting and API routes${NC}"
echo -e "${YELLOW}- Automatic database initialization${NC}"
echo ""

read -p "Proceed with deployment? (y/n): " CONFIRM_DEPLOY

if [[ $CONFIRM_DEPLOY != "y" && $CONFIRM_DEPLOY != "Y" ]]; then
    echo -e "${RED}Deployment cancelled.${NC}"
    exit 0
fi

# Gather additional environment variables
echo -e "${BLUE}Setting up additional environment variables...${NC}"
echo -e "${YELLOW}Please enter your application URL (e.g., https://trendguesser.vercel.app):${NC}"
read -p "Production URL: " APP_URL

if [[ -z "$APP_URL" ]]; then
    APP_URL="https://trendguesser.vercel.app"
    echo -e "${YELLOW}Using default URL: ${APP_URL}${NC}"
fi

# Pexels API key for images
echo -e "${YELLOW}Do you have a Pexels API key for high-quality images? (https://www.pexels.com/api/)${NC}"
read -p "Pexels API key (press Enter to skip): " PEXELS_API_KEY

if [[ -z "$PEXELS_API_KEY" ]]; then
    echo -e "${YELLOW}No Pexels API key provided. Placeholder images will be used.${NC}"
else
    echo -e "${GREEN}Pexels API key configured. High-quality images will be used.${NC}"
fi

# Optional: Ask for API timeout
echo -e "${YELLOW}Do you want to set a custom API timeout? (default is 30000ms)${NC}"
read -p "API timeout in ms (press Enter for default): " API_TIMEOUT

# Deploy to Vercel with environment variables
echo -e "${BLUE}Deploying to Vercel...${NC}"
vercel deploy --prod \
  --env NEON_DATABASE_URL="$NEON_DB_URL" \
  --env DB_INIT_API_KEY="$DB_INIT_KEY" \
  --env NEXT_PUBLIC_APP_NAME="TrendGuesser" \
  --env NEXT_PUBLIC_APP_DESCRIPTION="A game where you guess the trend of search terms over time" \
  --env NEXT_PUBLIC_APP_URL="$APP_URL" \
  ${PEXELS_API_KEY:+--env PEXELS_API_KEY="$PEXELS_API_KEY"} \
  ${API_TIMEOUT:+--env API_TIMEOUT="$API_TIMEOUT"}

if [ $? -ne 0 ]; then
    echo -e "${RED}Deployment failed. Please check the error message above.${NC}"
    exit 1
fi

echo -e "${GREEN}Deployment successful!${NC}"
echo ""

# Get the deployment URL
DEPLOYMENT_URL=$(vercel --prod)

echo -e "${BLUE}Initializing database schema...${NC}"
echo -e "${YELLOW}This may take a moment...${NC}"

# Wait a bit for the deployment to propagate
sleep 10

# Initialize the database
curl -X POST "${DEPLOYMENT_URL}/api/db-init" \
  -H "x-api-key: $DB_INIT_KEY" \
  -H "Content-Type: application/json"

if [ $? -ne 0 ]; then
    echo -e "${RED}Database initialization failed. Please try manually:${NC}"
    echo -e "${YELLOW}curl -X POST \"${DEPLOYMENT_URL}/api/db-init\" -H \"x-api-key: ${DB_INIT_KEY}\" -H \"Content-Type: application/json\"${NC}"
else
    echo -e "${GREEN}Database initialized successfully!${NC}"
fi

echo ""
echo -e "${GREEN}===== Deployment Complete! =====${NC}"
echo -e "${BLUE}Your TrendGuesser app is now live at: ${YELLOW}${DEPLOYMENT_URL}${NC}"
echo -e "${BLUE}Keep your DB_INIT_API_KEY secure: ${YELLOW}${DB_INIT_KEY}${NC}"
echo ""
echo -e "${BLUE}Important Notes:${NC}"
echo -e "${YELLOW}- The database is initialized with sample terms${NC}"
echo -e "${YELLOW}- The first request might be slow (cold start)${NC}"
echo -e "${YELLOW}- You can import custom CSV data through the API${NC}"
echo ""
echo -e "${GREEN}Enjoy your TrendGuesser app running on Vercel with Neon PostgreSQL!${NC}"