import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTrendGuesserService } from '../services/TrendGuesserServiceProvider';
import { useGameContext } from '../contexts/GameContextProvider';
import MobileSearchTermCard from '../components/MobileSearchTermCard';
import MobileGameOver from '../components/MobileGameOver';

type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  Leaderboard: undefined;
  About: undefined;
};

type GameScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Game'>;

export default function GameScreen() {
  const navigation = useNavigation<GameScreenNavigationProp>();
  const { gameState, loading, error, makeGuess, endGame, startGame } = useGameContext();
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGuessing, setIsGuessing] = useState(false);
  
  // Handle errors
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  // Update game over status when game state changes
  useEffect(() => {
    if (gameState?.finished) {
      setIsGameOver(true);
    } else {
      setIsGameOver(false);
    }
  }, [gameState]);
  
  const handleHigherPress = async () => {
    if (loading || isGuessing) return;
    
    setIsGuessing(true);
    const result = await makeGuess(true);
    setIsGuessing(false);
    
    if (!result) {
      setIsGameOver(true);
    }
  };
  
  const handleLowerPress = async () => {
    if (loading || isGuessing) return;
    
    setIsGuessing(true);
    const result = await makeGuess(false);
    setIsGuessing(false);
    
    if (!result) {
      setIsGameOver(true);
    }
  };
  
  const handleQuit = async () => {
    await endGame();
    navigation.navigate('Home');
  };
  
  const handlePlayAgain = async () => {
    // Start a new game with the same category
    if (gameState) {
      try {
        await startGame(gameState.category);
        setIsGameOver(false);
      } catch (error) {
        console.error('Error restarting game:', error);
        Alert.alert('Error', 'Failed to restart the game. Please try again from the home screen.');
        navigation.navigate('Home');
      }
    } else {
      navigation.replace('Game');
    }
  };
  
  // Handle case where game isn't initialized
  if (!gameState) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Game not initialized</Text>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading game...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.roundText}>Round {gameState.round}</Text>
        <Text style={styles.scoreText}>Score: {gameState.score}</Text>
      </View>
      
      <View style={styles.cardsContainer}>
        {gameState.knownTerm && (
          <MobileSearchTermCard 
            term={gameState.knownTerm} 
            isKnown={true} 
            showVolume={true}
          />
        )}
        
        <View style={styles.versusContainer}>
          <Text style={styles.versusText}>VS</Text>
        </View>
        
        {gameState.hiddenTerm && (
          <MobileSearchTermCard 
            term={gameState.hiddenTerm} 
            isKnown={false} 
            showVolume={false}
          />
        )}
      </View>
      
      <View style={styles.buttonsContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.higherButton, (loading || isGuessing) && styles.disabledButton]} 
          onPress={handleHigherPress}
          disabled={loading || isGuessing}
        >
          <Text style={styles.buttonText}>Higher</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.lowerButton, (loading || isGuessing) && styles.disabledButton]} 
          onPress={handleLowerPress}
          disabled={loading || isGuessing}
        >
          <Text style={styles.buttonText}>Lower</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={styles.quitTextButton} 
        onPress={handleQuit}
      >
        <Text style={styles.quitText}>Quit Game</Text>
      </TouchableOpacity>
      
      {/* Game Over Modal */}
      {isGameOver && gameState && (
        <MobileGameOver 
          gameState={gameState}
          onPlayAgain={handlePlayAgain}
          onQuit={handleQuit}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginTop: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  roundText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  versusContainer: {
    marginVertical: 5,
  },
  versusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  higherButton: {
    backgroundColor: '#4ade80',
  },
  lowerButton: {
    backgroundColor: '#f87171',
  },
  quitButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  quitTextButton: {
    alignItems: 'center',
    padding: 10,
  },
  quitText: {
    color: '#666',
    fontSize: 16,
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
});