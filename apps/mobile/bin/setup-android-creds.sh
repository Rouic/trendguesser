#!/bin/bash
# Script to simplify setting up Android credentials for EAS builds

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE} TrendGuesser Android Credentials Setup ${NC}"
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

# Prompt to set up credentials
echo -e "${YELLOW}Do you want to set up Android credentials now? (y/n)${NC}"
read SETUP_CREDS

if [ "$SETUP_CREDS" != "y" ]; then
    echo -e "${BLUE}You can set up credentials later using:${NC}"
    echo -e "${GREEN}eas credentials${NC}"
    exit 0
fi

# Create keystore directory if it doesn't exist
KEYSTORE_DIR="../android/keystores"
mkdir -p $KEYSTORE_DIR

# Generate or use existing keystore
echo -e "${YELLOW}Do you already have a keystore file for this app? (y/n)${NC}"
read HAS_KEYSTORE

if [ "$HAS_KEYSTORE" == "y" ]; then
    echo -e "${YELLOW}Please place your keystore file in $KEYSTORE_DIR and enter the filename:${NC}"
    read KEYSTORE_FILENAME
    KEYSTORE_PATH="$KEYSTORE_DIR/$KEYSTORE_FILENAME"
    
    if [ ! -f "$KEYSTORE_PATH" ]; then
        echo -e "${RED}Keystore file not found at $KEYSTORE_PATH${NC}"
        exit 1
    fi
else
    KEYSTORE_FILENAME="trendguesser.keystore"
    KEYSTORE_PATH="$KEYSTORE_DIR/$KEYSTORE_FILENAME"
    
    echo -e "${YELLOW}Generating new keystore file...${NC}"
    echo -e "${YELLOW}Please provide the following information:${NC}"
    
    echo -e "${YELLOW}Keystore password (minimum 6 characters):${NC}"
    read KEYSTORE_PASSWORD
    
    echo -e "${YELLOW}Key alias (e.g., trendguesser):${NC}"
    read KEY_ALIAS
    
    echo -e "${YELLOW}Key password (minimum 6 characters, can be same as keystore password):${NC}"
    read KEY_PASSWORD
    
    echo -e "${YELLOW}Organization name (e.g., Your Company):${NC}"
    read ORG_NAME
    
    echo -e "${YELLOW}Organizational unit (e.g., Mobile):${NC}"
    read ORG_UNIT
    
    echo -e "${YELLOW}City:${NC}"
    read CITY
    
    echo -e "${YELLOW}State/Province:${NC}"
    read STATE
    
    echo -e "${YELLOW}Country code (e.g., US):${NC}"
    read COUNTRY
    
    # Generate the keystore
    keytool -genkeypair -v -keystore "$KEYSTORE_PATH" -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
        -storepass "$KEYSTORE_PASSWORD" -keypass "$KEY_PASSWORD" \
        -dname "CN=$ORG_NAME, OU=$ORG_UNIT, O=$ORG_NAME, L=$CITY, ST=$STATE, C=$COUNTRY"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to generate keystore.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Keystore generated at $KEYSTORE_PATH${NC}"
    
    # Create credentials config for EAS
    echo -e "${YELLOW}Setting up EAS credentials config...${NC}"
    
    # Path for Google service account JSON
    echo -e "${YELLOW}Do you have a Google Play service account JSON file? (y/n)${NC}"
    read HAS_SERVICE_ACCOUNT
    
    SERVICE_ACCOUNT_PATH="path/to/service-account.json"
    if [ "$HAS_SERVICE_ACCOUNT" == "y" ]; then
        echo -e "${YELLOW}Please place your service account JSON file in $KEYSTORE_DIR and enter the filename:${NC}"
        read SERVICE_ACCOUNT_FILENAME
        SERVICE_ACCOUNT_PATH="android/keystores/$SERVICE_ACCOUNT_FILENAME"
        
        # Update eas.json with the new path
        sed -i '' "s|path/to/service-account.json|$SERVICE_ACCOUNT_PATH|g" ../eas.json
    fi
fi

echo -e "${GREEN}Android credential setup completed.${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. ${BLUE}Run 'eas credentials' to manage other credentials${NC}"
echo -e "2. ${BLUE}Run 'npm run build:dev:android' to create a development build${NC}"
echo -e "3. ${BLUE}Run 'npm run build:preview:android' to create a preview build${NC}"
echo -e "4. ${BLUE}Run 'npm run build:android' to create a production build${NC}"

exit 0