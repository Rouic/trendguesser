#!/bin/bash

# Start Firebase emulators
echo "Starting Firebase emulators..."
firebase emulators:start &
EMULATOR_PID=$!

# Wait for emulators to start
echo "Waiting for emulators to start..."
sleep 5

# Start Next.js dev server
echo "Starting Next.js dev server..."
npm run dev:web

# When Next.js is stopped, also stop the emulators
echo "Stopping Firebase emulators..."
kill $EMULATOR_PID