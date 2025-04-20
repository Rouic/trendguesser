import React from 'react';
import "./polyfills";
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TrendGuesserServiceProvider } from './services/TrendGuesserServiceProvider';
import { GameContextProvider } from './contexts/GameContextProvider';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import AboutScreen from './screens/AboutScreen';

// Create navigation stack
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
                options={{ title: 'Leaderboard' }}
              />
              <Stack.Screen 
                name="About" 
                component={AboutScreen} 
                options={{ title: 'About' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
          <StatusBar style="auto" />
        </GameContextProvider>
      </TrendGuesserServiceProvider>
    </SafeAreaProvider>
  );
}