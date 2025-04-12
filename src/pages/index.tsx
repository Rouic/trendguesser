import React, { useState } from "react";
import Link from "next/link";
import Head from "next/head";
import Footer from "@/components/layout/Footer";

const HomePage = () => {

  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-between px-4 sm:px-8 py-4 sm:py-8 relative overflow-hidden">
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
          content="https://pyramid.ninja/images/pyramid.ninja.background.png"
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
                "Play TrendGuesser - a higher or lower game with trending search terms. Also includes Pyramid and YES card games!",
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
      <div className="w-full flex justify-end px-3 sm:px-8 pt-4 sm:pt-0 relative z-20">
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

      {/* Main content - positioned in the center */}
      <div className="max-w-5xl w-full mx-auto text-center relative z-10 flex flex-col items-center py-4 sm:py-8">
        <div className="flex flex-col items-center w-full px-1">
          <div
            className="w-28 h-28 sm:w-40 sm:h-40 mb-2 sm:mb-4 animate-float-slow cursor-pointer"
            aria-label="Click me three times for a surprise"
          >
            <img
              src="/icon.png"
              alt="Pyramid Ninja Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-[25px] xxs:text-3xl xs:text-3xl sm:text-4xl md:text-5xl xl:text-7xl font-display text-game-neon-blue tracking-tight xs:tracking-normal sm:tracking-wider mb-0 animate-glow font-display-fallback w-full px-2">
            TRENDGUESSER
          </h1>
        </div>

        <div className="w-full max-w-3xl mx-auto h-1.5 bg-gradient-to-r from-transparent via-game-neon-red to-transparent mb-2 mt-2"></div>

        <p className="text-lg sm:text-2xl md:text-3xl text-white mb-6 sm:mb-12 max-w-3xl mx-auto font-game-fallback tracking-wide text-center w-full leading-relaxed px-6 sm:px-0">
          THE HIGHER OR LOWER GAME WITH TRENDING SEARCH TERMS 
        </p>

        {/* Game buttons */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6 sm:mb-12 justify-center">
          <Link 
            href="/game" 
            className="px-8 py-4 bg-black/30 backdrop-blur-sm rounded-xl border-2 border-game-neon-blue/70 text-game-neon-blue font-bold font-game-fallback text-xl hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-blue-sm flex-1 text-center"
          >
            PLAY NOW
          </Link>
          
          <Link 
            href="/leaderboard" 
            className="px-8 py-4 bg-black/30 backdrop-blur-sm rounded-xl border-2 border-game-neon-green/70 text-game-neon-green font-bold font-game-fallback text-xl hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-green-sm flex-1 text-center"
          >
            LEADERBOARD
          </Link>
        </div>
        
        {/* Features section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-black/40 transition-colors">
            <h3 className="text-game-neon-blue font-bold text-xl mb-3 font-game-fallback">
              CATEGORIES
            </h3>
            <p className="text-white/80 font-game-fallback">
              Choose from animals, celebrities, technology, and more.
            </p>
          </div>
          
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-black/40 transition-colors">
            <h3 className="text-game-neon-pink font-bold text-xl mb-3 font-game-fallback">
              CUSTOM TERMS
            </h3>
            <p className="text-white/80 font-game-fallback">
              Enter your own search term and see how it compares.
            </p>
          </div>
          
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:bg-black/40 transition-colors sm:col-span-2 lg:col-span-1">
            <h3 className="text-game-neon-green font-bold text-xl mb-3 font-game-fallback">
              HIGH SCORES
            </h3>
            <p className="text-white/80 font-game-fallback">
              Your high scores are saved for each category.
            </p>
          </div>
        </div>
      </div>

      {/* Footer - at the bottom */}
      <Footer />

      {/* Card decorations in corners like Balatro - hide some on mobile */}
      <div className="absolute bottom-24 right-24 w-40 h-56 rounded-lg bg-game-card opacity-10 transform rotate-12 hidden sm:block"></div>
      <div className="absolute top-24 left-24 w-40 h-56 rounded-lg bg-game-card opacity-10 transform -rotate-12 hidden sm:block"></div>
      <div className="absolute bottom-48 left-48 w-32 h-44 rounded-lg bg-game-card opacity-10 transform rotate-45 hidden md:block"></div>
      <div className="absolute top-48 right-48 w-32 h-44 rounded-lg bg-game-card opacity-10 transform -rotate-45 hidden md:block"></div>
    </div>
  );
};

export default HomePage;
