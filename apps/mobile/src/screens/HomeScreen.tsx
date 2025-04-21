import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SearchCategory } from "@trendguesser/shared";
import { useGameContext } from "../contexts/GameContextProvider";
import { getEnabledCategories } from "@trendguesser/shared";

// Get screen dimensions
const { width, height } = Dimensions.get("window");

export default function HomeScreen({ navigation }) {
  const { startGame, setPlayerName, playerName, loading } = useGameContext();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [customTerm, setCustomTerm] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [name, setName] = useState(playerName || "");
  const [highScores, setHighScores] = useState({});

  // Get enabled categories from the shared configuration
  const categoryConfigs = getEnabledCategories();

  // Load high scores from local storage
  useEffect(() => {
    const loadHighScores = async () => {
      try {
        if (typeof AsyncStorage !== "undefined") {
          const scoresData = await AsyncStorage.getItem("tg_highscores_player");
          if (scoresData) {
            setHighScores(JSON.parse(scoresData));
          }
        }
      } catch (e) {
        console.error("Error loading high scores:", e);
      }
    };

    loadHighScores();
  }, []);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    if (category === "custom") {
      setShowCustomInput(true);
    } else {
      setShowCustomInput(false);
    }
  };

  const handleUpdateName = () => {
    if (name.trim()) {
      setPlayerName(name.trim());
    }
  };

  const handleStartGame = async () => {
    if (loading) return;

    if (selectedCategory === "custom" && !customTerm.trim()) {
      alert("Please enter a custom search term to play.");
      return;
    }

    try {
      // Save name if changed
      if (name !== playerName) {
        handleUpdateName();
      }

      // Start the game with selected category
      await startGame(
        selectedCategory,
        selectedCategory === "custom" ? customTerm.trim() : undefined
      );

      // Navigate to game screen
      navigation.navigate("Game");
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Failed to start the game. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Background elements */}
      <View style={styles.background}>
        {/* Grid pattern */}
        <View style={styles.gridPattern} />

        {/* Glowing orb effect */}
        <View style={styles.glowOrb} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>TREND GUESSER</Text>
          <Text style={styles.subtitle}>
            The game where you guess the trend of search terms over time
          </Text>
        </View>

        <View style={styles.nameContainer}>
          <Text style={styles.sectionTitle}>Your Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="rgba(255,255,255,0.5)"
            onBlur={handleUpdateName}
          />
        </View>

        <View style={styles.categoryContainer}>
          <Text style={styles.sectionTitle}>Select Category</Text>
          <View style={styles.categoryGrid}>
            {categoryConfigs.map((category) => {
              const mobileStyles = category.mobileStyles;
              const hasHighScore = highScores[category.id] > 0;

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category.id && styles.selectedCategory,
                    selectedCategory === category.id && {
                      borderColor: mobileStyles.borderColor,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => handleCategorySelect(category.id)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category.id && {
                        fontWeight: "bold",
                        color: mobileStyles.textColor,
                      },
                    ]}
                  >
                    {category.name}
                  </Text>
                  <Text style={styles.categoryDescription}>
                    {category.description}
                  </Text>

                  {/* High score badge */}
                  {hasHighScore ? (
                    <View style={styles.highScoreBadge}>
                      <Text style={styles.highScoreText}>
                        High: {highScores[category.id]}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>New</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {showCustomInput && (
            <View style={styles.customTermContainer}>
              <TextInput
                style={styles.input}
                value={customTerm}
                onChangeText={setCustomTerm}
                placeholder="Enter your custom search term"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.playButton, loading && styles.disabledButton]}
          onPress={handleStartGame}
          disabled={loading}
        >
          <Text style={styles.playButtonText}>
            {loading ? "Starting..." : "Play Game"}
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryButtonsContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("Leaderboard")}
          >
            <Text style={styles.secondaryButtonText}>Leaderboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("About")}
          >
            <Text style={styles.secondaryButtonText}>About</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121218",
  },
  background: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  gridPattern: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  glowOrb: {
    position: "absolute",
    top: height * 0.1,
    left: width / 2 - 450,
    width: 900,
    height: 900,
    borderRadius: 450,
    backgroundColor: "rgba(252, 50, 151, 0.7)",
    opacity: 0.3,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#FFCC00", // Neon yellow color from web version
    marginBottom: 10,
    textShadowColor: "rgba(255, 204, 0, 0.7)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    fontFamily: "sans-serif-condensed", // Closest to Oswald on Android
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    fontFamily: "sans-serif",
  },
  nameContainer: {
    width: "100%",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
    padding: 15,
    width: "100%",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.5)",
    color: "white",
  },
  categoryContainer: {
    width: "100%",
    marginBottom: 20,
  },
  categoryGrid: {
    flexDirection: "column",
    justifyContent: "space-between",
  },
  categoryButton: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
    padding: 15,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(221, 221, 221, 0.1)",
    position: "relative",
  },
  selectedCategory: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  categoryText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
  categoryDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  highScoreBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  highScoreText: {
    color: "#FFCC00",
    fontSize: 12,
  },
  newBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  newBadgeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  customTermContainer: {
    marginTop: 10,
    width: "100%",
  },
  playButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.7,
  },
  playButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: "48%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(221, 221, 221, 0.1)",
  },
  secondaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
});
