#!/bin/bash
# Helper script for building and deploying Firebase functions

# Clean the output directory
echo "Cleaning lib directory..."
rm -rf lib

# Run TypeScript compiler
echo "Compiling TypeScript..."
./node_modules/.bin/tsc

# Check if the build was successful
if [ $? -eq 0 ]; then
  echo "Build completed successfully!"
  #copy data.csv from functions/src to functions/lib
  echo "Copying data.csv to lib directory..."
  cp src/data.csv lib/data.csv
  echo "You can now run 'firebase deploy --only functions' from the project root"
else
  echo "Build failed. Please check the errors above."
  exit 1
fi