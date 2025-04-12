import React from "react";
import { motion } from "framer-motion";
import { SearchTerm } from "@/types";

interface SearchTermCardProps {
  term: SearchTerm;
  showVolume: boolean;
  position: "top" | "bottom";
  isNext?: boolean;
  isAnimating?: boolean;
}

const SearchTermCard: React.FC<SearchTermCardProps> = ({
  term,
  showVolume,
  position,
  isNext = false,
  isAnimating = false,
}) => {
  // Format the search volume nicely
  const formattedVolume = term.volume.toLocaleString();

  // Default background if no image URL
  const backgroundImage = term.imageUrl
    ? `url("${term.imageUrl}")`
    : `linear-gradient(45deg, rgba(0,0,0,0.7), rgba(20,20,30,0.8))`;

  // Define animation variants based on position and whether this is the next card
  const variants = {
    // Starting state for normal cards
    initial: {
      y: position === "top" ? -20 : 20,
      opacity: 0,
    },
    
    // Animation states for current cards during transitions
    exitTop: {
      y: -300, 
      opacity: 0,
      transition: { 
        duration: 0.5,
        ease: "easeInOut"
      }
    },
    exitBottom: {
      y: 300, 
      opacity: 0,
      transition: { 
        duration: 0.5,
        ease: "easeInOut"
      }
    },
    
    // Standard visible state for normal cards
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        duration: 0.5,
        bounce: 0.3
      }
    },
    
    // Starting state for next cards
    nextTop: {
      y: -300,
      opacity: 0
    },
    nextBottom: {
      y: 300,
      opacity: 0
    },
    
    // Animation for next cards becoming current
    nextVisible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring", 
        duration: 0.5,
        bounce: 0.3,
        delay: 0.2
      }
    }
  };
  
  // Determine which animation state to use
  const getAnimationState = () => {
    if (isNext) {
      return isAnimating ? 'nextVisible' : (position === 'top' ? 'nextTop' : 'nextBottom');
    } else {
      return isAnimating ? (position === 'top' ? 'exitTop' : 'exitBottom') : 'visible';
    }
  };
  
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate={getAnimationState()}
      className={`w-full max-w-7xl rounded-2xl overflow-hidden shadow-xl relative ${
        isNext ? "absolute top-0 left-0 right-0 mx-auto" : ""
      }`}
    >
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage }}
      ></div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>

      {/* Card pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{ backgroundImage: `url(/images/card-pattern.svg)` }}
      ></div>

      {/* Content */}
      <div className="relative p-6 sm:p-8 flex flex-col items-center text-center min-h-[200px] justify-center">
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 font-game-fallback">
          {term.term}
        </h3>

        {/* Search volume - conditionally rendered */}
        {showVolume && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15 }}
            className="mt-2"
          >
            <p className="text-lg text-white/70 font-game-fallback mb-1">
              Monthly Search Volume
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-game-neon-blue font-game-fallback">
              {formattedVolume}
            </p>
          </motion.div>
        )}

        {/* Question mark if volume is hidden */}
        {!showVolume && position === "bottom" && (
          <div className="mt-2 flex flex-col items-center">
            <p className="text-lg text-white/70 font-game-fallback mb-1">
              Monthly Search Volume
            </p>
            <div className="w-20 h-20 rounded-full border-4 border-game-neon-yellow flex items-center justify-center">
              <span className="text-5xl font-bold text-game-neon-yellow">
                ?
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SearchTermCard;