// Add TypeScript interface for window object to include our custom flags
interface Window {
  __USING_FIREBASE_EMULATOR?: boolean;
}