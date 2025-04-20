#!/bin/bash
# Script to simplify setting up Apple credentials for EAS builds

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE} TrendGuesser iOS Credentials Setup ${NC}"
echo -e "${BLUE}================================================${NC}"

# Check if eas-cli is installed
if ! command -v eas &> /dev/null; then
    echo -e "${RED}EAS CLI not found. Installing...${NC}"
    npm install -g eas-cli
fi

# Check if logged in to EAS
echo -e "${YELLOW}Checking EAS login status...${NC}"
EAS_USER=$(eas whoami 2>/dev/null)
if [ $? -ne 0 ]; then
    echo -e "${RED}Not logged in to EAS. Please login:${NC}"
    eas login
else
    echo -e "${GREEN}Logged in as: $EAS_USER${NC}"
fi

# Initialize project if needed
if [ ! -f ../app.json ]; then
    echo -e "${RED}app.json not found. This script must be run from the bin directory.${NC}"
    exit 1
fi

PROJECT_ID=$(cat ../app.json | grep -o '"projectId": "[^"]*"' | cut -d'"' -f4)
if [ "$PROJECT_ID" == "your-eas-project-id" ] || [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}Setting up EAS project...${NC}"
    cd .. && eas init
    cd bin
fi

# Prompt for Apple credentials details
echo -e "${YELLOW}Do you want to set up Apple credentials now? (y/n)${NC}"
read SETUP_CREDS

if [ "$SETUP_CREDS" != "y" ]; then
    echo -e "${BLUE}You can set up credentials later using:${NC}"
    echo -e "${GREEN}eas credentials${NC}"
    exit 0
fi

echo -e "${YELLOW}Please provide your Apple Team ID:${NC}"
read APPLE_TEAM_ID

echo -e "${YELLOW}Do you already have an App Store Connect App ID? (y/n)${NC}"
read HAS_ASC_ID

if [ "$HAS_ASC_ID" == "y" ]; then
    echo -e "${YELLOW}Please provide your App Store Connect App ID:${NC}"
    read ASC_APP_ID
    
    # Update eas.json with the provided values
    echo -e "${GREEN}Updating eas.json with your credentials...${NC}"
    sed -i '' "s/YOUR_APPLE_TEAM_ID/$APPLE_TEAM_ID/g" ../eas.json
    sed -i '' "s/YOUR_ASC_APP_ID/$ASC_APP_ID/g" ../eas.json
else
    echo -e "${BLUE}You'll need to create an App Store Connect App ID first.${NC}"
    echo -e "${BLUE}Visit https://appstoreconnect.apple.com/ to create one.${NC}"
    echo -e "${BLUE}Then run this script again.${NC}"
    
    # Update just the team ID
    echo -e "${GREEN}Updating eas.json with your Team ID...${NC}"
    sed -i '' "s/YOUR_APPLE_TEAM_ID/$APPLE_TEAM_ID/g" ../eas.json
fi

echo -e "${GREEN}Credential setup completed.${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. ${BLUE}Run 'eas credentials' to manage other credentials${NC}"
echo -e "2. ${BLUE}Run 'npm run build:dev:ios' to create a development build${NC}"
echo -e "3. ${BLUE}Run 'npm run build:preview:ios' to create a preview build${NC}"
echo -e "4. ${BLUE}Run 'npm run build:ios' to create a production build${NC}"

exit 0