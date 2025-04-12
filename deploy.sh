#!/bin/bash
# Project deployment script for TrendGuesser

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}TrendGuesser Deployment Script${NC}"
echo "============================="

# First build the Next.js application
echo -e "${YELLOW}Building Next.js application...${NC}"
echo "Installing dependencies if needed..."
npm install
echo "Building Next.js app..."
npm run build:web
echo "Exporting static files to 'out' directory..."
npx next export
if [ $? -ne 0 ]; then
  echo "Next.js build failed! Aborting deployment."
  exit 1
fi
echo -e "${GREEN}Next.js application built successfully!${NC}"

# Then build the functions
echo -e "${YELLOW}Building Firebase Functions...${NC}"
cd functions
echo "Cleaning lib directory..."
rm -rf lib
echo "Installing dependencies if needed..."
npm install
echo "Compiling TypeScript..."
./node_modules/.bin/tsc
if [ $? -ne 0 ]; then
  echo "Functions build failed! Aborting deployment."
  exit 1
fi
cd ..
echo -e "${GREEN}Functions built successfully!${NC}"

# Now deploy everything
echo -e "${YELLOW}Deploying to Firebase...${NC}"
firebase deploy

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Deployment completed successfully!${NC}"
else
  echo "Deployment encountered errors. Please check the output above."
  exit 1
fi