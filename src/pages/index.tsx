import React from "react";
import Link from "next/link";
import Head from "next/head";
import Footer from "@/components/layout/Footer";

const HomePage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-4 sm:px-8 py-4 sm:py-8 relative overflow-hidden">
      {/* Background patterns similar to Balatro */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      ></div>

      {/* Glowing orb effect similar to Balatro */}
      <div
        className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(252, 50, 151, 0.7), transparent 70%)",
          filter: "blur(100px)",
        }}
      ></div>

      <Head>
        <title>TrendGuesser - Higher or Lower Search Trending Game</title>
        <meta
          name="description"
          content="Play TrendGuesser - a higher or lower game with trending search terms."
        />

        {/* Additional page-specific SEO */}
        <meta
          property="og:image"
          content="https://trendguesser.com/images/trendguesser.background.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "TrendGuesser",
              url: "https://trendguesser.com",
              description:
                "Play TrendGuesser - a higher or lower game with trending search terms.",
              applicationCategory: "GameApplication",
              operatingSystem: "All",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              author: {
                "@type": "Person",
                name: "TrendGuesser Developer",
              },
            }),
          }}
        />
      </Head>

      {/* Navigation */}
      <div className="w-full hidden md:flex justify-end px-3 sm:px-8 pt-4 sm:pt-0 relative z-20">
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
          <Link
            href="/leaderboard"
            className="px-3 sm:px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-green/30 text-game-neon-green font-game-fallback text-xs sm:text-sm hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-green-sm"
          >
            LEADERBOARD
          </Link>
        </div>
      </div>

      {/* Main content - positioned in the center */}
      <div className="max-w-5xl w-full mx-auto text-center relative z-10 flex flex-col items-center py-4 sm:py-8">
        <div className="flex flex-col items-center w-full px-1 mt-14 sm:mt-0">
          <h1 className="text-[45px] xl:text-7xl font-display text-game-neon-yellow tracking-tight xs:tracking-normal sm:tracking-wider mb-0 animate-glow font-display-fallback w-full px-2">
            TREND GUESSER
          </h1>
        </div>

        <div className="w-full max-w-3xl mx-auto h-1.5 bg-gradient-to-r from-transparent via-game-neon-yellow to-transparent mb-2 mt-2"></div>

        <h2 className="text-lg sm:text-2xl md:text-3xl text-white mb-6 sm:mb-12 max-w-3xl mx-auto font-game-fallback tracking-wide text-center w-full leading-relaxed px-6 sm:px-0">
          GUESS WHICH TRENDING TERM HAS MORE SEARCHES!
        </h2>

        {/* Game buttons - UPDATED for more prominent Play Now button */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-10 sm:mb-16 justify-center w-full">
          <Link
            href="/game"
            className="px-12 py-6 bg-black/50 backdrop-blur-sm rounded-xl border-4 border-game-neon-yellow text-game-neon-yellow font-bold font-game-fallback text-2xl md:text-3xl hover:bg-black/70 hover:scale-105 hover:shadow-neon-yellow-lg transition-all duration-300 shadow-neon-yellow-md text-center mx-auto w-full max-w-md relative"
          >
            <div className="absolute -inset-px bg-game-neon-yellow/10 rounded-xl"></div>
            PLAY NOW
          </Link>
        </div>

        {/* Features section - UPDATED to be more subtle/informational */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
          <div className="bg-gray-800/20 backdrop-blur-sm rounded-xl p-6 border border-white/5  hover:shadow-neon-green-sm transition-all duration-300 group">
            <h3 className="text-game-neon-green/80 font-bold text-lg mb-3 font-game-fallback group-hover:text-game-neon-green transition-colors duration-300">
              INTUITION!
            </h3>
            <p className="text-white/60 font-game-fallback group-hover:text-white/80 transition-colors duration-300">
              Test your gut. Guess which trends are hotter.
            </p>
          </div>

          <div className="bg-gray-800/20 backdrop-blur-sm rounded-xl p-6 border border-white/5  hover:shadow-neon-blue-sm transition-all duration-300 group">
            <h3 className="text-game-neon-blue/80 font-bold text-lg mb-3 font-game-fallback group-hover:text-game-neon-blue transition-colors duration-300">
              CATEGORIES!
            </h3>
            <p className="text-white/60 font-game-fallback group-hover:text-white/80 transition-colors duration-300">
              Celebrity, tech, games, food. Pick your specialty.
            </p>
          </div>

          <div className="bg-gray-800/20 backdrop-blur-sm rounded-xl p-6 border border-white/5  hover:shadow-neon-pink-sm transition-all duration-300 group sm:col-span-2 lg:col-span-1">
            <h3 className="text-game-neon-pink/80 font-bold text-lg mb-3 font-game-fallback group-hover:text-game-neon-pink transition-colors duration-300">
              COMPETE!
            </h3>
            <p className="text-white/60 font-game-fallback group-hover:text-white/80 transition-colors duration-300">
              Beat your friends. Top the leaderboards.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default HomePage;
