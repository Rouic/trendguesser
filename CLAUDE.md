# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm run dev` - Start Next.js development server with Firebase emulator
- `npm run dev:no-emulator` - Start Next.js without Firebase emulator
- `npm run build` - Build for production (web + functions)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint on web and functions code
- `npm run clean` - Clean build artifacts and dependencies
- `npm run emulators` - Start Firebase emulators only

## Code Style Guidelines
- **TypeScript**: Use TypeScript with explicit return types. `strictNullChecks` is disabled.
- **Imports**: Group imports by external libraries, then internal components/utils.
- **Components**: Use functional React components with hooks.
- **Naming**: PascalCase for components, camelCase for functions/variables, interfaces prefixed with 'I'.
- **Error Handling**: Use try/catch for async operations, especially Firebase interactions.
- **State Management**: Use contexts for shared state (AuthContext, GameContext, ConsentContext).
- **Styling**: Use TailwindCSS for styling with customized configuration.
- **Firebase**: Follow established patterns for Firestore interactions in `lib/firebase/`.
- **Path Aliases**: Use '@/' for src directory imports when available.