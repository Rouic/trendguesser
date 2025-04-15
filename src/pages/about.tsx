import React from "react";
import Link from "next/link";
import Head from "next/head";
import Footer from "@/components/layout/Footer";

const AboutPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between py-4 sm:py-7 px-4 sm:px-8 relative overflow-hidden">
      {/* Background patterns */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      ></div>

      {/* Glowing orb effect */}
      <div
        className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-10"
        style={{
          background:
            "radial-gradient(circle at center, rgba(252, 50, 151, 0.7), transparent 70%)",
          filter: "blur(100px)",
        }}
      ></div>

      <Head>
        <title>About Trend Guesser - The Ultimate Trend Prediction Game</title>
        <meta
          name="description"
          content="Learn about Trend Guesser, the higher/lower guessing game where you predict which trending search term has a higher search volume!"
        />
      </Head>

      {/* Navigation */}
      <div className="w-full flex justify-between items-center px-2 sm:px-8 relative z-20">
        <Link href="/" className="flex items-center group">
          <span className="font-display-fallback text-game-neon-yellow text-base sm:text-xl group-hover:text-game-neon-red transition-colors duration-300 font-display">
            TREND GUESSER
          </span>
        </Link>
        <div className="flex space-x-2 sm:space-x-4">
          <Link
            href="/"
            className="px-2 sm:px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-green/30 text-game-neon-green font-game-fallback text-xs sm:text-sm hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-green-sm"
          >
            HOME
          </Link>
          <Link
            href="/privacy"
            className="px-2 sm:px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-blue/30 text-game-neon-blue font-game-fallback text-xs sm:text-sm hover:bg-black/50 hover:scale-105 transition-all duration-300 shadow-neon-blue-sm"
          >
            PRIVACY
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl w-full mx-auto relative z-10 flex flex-col items-center py-6 sm:py-16">
        {/* Header */}
        <div className="flex flex-col items-center mb-8 sm:mb-16 px-4">
          <h1 className="text-xl sm:text-5xl lg:text-6xl font-display text-game-neon-red tracking-wider mb-4 sm:mb-8 animate-glow font-display-fallback text-center">
            ABOUT
          </h1>
          <div className="w-full max-w-3xl mx-auto h-1 bg-gradient-to-r from-transparent via-game-neon-red to-transparent mb-4 sm:mb-8"></div>
          <h2 className="text-lg sm:text-xl md:text-2xl text-white max-w-3xl mx-auto font-game-fallback tracking-wide text-center">
            The Ultimate Higher/Lower Trend Prediction Game
          </h2>
        </div>

        {/* Game Overview section */}
        <div className="w-full max-w-4xl bg-black/30 backdrop-blur-sm p-4 sm:p-10 rounded-xl border border-game-neon-yellow/20 mb-6 sm:mb-10 transform -rotate-0.5 shadow-neon-yellow-sm mx-4 sm:mx-auto">
          <div className="flex items-center mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-12 sm:h-12 mr-3 sm:mr-4 rotate-12 flex-shrink-0">
              <img
                src="/images/icon.png"
                alt="Trend Guesser Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-xl sm:text-2xl text-game-neon-yellow font-game-fallback">
              GAME OVERVIEW
            </h3>
          </div>
          <div className="space-y-3 sm:space-y-4 text-white">
            <p className="text-base sm:text-lg">
              Trend Guesser is a fun and engaging higher/lower guessing game
              where you predict whether a hidden trending search term has a
              higher or lower search volume than a revealed term. Whether you're
              a casual player or a tech enthusiast, get ready for quick
              sessions, customizable challenges, and competitive leaderboard
              action!
            </p>
          </div>
        </div>

        {/* How To Play section */}
        <div className="w-full max-w-4xl bg-black/30 backdrop-blur-sm p-4 sm:p-10 rounded-xl border border-game-neon-blue/20 mb-6 sm:mb-10 transform rotate-0.5 shadow-neon-blue-sm mx-4 sm:mx-auto">
          <h3 className="text-xl sm:text-2xl text-game-neon-blue font-game-fallback mb-4 sm:mb-6">
            HOW TO PLAY
          </h3>
          <ol className="space-y-3 sm:space-y-4 text-white list-decimal pl-5 sm:pl-8">
            <li className="text-base sm:text-lg">
              Begin with one revealed search term and its known search volume.
            </li>
            <li className="text-base sm:text-lg">
              Guess whether the hidden term has a <strong>higher</strong> or{" "}
              <strong>lower</strong> search volume.
            </li>
            <li className="text-base sm:text-lg">
              A correct guess will replace the revealed term with the hidden
              term and earn you a point.
            </li>
            <li className="text-base sm:text-lg">
              The game continues until you make an incorrect guess. Your final
              score is recorded on the leaderboards.
            </li>
          </ol>
        </div>

        {/* Features section */}
        <div className="w-full max-w-4xl bg-black/30 backdrop-blur-sm p-4 sm:p-10 rounded-xl border border-game-neon-green/20 mb-6 sm:mb-10 transform -rotate-0.5 shadow-neon-green-sm mx-4 sm:mx-auto">
          <h3 className="text-xl sm:text-2xl text-game-neon-green font-game-fallback mb-4 sm:mb-6">
            FEATURES
          </h3>
          <ul className="space-y-2 sm:space-y-4 text-white list-disc pl-5 sm:pl-6">
            <li className="text-base sm:text-lg">
              <strong>Dynamic Gameplay:</strong> Challenge your intuition by
              predicting trending search volumes.
            </li>
            <li className="text-base sm:text-lg">
              <strong>Custom Categories & Modes:</strong> Choose from predefined
              categories like celebrities, technology, games, and more or enter
              your own search term.
            </li>
            <li className="text-base sm:text-lg">
              <strong>Sleek UI/UX:</strong> Enjoy a neon-inspired design with
              responsive layouts and dynamic backgrounds.
            </li>
            <li className="text-base sm:text-lg">
              <strong>Real-Time Leaderboards:</strong> Compete against friends
              and players worldwide.
            </li>
          </ul>
        </div>

        {/* Technology & Data section */}
        <div className="w-full max-w-4xl bg-black/30 backdrop-blur-sm p-4 sm:p-10 rounded-xl border border-game-neon-purple/20 mb-6 sm:mb-16 transform rotate-0.5 shadow-neon-purple-sm mx-4 sm:mx-auto">
          <h3 className="text-xl sm:text-2xl text-game-neon-purple font-game-fallback mb-4 sm:mb-6">
            TECHNOLOGY & DATA
          </h3>
          <div className="space-y-3 sm:space-y-4 text-white">
            <p className="text-base sm:text-lg">
              Trend Guesser leverages modern web technologies to deliver a
              smooth gaming experience:
            </p>
            <ul className="space-y-2 list-disc pl-5 sm:pl-8">
              <li className="text-base sm:text-lg">
                <strong>Vercel Authentication:</strong> Secure and seamless
                user sign-in.
              </li>
              <li className="text-base sm:text-lg">
                <strong>Neon Serverless Database:</strong> Real-time storage for scores and
                trending terms.
              </li>
              <li className="text-base sm:text-lg">
                <strong>Vercel Cloud Functions:</strong> Functions such as{" "}
                <code>fetchSearchVolume</code> and{" "}
                <code>updateTrendingTerms</code> simulate dynamic search volume
                data.
              </li>
            </ul>
          </div>
        </div>

        {/* Contributors & Special Thanks section */}
        <div className="w-full max-w-4xl bg-black/30 backdrop-blur-sm p-4 sm:p-10 rounded-xl border border-game-neon-green/20 mb-6 sm:mb-8 transform -rotate-0.5 shadow-neon-green-sm mx-4 sm:mx-auto">
          <h3 className="text-xl sm:text-2xl text-game-neon-green font-game-fallback mb-4 sm:mb-6">
            CONTRIBUTORS &amp; SPECIAL THANKS
          </h3>
          <p className="text-base sm:text-lg text-white mb-3 sm:mb-4">
            Check out the{" "}
            <a
              href="https://github.com/rouic/trendguesser"
              rel="noreferrer"
              target="_blank"
              className="text-game-neon-yellow underline hover:text-game-neon-green transition-colors"
            >
              GitHub repository
            </a>{" "}
            for a full list of contributors.
          </p>
          <ul className="space-y-2 text-white list-disc pl-5 sm:pl-6">
            <li className="text-base sm:text-lg">
              Developed and continuously enhanced by Alex Cottenham - @Rouic.
            </li>
            <li className="text-base sm:text-lg">
              Special thanks to our community for valuable feedback and support!
            </li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Decorative cards in corners */}
      <div className="absolute bottom-24 right-24 w-52 h-72 rounded-lg bg-game-card opacity-10 transform rotate-12 hidden sm:block"></div>
      <div className="absolute top-24 left-24 w-52 h-72 rounded-lg bg-game-card opacity-10 transform -rotate-12 hidden sm:block"></div>
    </div>
  );
};

export default AboutPage;
