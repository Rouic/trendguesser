import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SearchTerm, SearchTermCard } from '@trendguesser/shared';

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  volumeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3b82f6',
    marginTop: 10,
  },
});

export default MobileSearchTermCard;