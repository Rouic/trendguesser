import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GameState } from "@trendguesser/shared";

const { width, height } = Dimensions.get("window");

interface MobileGameOverProps {
  gameState: GameState;
  onPlayAgain: () => void;
  onQuit: () => void;
}

const MobileGameOver: React.FC<MobileGameOverProps> = ({
  gameState,
  onPlayAgain,
  onQuit,
}) => {
  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Initial entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.back()),
      }),
    ]).start();

    // Continuous pulse animation for score
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.modalOverlay}>
      <LinearGradient
        colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.85)"]}
        style={styles.gradientOverlay}
      />

      <Animated.View
        style={[
          styles.modalContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.8)", "rgba(20,20,30,0.95)"]}
          style={styles.gradientContainer}
        >
          <Text style={styles.title}>GAME OVER!</Text>

          <View style={styles.divider} />

          <View style={styles.scoreContainer}>
            <Text style={styles.scoreLabel}>YOUR SCORE:</Text>
            <Animated.Text
              style={[styles.scoreValue, { transform: [{ scale: pulseAnim }] }]}
            >
              {gameState.score}
            </Animated.Text>
          </View>

          {gameState.highScore && (
            <View style={styles.highScoreContainer}>
              <Text style={styles.highScoreText}>NEW HIGH SCORE!</Text>
            </View>
          )}

          <View style={styles.resultsContainer}>
            <Text style={styles.resultsText}>
              The last term "{gameState.hiddenTerm?.term}" has a volume of{" "}
              {gameState.hiddenTerm?.volume.toLocaleString()}.
            </Text>

            <Text style={styles.comparisonText}>
              {gameState.knownTerm?.term}:{" "}
              {gameState.knownTerm?.volume.toLocaleString()}
            </Text>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.playAgainButton}
              onPress={onPlayAgain}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>PLAY AGAIN</Text>
              <LinearGradient
                colors={["rgba(59,130,246,0)", "rgba(59,130,246,0.3)"]}
                style={styles.buttonGlow}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quitButton}
              onPress={onQuit}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>QUIT</Text>
              <LinearGradient
                colors={["rgba(239,68,68,0)", "rgba(239,68,68,0.3)"]}
                style={styles.buttonGlow}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  modalContainer: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  gradientContainer: {
    padding: 24,
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FF3366", // Neon red
    marginBottom: 8,
    textAlign: "center",
    textShadowColor: "rgba(255,51,102,0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,51,102,0.5)",
    marginBottom: 20,
  },
  scoreContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 18,
    color: "#fff",
    marginBottom: 5,
  },
  scoreValue: {
    fontSize: 52,
    fontWeight: "bold",
    color: "#00FF99", // Neon green
    textShadowColor: "rgba(0,255,153,0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  highScoreContainer: {
    backgroundColor: "rgba(255,204,0,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,204,0,0.5)",
  },
  highScoreText: {
    color: "#FFCC00", // Neon yellow
    fontWeight: "bold",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultsContainer: {
    marginBottom: 30,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  resultsText: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  comparisonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#3b82f6", // Blue
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  playAgainButton: {
    backgroundColor: "rgba(59,130,246,0.2)", // Blue with transparency
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.5)",
    overflow: "hidden",
    position: "relative",
  },
  quitButton: {
    backgroundColor: "rgba(239,68,68,0.2)", // Red with transparency
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.5)",
    overflow: "hidden",
    position: "relative",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    zIndex: 1,
  },
  buttonGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
});

export default MobileGameOver;
