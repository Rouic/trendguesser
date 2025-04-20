import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface LoadingScreenProps {
  message?: string;
  loadingDots?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = "Loading...",
  loadingDots = true,
}) => {
  const [dots, setDots] = useState("");

  // Add animated dots to the loading message
  useEffect(() => {
    if (!loadingDots) return;

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 400);

    return () => clearInterval(interval);
  }, [loadingDots]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background patterns similar to other screens */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      ></div>

      {/* Glowing orb effect similar to other screens */}
      <div
        className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(50, 135, 252, 0.6), transparent 70%)",
          filter: "blur(100px)",
        }}
      ></div>

      {/* Loading content with backdrop blur and glow effects */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10 relative"
      >
        <div className="bg-black/40 backdrop-blur-sm p-8 rounded-2xl border border-game-neon-blue/20 shadow-neon-blue-sm">
          {/* Enhanced loading spinner */}


          {/* Message with animated glow effect */}
          <h2 className="text-2xl md:text-3xl font-display text-game-neon-yellow font-display-fallback mb-4 text-center animate-glow">
            {message}
            {loadingDots ? dots : ""}
          </h2>

          {/* Subtle animated card divider */}
          <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-game-neon-blue/30 to-transparent mb-4"></div>

          {/* Subtitle with game-consistent styling */}
          <p className="text-white/70 font-game-fallback text-center tracking-wide">
            Please stand by
          </p>
        </div>

        {/* Animated pulsing card reflection */}
        <div className="w-full h-1 bg-game-neon-blue/5 rounded-full mt-0.5 blur-sm"></div>
        <div className="w-4/5 h-1 bg-game-neon-blue/3 rounded-full mt-0.5 mx-auto blur-sm"></div>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
