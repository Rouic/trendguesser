import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Linking } from 'react-native';

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.title}>About TrendGuesser</Text>
          <Text style={styles.paragraph}>
            TrendGuesser is a game where you guess the relative popularity of search terms over time.
            Try to predict whether one search term is trending higher or lower than another!
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.subtitle}>How to Play</Text>
          <Text style={styles.paragraph}>
            1. You'll be shown two search terms
          </Text>
          <Text style={styles.paragraph}>
            2. Guess whether the second term is trending higher or lower than the first
          </Text>
          <Text style={styles.paragraph}>
            3. Each correct guess earns you points
          </Text>
          <Text style={styles.paragraph}>
            4. Keep playing to build up your score and compete on the leaderboard
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.subtitle}>Privacy</Text>
          <Text style={styles.paragraph}>
            We only collect anonymous usage data to improve the game experience.
            No personal information is shared with third parties.
          </Text>
          <Text 
            style={styles.link}
            onPress={() => Linking.openURL('https://www.example.com/privacy')}
          >
            Read our full Privacy Policy
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.subtitle}>Contact</Text>
          <Text style={styles.paragraph}>
            Have questions or feedback? Contact us at:
          </Text>
          <Text 
            style={styles.link}
            onPress={() => Linking.openURL('mailto:support@trendguesser.com')}
          >
            support@trendguesser.com
          </Text>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.version}>Version 1.0.0</Text>
          <Text style={styles.copyright}>© 2025 TrendGuesser</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 16,
    color: '#4b5563',
    lineHeight: 24,
    marginBottom: 10,
  },
  link: {
    fontSize: 16,
    color: '#3b82f6',
    marginTop: 5,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
    paddingBottom: 20,
  },
  version: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 5,
  },
  copyright: {
    fontSize: 14,
    color: '#6b7280',
  },
});