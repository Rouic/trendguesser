#!/bin/bash

# Colors for console output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create a trap to catch Ctrl+C and kill all background processes
trap 'kill $(jobs -p) 2>/dev/null' EXIT

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}Firebase CLI not found. Installing globally...${NC}"
    npm install -g firebase-tools
fi

# Start Firebase emulators
echo -e "${GREEN}Starting Firebase emulators...${NC}"
firebase emulators:start --only auth,firestore --project trendguesser-332d4 &
EMULATOR_PID=$!

# Wait for emulators to start
echo -e "${YELLOW}Waiting for emulators to start...${NC}"
sleep 5

# Check if the setup file exists and needs to be run
if [ ! -d "./emulator-data" ]; then
    echo -e "${YELLOW}First time setup: Populating emulators with sample data...${NC}"
    npm run emulators:setup || echo -e "${YELLOW}Warning: Failed to setup emulator data.${NC}"
fi

# Start Next.js dev server
echo -e "${GREEN}Starting Next.js dev server...${NC}"
next dev

# If we get here, kill the emulators
echo -e "${YELLOW}Stopping Firebase emulators...${NC}"
kill $EMULATOR_PID 2>/dev/null