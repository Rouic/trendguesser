import React from "react";
import { motion } from "framer-motion";
import { SearchTerm } from "@/types";

interface SearchTermCardProps {
  term: SearchTerm;
  showVolume: boolean;
  position: "top" | "bottom" | "next";
  isAnimating?: boolean;
}

const SearchTermCard: React.FC<SearchTermCardProps> = ({
  term,
  showVolume,
  position,
  isAnimating = false,
}) => {
  // Format the search volume nicely
  const formattedVolume = term.volume.toLocaleString();

  // Default background if no image URL
  const backgroundImage = term.imageUrl
    ? `url("${term.imageUrl}")`
    : `linear-gradient(45deg, rgba(0,0,0,0.7), rgba(20,20,30,0.8))`;

  // Define animation variants based on position
  const variants = {
    // Initial states
    initial: {
      opacity: position === "next" ? 0 : 1,
      y: position === "next" ? 40 : 0,
      scale: position === "next" ? 0.95 : 1,
    },

    // Animated states during transitions
    animate: {
      opacity: 1,
      y: position === "top" ? "-100%" : position === "bottom" ? "-100%" : 0,
      scale: 1,
      transition: {
        y: {
          duration: 0.8,
          ease: [0.2, 0.9, 0.3, 1], // Custom easing for smooth movement
        },
        opacity: {
          duration: 0.5,
          ease: "easeInOut",
        },
        scale: {
          duration: 0.5,
          ease: "easeOut",
        },
      },
    },

    // State when moving to next position
    next: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: 0.2,
        ease: "easeOut",
      },
    },
  };

  // Get animation state based on component props
  const getAnimationState = () => {
    if (isAnimating) {
      return position === "next" ? "next" : "animate";
    }
    return "initial";
  };

  // Determine card class based on position
  const cardClass = `w-full max-w-7xl rounded-xl overflow-hidden shadow-xl 
    relative ${
      position === "top" ? "mb-8" : position === "bottom" ? "mt-8" : ""
    }`;

  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate={getAnimationState()}
      className={cardClass}
      layoutId={`card-${term.id}`}
    >
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-60"
        style={{ backgroundImage }}
      ></div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

      {/* Card pattern overlay */}
      <div
        className="absolute inset-0 opacity-15"
        style={{ backgroundImage: `url(/images/card-pattern.svg)` }}
      ></div>

      {/* Content */}
      <div className="relative p-6 sm:p-8 flex flex-col items-center text-center min-h-[280px] justify-center">
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 font-game-fallback">
          {term.term}
        </h3>

        {/* Search volume - conditionally rendered */}
        {showVolume ? (
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
        ) : (
          /* Question mark if volume is hidden */
          position === "bottom" && (
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
          )
        )}
      </div>
    </motion.div>
  );
};

export default SearchTermCard;
