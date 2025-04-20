import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SearchCategory } from '@trendguesser/shared';
import { useTrendGuesserService } from '../services/TrendGuesserServiceProvider';

export default function LeaderboardScreen() {
  const trendGuesserService = useTrendGuesserService();
  const [leaderboard, setLeaderboard] = useState<Array<{ id: string; name: string; score: number; date: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<SearchCategory>('general');
  const [error, setError] = useState<string | null>(null);

  // Fetch leaderboard data
  useEffect(() => {
    fetchLeaderboard();
  }, [category]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await trendGuesserService.getLeaderboard(category);
      setLeaderboard(data as Array<{ id: string; name: string; score: number; date: string }>);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (newCategory: SearchCategory) => {
    setCategory(newCategory);
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.leaderboardItem} key={item.id}>
      <Text style={styles.rank}>{index + 1}</Text>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.score}>{item.score}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
      </View>
      
      <View style={styles.categorySelector}>
        <TouchableOpacity 
          style={[styles.categoryButton, category === 'general' && styles.selectedCategory]}
          onPress={() => handleCategoryChange('general')}
        >
          <Text style={[styles.categoryText, category === 'general' && styles.selectedCategoryText]}>General</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.categoryButton, category === 'technology' && styles.selectedCategory]}
          onPress={() => handleCategoryChange('technology')}
        >
          <Text style={[styles.categoryText, category === 'technology' && styles.selectedCategoryText]}>Tech</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.categoryButton, category === 'entertainment' && styles.selectedCategory]}
          onPress={() => handleCategoryChange('entertainment')}
        >
          <Text style={[styles.categoryText, category === 'entertainment' && styles.selectedCategoryText]}>Entertainment</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.categoryButton, category === 'sports' && styles.selectedCategory]}
          onPress={() => handleCategoryChange('sports')}
        >
          <Text style={[styles.categoryText, category === 'sports' && styles.selectedCategoryText]}>Sports</Text>
        </TouchableOpacity>
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
          <TouchableOpacity style={styles.retryButton} onPress={fetchLeaderboard}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No scores for this category yet.</Text>
          <Text style={styles.emptyText}>Be the first to play!</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  selectedCategory: {
    backgroundColor: '#3b82f6',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  selectedCategoryText: {
    color: '#ffffff',
  },
  leaderboardHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#e5e7eb',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  headerText: {
    fontWeight: 'bold',
    color: '#4b5563',
  },
  rankHeader: {
    flex: 1,
  },
  nameHeader: {
    flex: 3,
  },
  scoreHeader: {
    flex: 2,
    textAlign: 'right',
  },
  list: {
    flex: 1,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  rank: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4b5563',
  },
  name: {
    flex: 3,
    fontSize: 16,
    color: '#111827',
  },
  score: {
    flex: 2,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 10,
    textAlign: 'center',
  },
});