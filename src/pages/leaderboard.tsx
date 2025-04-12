import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { TrendGuesserService } from '@/lib/firebase/trendGuesserService';
import { SearchCategory, TrendGuesserPlayer } from '@/types';
import Footer from '@/components/layout/Footer';

const LeaderboardPage = () => {
  const router = useRouter();
  const [category, setCategory] = useState<SearchCategory>('everything');
  const [leaderboard, setLeaderboard] = useState<TrendGuesserPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Categories for selection
  const categories: { id: SearchCategory; name: string; color: string }[] = [
    { id: 'animals', name: 'Animals', color: 'border-green-400 text-green-400' },
    { id: 'celebrities', name: 'Celebrities', color: 'border-pink-400 text-pink-400' },
    { id: 'everything', name: 'Everything', color: 'border-purple-400 text-purple-400' },
    { id: 'latest', name: 'Latest News', color: 'border-yellow-400 text-yellow-400' },
    { id: 'games', name: 'Games', color: 'border-red-400 text-red-400' },
    { id: 'technology', name: 'Technology', color: 'border-blue-400 text-blue-400' },
    { id: 'questions', name: 'Questions', color: 'border-orange-400 text-orange-400' },
    { id: 'custom', name: 'Custom', color: 'border-game-neon-blue text-game-neon-blue' }
  ];

  // Fetch leaderboard data when category changes
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await TrendGuesserService.getLeaderboard(category);
        setLeaderboard(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setError('Failed to load leaderboard data.');
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [category]);

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-between px-4 sm:px-8 py-4 sm:py-8 relative overflow-hidden">
      {/* Background elements (reused from homepage) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      ></div>

      <div
        className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(252, 50, 151, 0.7), transparent 70%)",
          filter: "blur(100px)",
        }}
      ></div>

      <Head>
        <title>TrendGuesser - Leaderboard</title>
        <meta
          name="description"
          content="Check the top players on the TrendGuesser leaderboard."
        />
      </Head>

      {/* Navigation */}
      <div className="w-full flex justify-between px-3 sm:px-8 pt-4 sm:pt-0 relative z-20">
        <Link
          href="/"
          className="px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-blue/30 text-game-neon-blue font-game-fallback text-sm hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-blue-sm"
        >
          HOME
        </Link>
        
        <div className="flex space-x-2 sm:space-x-4">
          <Link
            href="/about"
            className="px-3 sm:px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-yellow/30 text-game-neon-yellow font-game-fallback text-xs sm:text-sm hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-yellow-sm"
          >
            ABOUT
          </Link>
          <Link
            href="/privacy"
            className="px-3 sm:px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-blue/30 text-game-neon-blue font-game-fallback text-xs sm:text-sm hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-blue-sm"
          >
            PRIVACY
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl w-full mx-auto text-center relative z-10 flex flex-col items-center py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-display text-game-neon-blue tracking-wider mb-6 animate-glow font-display-fallback">
          LEADERBOARD
        </h1>

        {/* Category selector */}
        <div className="w-full mb-8 overflow-x-auto">
          <div className="flex gap-2 justify-center min-w-max pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-2 rounded-full border text-sm ${cat.color} ${
                  category === cat.id 
                    ? `bg-black/60 border-opacity-80` 
                    : `bg-black/30 border-opacity-30 hover:bg-black/50 hover:border-opacity-50`
                } transition-all duration-300`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard table */}
        <div className="w-full bg-black/40 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 border-t-4 border-game-neon-blue rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white/70 font-game-fallback">Loading leaderboard...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-game-neon-red font-game-fallback">{error}</p>
              <button
                onClick={() => setCategory(category)} // Retry
                className="mt-4 px-6 py-2 bg-black/30 rounded-full border border-game-neon-blue/30 text-game-neon-blue font-game-fallback text-sm hover:bg-black/50"
              >
                Try Again
              </button>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-white/70 font-game-fallback">No scores for this category yet. Be the first!</p>
              <Link
                href="/game"
                className="inline-block mt-4 px-6 py-2 bg-game-neon-blue/20 rounded-full border border-game-neon-blue/50 text-game-neon-blue font-game-fallback text-sm hover:bg-game-neon-blue/30"
              >
                Play Now
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-white/70 font-game-fallback">Rank</th>
                  <th className="px-4 py-3 text-left text-white/70 font-game-fallback">Player</th>
                  <th className="px-4 py-3 text-right text-white/70 font-game-fallback">Score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player, index) => (
                  <motion.tr
                    key={player.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b border-white/10 hover:bg-white/5 ${
                      index === 0 ? 'bg-game-neon-gold/10' : 
                      index === 1 ? 'bg-game-neon-silver/10' : 
                      index === 2 ? 'bg-game-neon-bronze/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-left">
                      <span className={`
                        inline-block w-8 h-8 rounded-full text-center leading-8
                        ${index === 0 ? 'bg-game-neon-gold/20 text-game-neon-gold' : 
                          index === 1 ? 'bg-game-neon-silver/20 text-game-neon-silver' : 
                          index === 2 ? 'bg-game-neon-bronze/20 text-game-neon-bronze' : 
                          'bg-white/10 text-white/70'}
                      `}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left text-white font-game-fallback">
                      {player.name}
                    </td>
                    <td className="px-4 py-3 text-right text-game-neon-green font-bold font-game-fallback">
                      {player.score}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Play button */}
        <Link
          href="/game"
          className="mt-8 px-8 py-3 bg-black/40 backdrop-blur-sm rounded-xl border-2 border-game-neon-blue/50 text-game-neon-blue font-bold font-game-fallback text-xl hover:bg-black/60 hover:scale-105 transition-all duration-300 shadow-neon-blue-sm"
        >
          PLAY NOW
        </Link>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LeaderboardPage;