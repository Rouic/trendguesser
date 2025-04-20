# TrendGuesser Mobile Development Guide

This guide provides comprehensive information for developing the TrendGuesser mobile app.

## Getting Started

1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

2. Start the development server:
   ```bash
   npm run expo:start
   ```

3. Run on specific platforms:
   - iOS: `npm run expo:ios`
   - Android: `npm run expo:android`
   - Web: `npm run expo:web`

## Project Structure

The TrendGuesser app uses a monorepo setup:

```
/apps/mobile/           # React Native mobile app
  ├── assets/           # App icons and splash screen
  ├── src/              # Source code
  │   ├── components/   # Mobile-specific UI components
  │   ├── contexts/     # Context providers and adapters
  │   ├── screens/      # App screens
  │   ├── services/     # Implementation of shared interfaces
  │   └── index.tsx     # App entry point
  ├── app.json          # Expo configuration
  └── eas.json          # EAS Build configuration

/apps/web/              # Next.js web app
  └── ...               # Web application code

/packages/shared/        # Shared code for all platforms
  ├── src/              
  │   ├── components/   # Platform-agnostic components
  │   ├── contexts/     # Shared context providers
  │   ├── lib/          # Core service interfaces and implementations
  │   ├── types/        # Shared TypeScript definitions
  │   └── utils/        # Utilities and helpers
  └── ...
```

## Key Mobile Technologies

- **React Native**: Core framework for building native apps
- **Expo**: Development platform and build tools
- **React Navigation**: For navigation between screens
- **NativeWind**: For styling with Tailwind-like syntax
- **AsyncStorage**: For persistent storage
- **Shared Code**: Core game logic from `/packages/shared/`

## Core Concepts

### Platform-Specific Implementations

The mobile app uses dependency injection to provide platform-specific implementations of interfaces defined in the shared package:

```typescript
// Implementation of IStorage interface for React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStorage } from '@trendguesser/shared';

export class MobileStorageService implements IStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from AsyncStorage:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in AsyncStorage:', error);
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from AsyncStorage:', error);
      throw error;
    }
  }
}
```

### Shared Context Pattern

We use the shared context with platform-specific providers:

```typescript
// In the mobile app:
import { GameProvider } from '@trendguesser/shared';
import { MobileStorageService } from '../services/MobileStorageService';

const storageService = new MobileStorageService();

export const GameContextProvider = ({ children }) => {
  const trendGuesserService = useTrendGuesserService();
  
  return (
    <GameProvider 
      trendGuesserService={trendGuesserService}
      storage={storageService}
    >
      {children}
    </GameProvider>
  );
};

// Re-export the hook for convenience
export { useGameContext } from '@trendguesser/shared';
```

### Flexible UI Components

Shared components use render props for platform-specific rendering:

```typescript
// Shared Component
export interface SearchTermCardProps {
  term: SearchTerm;
  isKnown: boolean;
  showVolume: boolean;
  renderContainer: (children: React.ReactNode) => React.ReactNode;
  renderText: (text: string, style: 'title' | 'subtitle' | 'volume') => React.ReactNode;
}

export const SearchTermCard: React.FC<SearchTermCardProps> = ({
  term,
  isKnown,
  showVolume,
  renderContainer,
  renderText,
}) => {
  return renderContainer(
    <>
      {renderText(term.term, 'title')}
      {renderText(isKnown ? 'is trending' : 'is trending higher or lower?', 'subtitle')}
      {isKnown && showVolume && renderText(`Volume: ${term.volume}`, 'volume')}
    </>
  );
};

// Mobile Implementation
const MobileSearchTermCard: React.FC<MobileSearchTermCardProps> = ({
  term,
  isKnown,
  showVolume = true,
}) => {
  return (
    <SearchTermCard
      term={term}
      isKnown={isKnown}
      showVolume={showVolume}
      renderContainer={(children) => (
        <View style={styles.card}>
          {children}
        </View>
      )}
      renderText={(text, style) => {
        switch (style) {
          case 'title':
            return <Text style={styles.titleText}>{text}</Text>;
          case 'subtitle':
            return <Text style={styles.subtitleText}>{text}</Text>;
          case 'volume':
            return <Text style={styles.volumeText}>{text}</Text>;
          default:
            return <Text>{text}</Text>;
        }
      }}
    />
  );
};
```

