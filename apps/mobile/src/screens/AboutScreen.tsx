import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Linking,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

export default function AboutScreen({ navigation }) {
  // Function to handle link presses
  const handleLinkPress = (url) => {
    Linking.openURL(url).catch((err) => {
      console.error("Error opening link:", err);
      alert("Unable to open link");
    });
  };

  // Function to handle email
  const handleEmailPress = (email) => {
    Linking.openURL(`mailto:${email}`).catch((err) => {
      console.error("Error opening email:", err);
      alert("Unable to open email client");
    });
  };

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>BACK</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>ABOUT</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.title}>TREND GUESSER</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>
            The Ultimate Higher/Lower Trend Prediction Game
          </Text>
        </View>

        {/* Game Overview section */}
        <View style={[styles.section, styles.yellowSection]}>
          <Text style={styles.sectionTitle}>GAME OVERVIEW</Text>
          <Text style={styles.paragraph}>
            Trend Guesser is a fun and engaging higher/lower guessing game where
            you predict whether a hidden trending search term has a higher or
            lower search volume than a revealed term. Whether you're a casual
            player or a tech enthusiast, get ready for quick sessions,
            customizable challenges, and competitive leaderboard action!
          </Text>
        </View>

        {/* How To Play section */}
        <View style={[styles.section, styles.blueSection]}>
          <Text style={styles.sectionTitle}>HOW TO PLAY</Text>
          <View style={styles.listItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>1</Text>
            </View>
            <Text style={styles.listText}>
              Begin with one revealed search term and its known search volume.
            </Text>
          </View>
          <View style={styles.listItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>2</Text>
            </View>
            <Text style={styles.listText}>
              Guess whether the hidden term has a HIGHER or LOWER search volume.
            </Text>
          </View>
          <View style={styles.listItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>3</Text>
            </View>
            <Text style={styles.listText}>
              A correct guess will replace the revealed term with the hidden
              term and earn you a point.
            </Text>
          </View>
          <View style={styles.listItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>4</Text>
            </View>
            <Text style={styles.listText}>
              The game continues until you make an incorrect guess. Your final
              score is recorded on the leaderboards.
            </Text>
          </View>
        </View>

        {/* Features section */}
        <View style={[styles.section, styles.greenSection]}>
          <Text style={styles.sectionTitle}>FEATURES</Text>
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Text style={styles.featureTitle}>Dynamic Gameplay</Text>
              <Text style={styles.featureText}>
                Challenge your intuition by predicting trending search volumes.
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureTitle}>Custom Categories</Text>
              <Text style={styles.featureText}>
                Choose from predefined categories like celebrities, technology,
                games, and more or enter your own search term.
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureTitle}>Sleek UI/UX</Text>
              <Text style={styles.featureText}>
                Enjoy a neon-inspired design with responsive layouts and dynamic
                backgrounds.
              </Text>
            </View>

            <View style={styles.featureItem}>
              <Text style={styles.featureTitle}>Real-Time Leaderboards</Text>
              <Text style={styles.featureText}>
                Compete against friends and players worldwide.
              </Text>
            </View>
          </View>
        </View>

        {/* Contributors & Special Thanks section */}
        <View style={[styles.section, styles.purpleSection]}>
          <Text style={styles.sectionTitle}>CONTRIBUTORS & SPECIAL THANKS</Text>
          <Text style={styles.paragraph}>
            Check out the GitHub repository for a full list of contributors.
          </Text>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() =>
              handleLinkPress("https://github.com/rouic/trendguesser")
            }
          >
            <Text style={styles.linkButtonText}>GITHUB REPOSITORY</Text>
          </TouchableOpacity>

          <View style={styles.listItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>•</Text>
            </View>
            <Text style={styles.listText}>
              Developed and continuously enhanced by Alex Cottenham - @Rouic.
            </Text>
          </View>
          <View style={styles.listItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>•</Text>
            </View>
            <Text style={styles.listText}>
              Special thanks to our community for valuable feedback and support!
            </Text>
          </View>
        </View>

        {/* Version info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <Text style={styles.copyrightText}>© 2025 Trend Guesser</Text>
        </View>

        {/* Contact section */}
        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => handleEmailPress("support@trendguesser.com")}
        >
          <Text style={styles.contactButtonText}>Contact Support</Text>
        </TouchableOpacity>

        {/* Navigation buttons */}
        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={styles.navButtonText}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.navigate("Game")}
          >
            <Text style={styles.navButtonText}>Play Game</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigation.navigate("Leaderboard")}
          >
            <Text style={styles.navButtonText}>Leaderboard</Text>
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
    backgroundColor: "rgba(153, 50, 252, 0.7)", // Purple
    opacity: 0.3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,204,0,0.3)", // Yellow
  },
  backButtonText: {
    color: "#FFCC00", // Yellow
    fontSize: 12,
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginRight: 50, // To offset the back button and center the title
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFCC00", // Neon yellow
    marginBottom: 10,
    textShadowColor: "rgba(255, 204, 0, 0.7)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  divider: {
    width: 80,
    height: 2,
    backgroundColor: "rgba(255,204,0,0.5)", // Yellow
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  section: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  yellowSection: {
    borderColor: "rgba(255,204,0,0.3)", // Yellow
    transform: [{ rotate: "-0.5deg" }],
  },
  blueSection: {
    borderColor: "rgba(59,130,246,0.3)", // Blue
    transform: [{ rotate: "0.5deg" }],
  },
  greenSection: {
    borderColor: "rgba(74,222,128,0.3)", // Green
    transform: [{ rotate: "-0.5deg" }],
  },
  purpleSection: {
    borderColor: "rgba(153,50,252,0.3)", // Purple
    transform: [{ rotate: "0.5deg" }],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#fff",
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 24,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 15,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "flex-start",
  },
  bulletPoint: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 2,
  },
  bulletText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 24,
    color: "rgba(255,255,255,0.8)",
  },
  featuresContainer: {
    marginTop: 10,
  },
  featureItem: {
    marginBottom: 15,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4ade80", // Green
    marginBottom: 5,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.8)",
  },
  linkButton: {
    backgroundColor: "rgba(153,50,252,0.2)", // Purple
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(153,50,252,0.5)",
  },
  linkButtonText: {
    color: "#9932fc", // Purple
    fontSize: 12,
    fontWeight: "bold",
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 5,
  },
  copyrightText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  contactButton: {
    backgroundColor: "rgba(59,130,246,0.2)", // Blue
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.5)",
  },
  contactButtonText: {
    color: "#3b82f6", // Blue
    fontSize: 14,
    fontWeight: "bold",
  },
  navigationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  navButton: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  navButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
