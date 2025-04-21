import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SearchCategory } from "@trendguesser/shared";
import { useTrendGuesserService } from "../services/TrendGuesserServiceProvider";

const { width, height } = Dimensions.get("window");

export default function LeaderboardScreen({ navigation }) {
  const trendGuesserService = useTrendGuesserService();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("snacks");
  const [error, setError] = useState(null);

  // Animation values for list items
  const fadeInAnimations = React.useRef({}).current;

  // Categories for selection with corresponding colors
  const categories = [
    { id: "snacks", name: "Snacks", color: "#FFCC00" }, // Yellow
    { id: "technology", name: "Tech", color: "#3b82f6" }, // Blue
    { id: "sports", name: "Sports", color: "#4ade80" }, // Green
    { id: "landmarks", name: "Places", color: "#9932fc" }, // Purple
  ];

  // Fetch leaderboard data
  useEffect(() => {
    fetchLeaderboard();
  }, [category]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await trendGuesserService.getLeaderboard(category);
      setLeaderboard(data);

      // Reset and prepare animations for each item
      data.forEach((_, index) => {
        if (!fadeInAnimations[index]) {
          fadeInAnimations[index] = new Animated.Value(0);
        } else {
          fadeInAnimations[index].setValue(0);
        }
      });

      // Trigger animations sequentially
      data.forEach((_, index) => {
        Animated.timing(fadeInAnimations[index], {
          toValue: 1,
          duration: 300,
          delay: index * 100,
          useNativeDriver: true,
        }).start();
      });
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
  };

  const renderRankBadge = (rank) => {
    let badgeStyle, textStyle;

    if (rank === 1) {
      badgeStyle = styles.goldBadge;
      textStyle = styles.goldText;
    } else if (rank === 2) {
      badgeStyle = styles.silverBadge;
      textStyle = styles.silverText;
    } else if (rank === 3) {
      badgeStyle = styles.bronzeBadge;
      textStyle = styles.bronzeText;
    } else {
      badgeStyle = styles.normalBadge;
      textStyle = styles.normalText;
    }

    return (
      <View style={[styles.rankBadge, badgeStyle]}>
        <Text style={[styles.rankText, textStyle]}>{rank}</Text>
      </View>
    );
  };

  const renderItem = ({ item, index }) => (
    <Animated.View
      style={[
        styles.leaderboardItem,
        index < 3 ? styles.topThreeItem : null,
        { opacity: fadeInAnimations[index] || 0 },
      ]}
      key={item.id || index}
    >
      <View style={styles.rankContainer}>{renderRankBadge(index + 1)}</View>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.score}>{item.score}</Text>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background elements */}
      <View style={styles.background}>
        {/* Grid pattern */}
        <View style={styles.gridPattern} />

        {/* Glowing orb effect */}
        <View style={styles.glowOrb} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>LEADERBOARD</Text>
      </View>

      <View style={styles.categorySelector}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryButton,
              category === cat.id && styles.selectedCategory,
              category === cat.id && { borderColor: cat.color },
            ]}
            onPress={() => handleCategoryChange(cat.id)}
          >
            <Text
              style={[
                styles.categoryText,
                category === cat.id && styles.selectedCategoryText,
                category === cat.id && { color: cat.color },
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.leaderboardHeader}>
        <Text style={[styles.headerText, styles.rankHeader]}>Rank</Text>
        <Text style={[styles.headerText, styles.nameHeader]}>Player</Text>
        <Text style={[styles.headerText, styles.scoreHeader]}>Score</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchLeaderboard}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No scores for this category yet.</Text>
          <Text style={styles.emptyText}>Be the first to play!</Text>

          <TouchableOpacity
            style={styles.playButton}
            onPress={() => navigation.navigate("Game")}
          >
            <Text style={styles.playButtonText}>Play Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.id || index.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: "rgba(153, 50, 252, 0.7)", // Purple
    opacity: 0.3,
  },
  header: {
    alignItems: "center",
    marginVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFCC00", // Neon yellow
    textShadowColor: "rgba(255, 204, 0, 0.7)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  categorySelector: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    marginHorizontal: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  selectedCategory: {
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
  },
  selectedCategoryText: {
    fontWeight: "bold",
    color: "#ffffff",
  },
  leaderboardHeader: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerText: {
    fontWeight: "bold",
    color: "rgba(255,255,255,0.7)",
  },
  rankHeader: {
    flex: 1,
  },
  nameHeader: {
    flex: 3,
  },
  scoreHeader: {
    flex: 2,
    textAlign: "right",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  topThreeItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  rankContainer: {
    flex: 1,
    alignItems: "center",
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  goldBadge: {
    backgroundColor: "rgba(255,215,0,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.5)",
  },
  silverBadge: {
    backgroundColor: "rgba(192,192,192,0.2)",
    borderWidth: 1,
    borderColor: "rgba(192,192,192,0.5)",
  },
  bronzeBadge: {
    backgroundColor: "rgba(205,127,50,0.2)",
    borderWidth: 1,
    borderColor: "rgba(205,127,50,0.5)",
  },
  normalBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  goldText: {
    color: "#FFD700", // Gold
  },
  silverText: {
    color: "#C0C0C0", // Silver
  },
  bronzeText: {
    color: "#CD7F32", // Bronze
  },
  normalText: {
    color: "rgba(255,255,255,0.7)",
  },
  name: {
    flex: 3,
    fontSize: 16,
    color: "#fff",
  },
  score: {
    flex: 2,
    fontSize: 16,
    fontWeight: "600",
    color: "#00FF99", // Neon green
    textAlign: "right",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 10,
    textAlign: "center",
  },
  playButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  playButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    padding: 16,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  homeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,204,0,0.3)", // Yellow
  },
  homeButtonText: {
    color: "#FFCC00", // Yellow
    fontSize: 14,
    fontWeight: "600",
  },
});
