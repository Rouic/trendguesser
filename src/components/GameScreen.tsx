import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/router";
import { useGame } from "@/contexts/GameContext";
import { motion, AnimatePresence } from "framer-motion";
import SearchTermCard from "./SearchTermCard";
import { useWindowSize } from "@/hooks/useWindowSize";

const GameScreen = () => {
  const router = useRouter();
  const windowSize = useWindowSize();
  const {
    gameState,
    currentPlayer,
    gameId,
    makeGuess,
    endGame,
    resetGame,
    startGame,
    error: gameError,
  } = useGame();

  // Added refs to keep track of timers for cleanup
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(
    null
  );
  const [isGuessing, setIsGuessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationState, setAnimationState] = useState<{
    knownTerm: any;
    hiddenTerm: any;
    isTransitioning: boolean;
  }>({
    knownTerm: null,
    hiddenTerm: null,
    isTransitioning: false,
  });

  // Display any errors from the game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  // Log current game state when it changes
  useEffect(() => {
    if (gameState) {
      console.log("GameScreen: Current game state:", {
        gameId,
        started: gameState.started,
        round: gameState.currentRound,
        category: gameState.category,
        knownTerm: gameState.knownTerm.term,
        hiddenTerm: gameState.hiddenTerm.term,
      });
    }
  }, [gameState, gameId]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  // Attempt to recover from missing game state
  useEffect(() => {
    if (!gameState && !recoveryAttempted) {
      setRecoveryAttempted(true);

      if (
        process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
        typeof window !== "undefined"
      ) {
        console.log("Attempting to recover game state from session storage...");

        // Get the current game ID
        const currentGameId = sessionStorage.getItem("current_game_id");
        if (!currentGameId) {
          setError("Game session not found. Please start a new game.");
          return;
        }

        // Get the game data
        const gameData = sessionStorage.getItem(`game_${currentGameId}`);
        if (!gameData) {
          setError("Game data not found. Please start a new game.");
          return;
        }

        try {
          const parsedData = JSON.parse(gameData);
          if (
            !parsedData["__trendguesser.state"] ||
            !parsedData["__trendguesser.state"].started
          ) {
            setError("Game not properly initialized. Please start a new game.");
            return;
          }

          // If we found valid game data, suggest refreshing the page
          setError(
            "Game state disrupted. Please refresh the page to continue or start a new game."
          );
        } catch (e) {
          console.error("Error recovering game state:", e);
          setError("Error loading game data. Please start a new game.");
        }
      } else {
        setError("Game state not found. Please start a new game.");
      }
    }
  }, [gameState, recoveryAttempted]);

  // Get the next term that will be revealed (if available)
  const getNextTerm = useMemo(() => {
    if (!gameState || !gameState.terms || gameState.terms.length === 0) {
      return null;
    }
    return gameState.terms[0];
  }, [gameState]);

  // Handle correct guess animation with conveyor belt effect
  const handleCorrectGuess = useCallback(() => {
    // Clear any existing timers first
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    // First, ensure we mark this as a correct guess and show volume of hidden card
    setLastGuessCorrect(true);
    setShowResult(true);

    // Start animation after revealing the volume
    animationTimerRef.current = setTimeout(() => {
      setIsAnimating(true);

      // Transition to next state after animation completes
      resetTimerRef.current = setTimeout(() => {
        // Use a sequential approach to state updates to avoid race conditions
        setIsAnimating(false);

        // Short delay before resetting other states to ensure smooth transition
        setTimeout(() => {
          setIsGuessing(false);
          setShowResult(false);
          setLastGuessCorrect(null);

          // Animation is complete, now we can stop using the frozen values
          setAnimationState((prev) => ({
            ...prev,
            isTransitioning: false,
          }));
        }, 50);
      }, 1200); // Increased animation duration for smoother transition
    }, 1000); // Time to show the result before animation
  }, []);

  // Handle player making a guess
  const handleGuess = async (isHigher: boolean) => {
    if (!gameState || isGuessing) return;

    setIsGuessing(true);
    setError(null);

    try {
      // IMPORTANT: Capture the current terms BEFORE making any changes
      // This ensures we use the correct state for comparison and animation
      const currentKnownTerm = { ...gameState.knownTerm };
      const currentHiddenTerm = { ...gameState.hiddenTerm };

      // Log the current state before guessing using the captured terms
      console.log(`Making ${isHigher ? "HIGHER" : "LOWER"} guess...`, {
        knownTerm: currentKnownTerm.term,
        knownVolume: currentKnownTerm.volume,
        hiddenTerm: currentHiddenTerm.term,
        hiddenVolume: currentHiddenTerm.volume,
      });

      // Process the guess - this will update the game state if correct
      const result = await makeGuess(isHigher);
      console.log("Guess result:", result);

      // Check the actual comparison using the CAPTURED terms, not the potentially updated game state
      const actuallyHigher = currentHiddenTerm.volume > currentKnownTerm.volume;
      const actuallyEqual =
        currentHiddenTerm.volume === currentKnownTerm.volume;

      console.log(`Verification: Hidden term is ${
        actuallyEqual
          ? "EQUAL to"
          : actuallyHigher
          ? "HIGHER than"
          : "LOWER than"
      } known term. Player guessed ${isHigher ? "HIGHER" : "LOWER"}. 
    Service said guess was ${result ? "CORRECT" : "INCORRECT"}.`);

      // Save the CAPTURED state for animations, so we can show what the user was guessing against
      setAnimationState({
        knownTerm: currentKnownTerm,
        hiddenTerm: currentHiddenTerm,
        isTransitioning: true,
      });

      // Now that we've captured the state, handle the result
      if (result) {
        // Handle successful guess with animation
        handleCorrectGuess();
      } else {
        // For incorrect guess, show the game over screen
        setLastGuessCorrect(false);
        setShowResult(true);
      }
    } catch (err) {
      console.error("Error in handleGuess:", err);
      setError("Error processing guess. Please try again.");
      setIsGuessing(false);
      // Ensure we're not showing any animations or result screens
      setIsAnimating(false);
      setShowResult(false);
      setLastGuessCorrect(null);
    }
  };

  // Function to handle retry when an error occurs
  const handleRetry = useCallback(() => {
    if (
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
      typeof window !== "undefined"
    ) {
      const currentGameId = sessionStorage.getItem("current_game_id");
      if (currentGameId) {
        // Redirect to the game page to let it handle recovery
        router.push("/game");
      } else {
        resetGame();
        router.push("/game");
      }
    } else {
      resetGame();
      router.push("/game");
    }
  }, [resetGame, router]);

  // Handle player quitting the game
  const handleQuit = async () => {
    await endGame();
    resetGame();
    router.push("/game");
  };

  // No game state - show error
  if (!gameState) {
    return (
      <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-black/40 rounded-xl border border-white/20 p-6 text-center">
          <h2 className="text-2xl font-display text-game-neon-blue mb-4">
            Game Not Found
          </h2>
          <p className="text-white mb-4">
            Unable to load the game state. Please return to the categories and
            try again.
          </p>
          {error && (
            <div className="mb-4 p-3 bg-game-neon-red/20 border border-game-neon-red/40 rounded-lg text-white text-sm overflow-auto">
              {error}
            </div>
          )}
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-black/30 backdrop-blur-sm rounded-full border border-game-neon-blue/30 text-game-neon-blue font-game-fallback hover:bg-black/50 hover:scale-105 transition-all duration-300"
          >
            Back to Categories
          </button>
        </div>
      </div>
    );
  }

  // Define animation variants for conveyor belt effect
  const containerVariants = {
    initial: { y: 0 },
    animate: {
      y: "-100%", // Move up exactly one card's height
      transition: {
        duration: 0.8,
        ease: [0.2, 0.9, 0.3, 1], // Custom easing curve for smooth conveyor movement
      },
    },
  };

  const isDesktop = windowSize.width >= 768;

  // Determine which term data to use for rendering
  const displayKnownTerm =
    animationState.isTransitioning && isAnimating && animationState.knownTerm
      ? animationState.knownTerm
      : gameState.knownTerm;

  const displayHiddenTerm =
    animationState.isTransitioning && animationState.hiddenTerm
      ? animationState.hiddenTerm
      : gameState.hiddenTerm;

  return (
    <div className="min-h-screen bg-game-bg flex flex-col">
      {/* Top bar with score */}
      <div className="p-4 bg-black/30 backdrop-blur-sm flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-white font-game-fallback">SCORE:</span>
          <span className="text-2xl text-game-neon-green font-bold font-game-fallback">
            {currentPlayer?.score || 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white/70 font-game-fallback text-sm">
            {gameState.category.toUpperCase()}
          </span>
          <button
            onClick={handleQuit}
            className="px-4 py-1 bg-black/40 rounded-full border border-game-neon-red/30 text-game-neon-red text-sm font-game-fallback hover:bg-black/60"
          >
            QUIT
          </button>
        </div>
      </div>

      {/* Main game container - switched to grid layout for better spacing */}
      <div className="flex-1 grid grid-rows-[40%_auto_40%] md:grid-rows-[45%_auto_45%] h-[calc(100vh-64px)]">
        {/* Top card (known term) */}
        <div className="flex items-center justify-center p-2 md:p-4">
          <div className="w-full max-w-3xl mx-auto">
            <div
              className="w-full rounded-xl overflow-hidden shadow-xl relative h-full max-h-60 md:max-h-80"
              style={{
                backgroundImage: `url("${displayKnownTerm.imageUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

              {/* Card pattern overlay */}
              <div
                className="absolute inset-0 opacity-15"
                style={{ backgroundImage: `url(/images/card-pattern.svg)` }}
              ></div>

              {/* Content */}
              <div className="relative p-4 md:p-6 flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl md:text-3xl font-bold text-white mb-2 md:mb-4 font-game-fallback text-center">
                  {displayKnownTerm.term}
                </h3>

                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 15 }}
                  className="mt-1 md:mt-2 text-center"
                >
                  <p className="text-sm md:text-lg text-white/70 font-game-fallback mb-1">
                    Monthly Search Volume
                  </p>
                  <p className="text-xl md:text-3xl font-bold text-game-neon-blue font-game-fallback">
                    {displayKnownTerm.volume.toLocaleString()}
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle ribbon - fixed height with buttons */}
        <div className="flex items-center justify-center bg-black/70 border-y border-white/10 backdrop-blur-md z-20">
          <div className="flex justify-center items-center gap-4 md:gap-6 py-3 md:py-4 px-4 w-full max-w-3xl mx-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleGuess(false)}
              disabled={isGuessing}
              className="px-4 md:px-8 py-3 md:py-4 bg-black/60 backdrop-blur-sm rounded-xl border-2 border-game-neon-blue/70 text-game-neon-blue font-bold font-game-fallback text-base md:text-xl hover:bg-black/80 shadow-neon-blue-sm disabled:opacity-50 disabled:cursor-not-allowed flex-1 max-w-36 md:max-w-52 text-center"
            >
              LOWER
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleGuess(true)}
              disabled={isGuessing}
              className="px-4 md:px-8 py-3 md:py-4 bg-black/60 backdrop-blur-sm rounded-xl border-2 border-game-neon-green/70 text-game-neon-green font-bold font-game-fallback text-base md:text-xl hover:bg-black/80 shadow-neon-green-sm disabled:opacity-50 disabled:cursor-not-allowed flex-1 max-w-36 md:max-w-52 text-center"
            >
              HIGHER
            </motion.button>
          </div>
        </div>

        {/* Bottom card (hidden term) */}
        <div className="flex items-center justify-center p-2 md:p-4 relative">
          <div className="w-full max-w-3xl mx-auto">
            <div
              className="w-full rounded-xl overflow-hidden shadow-xl relative h-full max-h-60 md:max-h-80"
              style={{
                backgroundImage: `url("${displayHiddenTerm.imageUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

              {/* Card pattern overlay */}
              <div
                className="absolute inset-0 opacity-15"
                style={{ backgroundImage: `url(/images/card-pattern.svg)` }}
              ></div>

              {/* Content */}
              <div className="relative p-4 md:p-6 flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl md:text-3xl font-bold text-white mb-2 md:mb-4 font-game-fallback text-center">
                  {displayHiddenTerm.term}
                </h3>

                {showResult ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="mt-1 md:mt-2 text-center"
                  >
                    <p className="text-sm md:text-lg text-white/70 font-game-fallback mb-1">
                      Monthly Search Volume
                    </p>
                    <p className="text-xl md:text-3xl font-bold text-game-neon-blue font-game-fallback">
                      {displayHiddenTerm.volume.toLocaleString()}
                    </p>
                  </motion.div>
                ) : (
                  <div className="mt-1 md:mt-2 flex flex-col items-center">
                    <p className="text-sm md:text-lg text-white/70 font-game-fallback mb-1">
                      Monthly Search Volume
                    </p>
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-game-neon-yellow flex items-center justify-center">
                      <span className="text-3xl md:text-5xl font-bold text-game-neon-yellow">
                        ?
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hidden card for animation that appears from below */}
          {isAnimating && getNextTerm && (
            <motion.div
              className="absolute left-0 right-0 bottom-0 transform translate-y-full"
              initial={{ opacity: 0, y: "50%" }}
              animate={{ opacity: 1, y: "0%" }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="w-full max-w-3xl mx-auto px-2 md:px-4">
                <div
                  className="w-full rounded-xl overflow-hidden shadow-xl relative h-full max-h-60 md:max-h-80"
                  style={{
                    backgroundImage: `url("${getNextTerm.imageUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

                  {/* Card pattern overlay */}
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{ backgroundImage: `url(/images/card-pattern.svg)` }}
                  ></div>

                  {/* Content */}
                  <div className="relative p-4 md:p-6 flex flex-col items-center justify-center text-center h-full">
                    <h3 className="text-xl md:text-3xl font-bold text-white mb-2 md:mb-4 font-game-fallback text-center">
                      {getNextTerm.term}
                    </h3>

                    <div className="mt-1 md:mt-2 flex flex-col items-center">
                      <p className="text-sm md:text-lg text-white/70 font-game-fallback mb-1">
                        Monthly Search Volume
                      </p>
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-game-neon-yellow flex items-center justify-center">
                        <span className="text-3xl md:text-5xl font-bold text-game-neon-yellow">
                          ?
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Correct guess notification */}
      <AnimatePresence>
        {showResult && lastGuessCorrect === true && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-4 bg-game-neon-green/20 backdrop-blur-md rounded-xl border border-game-neon-green/50 text-game-neon-green font-bold text-xl shadow-lg z-50"
          >
            {displayHiddenTerm.volume === displayKnownTerm.volume ? (
              <span>
                EQUAL VALUES!
                <br />
                <span className="text-sm font-normal">
                  Both answers are correct
                </span>
              </span>
            ) : (
              "CORRECT!"
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game over overlay */}
      <AnimatePresence>
        {showResult && lastGuessCorrect === false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="w-full max-w-2xl mx-4 overflow-hidden"
            >
              {/* Game over header */}
              <div className="bg-game-neon-red/30 border-b-2 border-game-neon-red/50 p-6 text-center rounded-t-2xl">
                <h2 className="text-4xl font-bold text-game-neon-red font-game-fallback">
                  GAME OVER!
                </h2>
                <p className="text-white text-xl mt-2 font-game-fallback">
                  Final score: {currentPlayer?.score || 0}
                </p>
              </div>

              {/* Card comparison section - matches game layout */}
              <div className="bg-black/60 flex flex-col gap-3 p-6">
                {/* Known term card */}
                <div
                  className="rounded-xl overflow-hidden shadow-xl relative"
                  style={{
                    backgroundImage: `url("${displayKnownTerm.imageUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "url(/images/card-pattern.svg)" }}
                  ></div>

                  <div className="relative p-5 flex flex-col md:flex-row items-center justify-between">
                    <h3 className="text-xl font-bold text-white font-game-fallback md:text-left text-center mb-3 md:mb-0">
                      {displayKnownTerm.term}
                    </h3>
                    <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg">
                      <p className="text-sm text-white/70 font-game-fallback">
                        Search Volume
                      </p>
                      <p className="text-xl font-bold text-game-neon-blue font-game-fallback text-center">
                        {displayKnownTerm.volume.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Comparison indicator */}
                <div className="flex items-center justify-center gap-8 my-1">
                  <div className="flex-1 h-px bg-white/20"></div>
                  <div className="bg-game-neon-red/20 border border-game-neon-red/40 rounded-full px-5 py-2 font-bold text-white flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {/* Show what the correct answer would have been */}
                    {(() => {
                      // Use captured terms for comparison
                      const knownVolume = displayKnownTerm.volume;
                      const hiddenVolume = displayHiddenTerm.volume;

                      if (hiddenVolume === knownVolume) {
                        return "EQUAL (either choice is correct)";
                      } else if (hiddenVolume > knownVolume) {
                        return "HIGHER was correct";
                      } else {
                        return "LOWER was correct";
                      }
                    })()}
                  </div>
                  <div className="flex-1 h-px bg-white/20"></div>
                </div>

                {/* Hidden term card */}
                <div
                  className="rounded-xl overflow-hidden shadow-xl relative"
                  style={{
                    backgroundImage: `url("${displayHiddenTerm.imageUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "url(/images/card-pattern.svg)" }}
                  ></div>

                  <div className="relative p-5 flex flex-col md:flex-row items-center justify-between">
                    <h3 className="text-xl font-bold text-white font-game-fallback md:text-left text-center mb-3 md:mb-0">
                      {displayHiddenTerm.term}
                    </h3>
                    <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg">
                      <p className="text-sm text-white/70 font-game-fallback">
                        Search Volume
                      </p>
                      <p className="text-xl font-bold text-game-neon-yellow font-game-fallback text-center">
                        {displayHiddenTerm.volume.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Play again and category buttons */}
              <div className="p-6 bg-black/40 flex justify-center gap-4 rounded-b-2xl border-t border-white/10">
                <button
                  onClick={() => {
                    endGame().then(() => {
                      // Restart the same category instead of going back to category selection
                      const currentCategory = gameState.category;
                      resetGame();
                      // Small delay to ensure state is reset properly
                      setTimeout(() => {
                        startGame(currentCategory);
                      }, 100);
                    });
                  }}
                  className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-green/40 text-game-neon-green font-game-fallback hover:bg-black/80 hover:scale-105 transition-all duration-300"
                >
                  Play Again
                </button>

                <button
                  onClick={() => {
                    endGame().then(() => {
                      resetGame();
                      router.push("/game");
                    });
                  }}
                  className="px-6 py-3 bg-black/40 rounded-xl border border-white/30 text-white font-game-fallback hover:bg-black/80 hover:scale-105 transition-all duration-300"
                >
                  Change Category
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {error && !showResult && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-game-neon-red/20 border border-game-neon-red/50 rounded-lg text-white text-center max-w-xs z-50">
          {error}
        </div>
      )}
    </div>
  );
};

export default GameScreen;
