import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  Dimensions,
} from "react-native";
import { SearchTerm, SearchTermCard } from "@trendguesser/shared";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

interface MobileSearchTermCardProps {
  term: SearchTerm;
  isKnown: boolean; // Whether this is the known term (true) or the term to guess (false)
  showVolume?: boolean; // Whether to show the volume indicator (only for known terms)
}

/**
 * Mobile-specific implementation of the SearchTermCard component
 *
 * IMPORTANT GAME LOGIC:
 * - Both cards always show the term name
 * - Only the known term (isKnown=true) shows its volume
 * - The hidden term (isKnown=false) has its volume hidden - this is what the player guesses
 */
const MobileSearchTermCard: React.FC<MobileSearchTermCardProps> = ({
  term,
  isKnown,
  showVolume = true,
}) => {
  // Placeholder image URL if no image is provided
  const imageUrl =
    term.imageUrl || `https://picsum.photos/seed/${term.term}/500/500`;

  // Format volume with commas for thousands
  const formattedVolume = term.volume.toLocaleString();

  // Use the shared SearchTermCard component to ensure consistent behavior
  return (
    <SearchTermCard
      term={term}
      isKnown={isKnown}
      showVolume={showVolume}
      renderContainer={(children) => (
        <View style={styles.cardContainer}>
          <ImageBackground
            source={{ uri: imageUrl }}
            style={styles.backgroundImage}
            imageStyle={styles.backgroundImageStyle}
          >
            <LinearGradient
              colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.8)"]}
              style={styles.gradient}
            />
            <View style={styles.cardContent}>{children}</View>
          </ImageBackground>
        </View>
      )}
      renderText={(text, style) => {
        switch (style) {
          case "title":
            return <Text style={styles.titleText}>{text}</Text>;
          case "subtitle":
            return <Text style={styles.subtitleText}>{text}</Text>;
          case "volume":
            return <Text style={styles.volumeText}>{text}</Text>;
          default:
            return <Text>{text}</Text>;
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: width - 40, // Card width that works well on mobile
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundImageStyle: {
    borderRadius: 12,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
  },
  cardContent: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  titleText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitleText: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    marginBottom: 12,
  },
  volumeText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#3b82f6", // Bright blue that stands out
    marginTop: 10,
    textAlign: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.5)",
  },
  hiddenVolume: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 204, 0, 0.5)", // Neon yellow border
  },
  questionMark: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#FFCC00", // Neon yellow
  },
});

export default MobileSearchTermCard;
