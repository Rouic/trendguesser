#!/bin/bash
# Database setup script for TrendGuesser

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== TrendGuesser Database Setup =====${NC}"
echo "This script will help you set up your database configuration."

# Check if .env.local exists
ENV_FILE=".env.local"
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}Found existing $ENV_FILE file${NC}"
else
    echo -e "${YELLOW}No $ENV_FILE file found. Creating one...${NC}"
    cp .env.local.example $ENV_FILE
    echo -e "${GREEN}Created $ENV_FILE from example template${NC}"
fi

# Check if NEON_DATABASE_URL is already configured
if grep -q "^NEON_DATABASE_URL=" "$ENV_FILE"; then
    echo -e "${GREEN}Database URL already configured in $ENV_FILE${NC}"
    DB_URL=$(grep "^NEON_DATABASE_URL=" "$ENV_FILE" | cut -d= -f2-)
    
    # Remove quotes if present
    DB_URL="${DB_URL#\"}"
    DB_URL="${DB_URL%\"}"
    DB_URL="${DB_URL#\'}"
    DB_URL="${DB_URL%\'}"
    
    if [[ $DB_URL == postgres://* ]]; then
        echo -e "${GREEN}Database URL looks valid${NC}"
    else
        echo -e "${YELLOW}Warning: Database URL doesn't start with postgres://. It may not be valid.${NC}"
    fi
else
    echo -e "${YELLOW}No database URL configured yet.${NC}"
    echo "You need a PostgreSQL connection string from Neon or another Postgres provider."
    echo "It should look like: postgres://user:password@hostname/database"
    echo ""
    
    read -p "Enter your database connection string (postgres://...): " DB_URL
    
    if [[ $DB_URL == postgres://* ]]; then
        # Update the .env.local file with the new URL
        # First remove any commented version of the variable
        sed -i '' '/^#[[:space:]]*NEON_DATABASE_URL=/d' $ENV_FILE
        
        # Then add the new value
        echo "NEON_DATABASE_URL=\"$DB_URL\"" >> $ENV_FILE
        echo -e "${GREEN}Database URL added to $ENV_FILE${NC}"
    else
        echo -e "${RED}Invalid database URL. It must start with postgres://${NC}"
        echo "Please edit $ENV_FILE manually to add your database connection string."
    fi
fi

# Generate a DB init key if needed
if ! grep -q "^DB_INIT_API_KEY=" "$ENV_FILE"; then
    echo -e "${YELLOW}Generating a database initialization API key...${NC}"
    DB_INIT_KEY=$(openssl rand -hex 16)
    echo "DB_INIT_API_KEY=\"$DB_INIT_KEY\"" >> $ENV_FILE
    echo -e "${GREEN}API key added to $ENV_FILE${NC}"
fi

# Check Pexels API key
if ! grep -q "^PEXELS_API_KEY=" "$ENV_FILE"; then
    echo -e "${YELLOW}No Pexels API key found.${NC}"
    echo "A Pexels API key is recommended for high-quality images."
    echo "You can get one for free at https://www.pexels.com/api/"
    echo ""
    
    read -p "Do you have a Pexels API key? (y/n): " HAVE_PEXELS_KEY
    
    if [[ $HAVE_PEXELS_KEY == "y" || $HAVE_PEXELS_KEY == "Y" ]]; then
        read -p "Enter your Pexels API key: " PEXELS_KEY
        echo "PEXELS_API_KEY=\"$PEXELS_KEY\"" >> $ENV_FILE
        echo -e "${GREEN}Pexels API key added to $ENV_FILE${NC}"
    else
        echo -e "${YELLOW}No problem. Placeholder images will be used instead.${NC}"
    fi
fi

echo -e "${BLUE}\nTesting database connection...${NC}"
node src/scripts/check-db-connection.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}\nSetup complete! Your database is configured and working.${NC}"
    echo -e "${BLUE}You can now run:${NC}"
    echo -e "  ${YELLOW}npm run dev${NC}   - Start development server"
    echo -e "  ${YELLOW}npm run build${NC} - Build for production"
else
    echo -e "${RED}\nDatabase connection test failed.${NC}"
    echo -e "${YELLOW}Please check your connection string in $ENV_FILE${NC}"
    echo -e "${YELLOW}You can run 'npm run db:check' to test your connection again.${NC}"
fi