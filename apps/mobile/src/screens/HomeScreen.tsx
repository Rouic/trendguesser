import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SearchCategory } from "@trendguesser/shared";
import { useGameContext } from "../contexts/GameContextProvider";
// Import the shared category configuration
import { getEnabledCategories, getCategoryById } from "@trendguesser/shared";

type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  Leaderboard: undefined;
  About: undefined;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Home"
>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { startGame, setPlayerName, playerName, loading } = useGameContext();
  const [selectedCategory, setSelectedCategory] =
    useState<SearchCategory>("general");
  const [customTerm, setCustomTerm] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [name, setName] = useState(playerName);

  // Get enabled categories from the shared configuration
  const categoryConfigs = getEnabledCategories();

  const handleCategorySelect = (category: SearchCategory) => {
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
      Alert.alert("Enter a Term", "Please enter a custom search term to play.");
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
      Alert.alert("Error", "Failed to start the game. Please try again.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>TrendGuesser</Text>
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
            onBlur={handleUpdateName}
          />
        </View>

        <View style={styles.categoryContainer}>
          <Text style={styles.sectionTitle}>Select Category</Text>
          <View style={styles.categoryGrid}>
            {categoryConfigs.map((category) => {
              const mobileStyles = category.mobileStyles;

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    selectedCategory === category.id && styles.selectedCategory,
                    // Apply custom category styling if selected
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
                      // Apply custom text color if selected
                      selectedCategory === category.id && {
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {category.name}
                  </Text>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
  },
  nameContainer: {
    width: "100%",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    width: "100%",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  categoryContainer: {
    width: "100%",
    marginBottom: 20,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    width: "48%",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  selectedCategory: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  categoryText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
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
    color: "#fff",
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
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: "48%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  secondaryButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
});
