import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { GameState } from '@trendguesser/shared';

interface MobileGameOverProps {
  gameState: GameState;
  onPlayAgain: () => void;
  onQuit: () => void;
}

const MobileGameOver: React.FC<MobileGameOverProps> = ({
  gameState,
  onPlayAgain,
  onQuit
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Game Over!</Text>
        
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Your Score:</Text>
          <Text style={styles.scoreValue}>{gameState.score}</Text>
        </View>
        
        {gameState.highScore && (
          <View style={styles.highScoreContainer}>
            <Text style={styles.highScoreText}>New High Score!</Text>
          </View>
        )}
        
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            The last term "{gameState.hiddenTerm.term}" has a 
            volume of {gameState.hiddenTerm.volume}.
          </Text>
          
          <Text style={styles.comparisonText}>
            {gameState.knownTerm.term}: {gameState.knownTerm.volume}
          </Text>
        </View>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.playAgainButton}
            onPress={onPlayAgain}
          >
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quitButton}
            onPress={onQuit}
          >
            <Text style={styles.buttonText}>Quit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 18,
    color: '#666',
    marginBottom: 5,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  highScoreContainer: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
  },
  highScoreText: {
    color: '#d97706',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultsContainer: {
    marginBottom: 30,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    width: '100%',
  },
  resultsText: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 10,
    textAlign: 'center',
  },
  comparisonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4b5563',
    textAlign: 'center',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  playAgainButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  quitButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default MobileGameOver;