### Navigation

React Navigation handles screen navigation:

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <TrendGuesserServiceProvider>
        <GameContextProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Home">
              <Stack.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Game" 
                component={GameScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Leaderboard" 
                component={LeaderboardScreen} 
              />
              <Stack.Screen 
                name="About" 
                component={AboutScreen} 
              />
            </Stack.Navigator>
          </NavigationContainer>
        </GameContextProvider>
      </TrendGuesserServiceProvider>
    </SafeAreaProvider>
  );
}
```

### Styling with NativeWind

NativeWind uses the same Tailwind-like syntax across platforms:

```tsx
// Install NativeWind
// npm install nativewind
// npm install -D tailwindcss@4.1.1

// Setup tailwind.config.js in the mobile app directory
// Then use className instead of style props:

import { View, Text, TouchableOpacity } from 'react-native';

export function Button({ onPress, title }) {
  return (
    <TouchableOpacity 
      className="bg-blue-500 py-3 px-6 rounded-lg shadow-md"
      onPress={onPress}
    >
      <Text className="text-white font-bold text-center">
        {title}
      </Text>
    </TouchableOpacity>
  );
}
```

## Testing on Devices

### Using Expo Go

1. Install Expo Go on your device from the App Store or Google Play
2. Start the development server: `npm run expo:start`
3. Scan the QR code with your camera app (iOS) or Expo Go app (Android)
4. Use the testing menu (shake device or press Cmd+D in simulator) to reload or debug

### Using Development Builds

For testing features that require native modules:

1. Create a development build:
   ```bash
   npm run build:dev:ios
   # or
   npm run build:dev:android
   ```
2. Install the build:
   - iOS: Use TestFlight or install directly from EAS
   - Android: Install the APK file
3. Run the development server: `npm run expo:start`
4. The development build will connect to your development server automatically

### Testing with Simulators/Emulators

For quicker development iterations:

1. Start the iOS Simulator:
   ```bash
   npm run expo:ios
   ```

2. Start the Android Emulator:
   ```bash
   npm run expo:android
   ```

## Environment Variables

Environment variables can be configured in several ways:

1. In `eas.json` under the `env` section for each build profile
2. Using the `extra` field in `app.json`
3. Using `app.config.js` for dynamic configuration

Example in app.config.js:
```javascript
export default () => ({
  expo: {
    // ... other app.json properties
    extra: {
      apiUrl: process.env.API_URL || 'https://trendguesser.com',
      appEnv: process.env.APP_ENV || 'development',
      debug: process.env.DEBUG === 'true'
    }
  }
});
```

Access these variables in your code:
```javascript
import Constants from 'expo-constants';

const { apiUrl } = Constants.expoConfig.extra;
```

## Adding Custom Native Modules

When adding native modules:

1. Install the package:
   ```bash
   npm install package-name -w @trendguesser/mobile
   ```

2. Add it to the plugins array in `app.json` if required:
   ```json
   "plugins": [
     "package-name",
     ["other-package", { "option": "value" }]
   ]
   ```

3. Rebuild the development client:
   ```bash
   npm run build:dev:ios
   # or
   npm run build:dev:android
   ```

## Troubleshooting

1. **Metro bundler issues**:
   - Clear Metro cache: `npx expo start --clear`
   - Delete node_modules and reinstall: `rm -rf node_modules && npm install`

2. **Dependency conflicts**:
   - Ensure all React packages use compatible versions (currently React 18.2.0)
   - Use `npm why package-name` to debug dependency issues

3. **TypeScript errors**:
   - Check type definitions in shared packages for platform compatibility
   - Use conditional types for platform-specific behavior
   - Add missing types for third-party libraries

4. **Style inconsistencies**:
   - Remember that not all web CSS properties are supported in React Native
   - Use platform-specific styling when needed with `Platform.OS === 'ios'`
   - Test frequently on both platforms to catch styling issues early

5. **Blank screen issues**:
   - Check for runtime errors in the console/debugger
   - Verify all components have proper height/width (flex settings)
   - Ensure context providers are properly set up

6. **Update issues**:
   - EAS Update problems: check `updates` configuration in app.json
   - Clear Expo caches: `expo start --clear`