import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useGame } from "@/contexts/GameContext";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useWindowSize } from "@/hooks/useWindowSize";
import { SearchCategory, TrendGuesserGameState } from "@/types";
import { Timestamp } from "firebase/firestore";
import { TrendGuesserService } from "@/lib/firebase/trendGuesserService";


const GameScreen = () => {
  const router = useRouter();
  const windowSize = useWindowSize();
  const { userUid } = useAuth();
  const {
    gameState,
    gameData,
    currentPlayer,
    gameId,
    makeGuess,
    endGame,
    resetGame,
    startGame,
    setGameState,
    loadHighScores,
    setCurrentPlayer,
    error: gameError,
  } = useGame();

  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(
    null
  );
  const [isGuessing, setIsGuessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);

  const loadedCategoriesInScreen = useRef<Set<string>>(new Set());

  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isInTransition, setIsInTransition] = useState(false);

  // Display any errors from the game context
  useEffect(() => {
    if (gameError) {
      setError(gameError);
    }
  }, [gameError]);

  // Load high scores when component mounts
  useEffect(() => {
    if (
      gameState?.category &&
      !loadedCategoriesInScreen.current.has(gameState.category)
    ) {
      // Only try to load each category once per component instance
      loadedCategoriesInScreen.current.add(gameState.category);

      // Only log in development
      if (process.env.NODE_ENV === "development") {
        console.log(
          "GameScreen: Loading high scores for category:",
          gameState.category
        );
      }

      // Call the original loadHighScores without parameters
      loadHighScores();
    }
  }, [gameState?.category, loadHighScores]);

  // Debug logging for current game state
  useEffect(() => {
    if (gameState) {
      console.log("[GameScreen] Current game state:", {
        gameId,
        started: gameState.started,
        finished: gameState.finished,
        round: gameState.currentRound,
        category: gameState.category,
        knownTerm: gameState.knownTerm.term,
        hiddenTerm: gameState.hiddenTerm.term,
        remainingTerms: gameState.terms.length,
      });
    }
  }, [gameState, gameId]);

  // Attempt to recover from missing game state
  useEffect(() => {
    if (!gameState && !recoveryAttempted) {
      setRecoveryAttempted(true);

      // First, try to recover from localStorage (best source of continuity)
      try {
        if (typeof window !== "undefined") {
          // Find the most recent game ID
          const currentGameId =
            sessionStorage.getItem("current_game_id") || gameId;

          if (currentGameId) {
            // Check if we have local state data for this game
            const storedLocalState = localStorage.getItem(
              `tg_local_state_${currentGameId}`
            );
            if (storedLocalState) {
              console.log("[Recovery] Found local state data in localStorage");

              // Parse the local state
              const localStateStore = JSON.parse(storedLocalState);

              // Find the latest round data
              let latestRound = 0;
              let latestRoundData = null;

              // Find the latest round in our saved data
              Object.keys(localStateStore).forEach((key) => {
                if (key.startsWith("round_")) {
                  const roundNum = parseInt(key.replace("round_", ""));
                  if (roundNum > latestRound) {
                    latestRound = roundNum;
                    latestRoundData = localStateStore[key];
                  }
                }
              });

              if (
                latestRoundData &&
                latestRoundData.knownTerm &&
                latestRoundData.hiddenTerm
              ) {
                console.log(`[Recovery] Found data for round ${latestRound}`);

                // Create a reconstructed game state
                const reconstructedState: TrendGuesserGameState = {
                  currentRound: latestRound,
                  category:
                    latestRoundData.knownTerm.category ||
                    ("technology" as SearchCategory),
                  started: true,
                  finished: false,
                  knownTerm: latestRoundData.knownTerm,
                  hiddenTerm: latestRoundData.hiddenTerm,
                  usedTerms: [
                    latestRoundData.knownTerm.id,
                    latestRoundData.hiddenTerm.id,
                  ],
                  terms: [],
                  customTerm: null,
                };

                // Update the game state in context
                setGameState(reconstructedState);
                console.log(
                  "[Recovery] Successfully reconstructed game state from localStorage"
                );

                return; // Successfully recovered, exit early
              }
            }
          }
        }
      } catch (e) {
        console.error("[Recovery] Error recovering from localStorage:", e);
      }

      // If localStorage recovery fails, try sessionStorage
      if (
        process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" &&
        typeof window !== "undefined"
      ) {
        console.log("Attempting to recover game state from session storage...");

        // Get the current game ID
        const currentGameId =
          sessionStorage.getItem("current_game_id") || gameId;
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
          if (parsedData["__trendguesser.state"]) {
            // We have game state data, let's use it directly
            console.log("[Recovery] Found game state in session storage");
            setGameState(parsedData["__trendguesser.state"]);
            return;
          } else {
            setError("Game not properly initialized. Please start a new game.");
            return;
          }
        } catch (e) {
          console.error("Error recovering game state:", e);
          setError("Error loading game data. Please start a new game.");
        }
      } else {
        setError("Game state not found. Please start a new game.");
      }
    }
  }, [gameState, recoveryAttempted, gameId]);

  // Handle player making a guess
 const handleGuess = async (isHigher: boolean) => {
   // Don't allow guesses during transitions or if already guessing
   if (!gameState || isGuessing || isTransitioning) return;

   // Verify we have valid term data before proceeding
   if (!gameState.knownTerm || !gameState.hiddenTerm) {
     console.error("[handleGuess] Missing term data in game state:", {
       knownTerm: !!gameState.knownTerm,
       hiddenTerm: !!gameState.hiddenTerm,
     });

     // Try to recover from locally stored state or show error
     setError("Missing game data. Please restart the game.");
     return;
   }

   // Lock UI to prevent multiple guesses
   setIsGuessing(true);
   setError(null);

   try {
     console.log(
       `[handleGuess] Making ${isHigher ? "HIGHER" : "LOWER"} guess...`
     );

     // Store the current game state values for comparison
     const currentRound = gameState.currentRound || 1;
     const currentCategory = gameState.category;
     const knownTermName = gameState.knownTerm?.term || "Unknown Term";
     const knownTermVolume = gameState.knownTerm?.volume ?? 0;
     const hiddenTermName = gameState.hiddenTerm?.term || "Unknown Term";
     const hiddenTermVolume = gameState.hiddenTerm?.volume ?? 0;

     console.log(`[handleGuess] Round ${currentRound} comparison:`, {
       category: currentCategory,
       knownTerm: knownTermName,
       knownVolume: knownTermVolume,
       hiddenTerm: hiddenTermName,
       hiddenVolume: hiddenTermVolume,
     });

     // Determine if the guess is correct locally
     const actuallyHigher = hiddenTermVolume > knownTermVolume;
     const actuallyEqual = hiddenTermVolume === knownTermVolume;
     const isCorrect = actuallyEqual ? true : isHigher === actuallyHigher;

     // CRITICAL FIX: Create local copies of current terms that won't be affected by Firebase updates
     // These deep cloned objects will be used for UI rendering during the transition
     const localKnownTerm = JSON.parse(JSON.stringify(gameState.knownTerm));
     const localHiddenTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm));

     // Save these local terms in component state to protect them from external updates
     const localCurrentCategory = gameState.category;

     // Make the guess API call
     let result;
     try {
       result = await makeGuess(isHigher);

       // If Firebase disagrees with our calculation, trust our calculation
       if (result !== isCorrect) {
         console.warn(
           "[handleGuess] API result differs from local calculation - using local result"
         );
         result = isCorrect;
       }
     } catch (err) {
       console.error("[handleGuess] API error, using local calculation:", err);
       result = isCorrect;
     }

     // Show the result to the user
     setLastGuessCorrect(result);
     setShowResult(true);

     // LOCAL STATE HANDLING
     if (result) {
       // Correct guess - Update score locally
       const newScore = (currentPlayer?.score || 0) + 1;
       if (currentPlayer) {
         setCurrentPlayer({
           ...currentPlayer,
           score: newScore,
         });
       }

       // Clear any existing timeout to avoid race conditions
       if (transitionTimeoutRef.current) {
         clearTimeout(transitionTimeoutRef.current);
       }

       // Wait to let user see both cards (3 seconds)
       transitionTimeoutRef.current = setTimeout(() => {
         if (!gameState || gameState.finished) {
           setIsGuessing(false);
           setIsTransitioning(false);
           return;
         }

         console.log("[handleGuess] Starting transition to next round");

         setIsInTransition(true);

         // Begin fadeout animation
         setIsTransitioning(true);

         // Wait for fadeout to complete (600ms)
         setTimeout(() => {
           // Hide the result while cards are invisible
           setShowResult(false);

           // CRITICAL FIX: Create a new game state that preserves the correct category
           // This ensures we don't show terms from the wrong category during transition
           const nextRoundState = {
             ...gameState,
             category: localCurrentCategory, // Preserve the original category
             currentRound: (gameState.currentRound || 1) + 1,
             knownTerm: localHiddenTerm, // Use our local copy of hiddenTerm
           };

           // Prepare next round state with manual term rotation
           const nextState = prepareNextRoundStateWithFixedCategory(
             nextRoundState,
             localCurrentCategory
           );

           // CRITICAL: Log state details for visibility
           console.log("[handleGuess] Updating to next round with state:", {
             category: nextState.category,
             knownTerm: nextState.knownTerm?.term,
             knownVol: nextState.knownTerm?.volume,
             hiddenTerm: nextState.hiddenTerm?.term,
             hiddenVol: nextState.hiddenTerm?.volume,
           });

           // Update game state with prepared next state
           setGameState(nextState);

           // Allow cards to become visible again after brief delay
           setTimeout(() => {
             setLastGuessCorrect(null);
             setIsGuessing(false);
             setIsTransitioning(false);
             setIsInTransition(false);
             console.log(
               "[handleGuess] Transition complete, new round visible"
             );
           }, 50);
         }, 600);
       }, 3000);
     } else {
       // Wrong guess - game over
       // Save high score for incorrect guess
       if (currentPlayer?.score > 0 && gameState.category) {
         try {
           const playerToUse =
             sessionStorage.getItem("mock_user_uid") || userUid;
           if (playerToUse) {
             await TrendGuesserService.updateHighScore(
               playerToUse,
               gameState.category,
               currentPlayer.score
             );
           }
         } catch (e) {
           console.error("Error saving high score during game over:", e);
         }
       }

       // Release the guessing lock after game over delay
       setTimeout(() => {
         setIsGuessing(false);
         setIsTransitioning(false);
       }, 3000);
     }
   } catch (err) {
     console.error("Error in handleGuess:", err);
     setError("Error processing guess. Please try again.");
     setIsGuessing(false);
     setShowResult(false);
     setLastGuessCorrect(null);
     setIsTransitioning(false);
   }
 };

 function prepareNextRoundStateWithFixedCategory(currentState, fixedCategory) {
   // Create deep copy of current state to avoid reference issues
   const updatedState = JSON.parse(JSON.stringify(currentState));

   // CRITICAL: Ensure we use the fixed category, not whatever might be in the current state
   updatedState.category = fixedCategory;

   // Only try to get next term if we have terms available
   if (
     updatedState.terms &&
     Array.isArray(updatedState.terms) &&
     updatedState.terms.length > 0
   ) {
     // Filter terms to only use ones matching our fixed category
     const categoryTerms = updatedState.terms.filter(
       (term) => term.category === fixedCategory
     );

     if (categoryTerms.length > 0) {
       // Get next term from category-filtered terms array
       updatedState.hiddenTerm = JSON.parse(JSON.stringify(categoryTerms[0]));

       // Update terms list to remove the term we just used
       const termIndex = updatedState.terms.findIndex(
         (t) => t.id === categoryTerms[0].id
       );
       if (termIndex !== -1) {
         updatedState.terms = [
           ...updatedState.terms.slice(0, termIndex),
           ...updatedState.terms.slice(termIndex + 1),
         ];
       }
     } else {
       // No terms of the right category - create a fallback term
       updatedState.hiddenTerm = {
         id: `fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
         term: generateTermName(fixedCategory),
         volume: generateRandomVolume(updatedState.knownTerm.volume),
         category: fixedCategory,
         imageUrl: `https://picsum.photos/seed/${fixedCategory}-${Date.now()}/800/600`,
       };

       // Ensure we have a terms array even if empty
       updatedState.terms = updatedState.terms.filter(
         (term) => term.category === fixedCategory
       );
     }

     // Update used terms list
     updatedState.usedTerms = Array.isArray(updatedState.usedTerms)
       ? [...updatedState.usedTerms, updatedState.hiddenTerm.id]
       : [updatedState.knownTerm.id, updatedState.hiddenTerm.id];
   } else {
     // No terms left - we need to create a fallback term in the SAME category
     console.log(
       "[handleGuess] No more terms available, creating fallback term in category:",
       fixedCategory
     );

     updatedState.hiddenTerm = {
       id: `fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
       term: generateTermName(fixedCategory),
       volume: generateRandomVolume(updatedState.knownTerm.volume),
       category: fixedCategory,
       imageUrl: `https://picsum.photos/seed/${fixedCategory}-${Date.now()}/800/600`,
     };

     // Also ensure we have a terms array even if empty
     updatedState.terms = [];
     updatedState.usedTerms = updatedState.usedTerms || [];
     updatedState.usedTerms.push(updatedState.hiddenTerm.id);
   }

   console.log("[handleGuess] Prepared next round state:", {
     category: updatedState.category,
     round: updatedState.currentRound,
     knownTerm: updatedState.knownTerm.term,
     hiddenTerm: updatedState.hiddenTerm.term,
   });

   return updatedState;
 }

  // Helper function to prepare the next round state safely
  function prepareNextRoundState() {
    // Create deep copy of current state to avoid reference issues
    const updatedState = JSON.parse(JSON.stringify(gameState));

    // Increment round counter
    updatedState.currentRound = (updatedState.currentRound || 1) + 1;

    // CRITICAL FIX: We must PRESERVE the current category
    const originalCategory = gameState.category;
    updatedState.category = originalCategory;

    // First, rotate terms LOCALLY (don't rely solely on Firebase)
    // Move hidden term to known term position
    updatedState.knownTerm = JSON.parse(JSON.stringify(gameState.hiddenTerm));

    // Only try to get next term if we have terms available
    if (
      updatedState.terms &&
      Array.isArray(updatedState.terms) &&
      updatedState.terms.length > 0
    ) {
      // Get next term from terms array
      updatedState.hiddenTerm = JSON.parse(
        JSON.stringify(updatedState.terms[0])
      );
      updatedState.terms = updatedState.terms.slice(1);

      // Update used terms list
      updatedState.usedTerms = Array.isArray(updatedState.usedTerms)
        ? [...updatedState.usedTerms, updatedState.hiddenTerm.id]
        : [updatedState.knownTerm.id, updatedState.hiddenTerm.id];
    } else {
      // No terms left - we need to create a fallback term in the SAME category
      console.log(
        "[handleGuess] No more terms available, creating fallback term in category:",
        originalCategory
      );

      updatedState.hiddenTerm = {
        id: `fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        term: generateTermName(originalCategory),
        volume: generateRandomVolume(updatedState.knownTerm.volume),
        category: originalCategory,
        imageUrl: `https://picsum.photos/seed/${originalCategory}-${Date.now()}/800/600`,
      };

      // Also ensure we have a terms array even if empty
      updatedState.terms = [];
      updatedState.usedTerms = updatedState.usedTerms || [];
      updatedState.usedTerms.push(updatedState.hiddenTerm.id);
    }

    console.log("[handleGuess] Prepared next round state:", {
      category: updatedState.category,
      round: updatedState.currentRound,
      knownTerm: updatedState.knownTerm.term,
      hiddenTerm: updatedState.hiddenTerm.term,
    });

    return updatedState;
  }

  // Helper to generate a term name based on category
  function generateTermName(category: string): string {
    const categoryTerms = {
      snacks: [
        "Pretzels",
        "Potato Chips",
        "Chocolate Bar",
        "Cheese Puffs",
        "Trail Mix",
        "Popcorn",
        "Cookies",
      ],
      technology: [
        "Smartphone",
        "Smart Watch",
        "Tablet",
        "Laptop",
        "Drone",
        "Gaming Console",
        "Bluetooth Speaker",
      ],
      sports: [
        "Soccer Ball",
        "Tennis Racket",
        "Golf Clubs",
        "Basketball",
        "Football Helmet",
        "Running Shoes",
      ],
      entertainment: [
        "Movie Ticket",
        "Streaming Service",
        "Concert Ticket",
        "Video Game",
        "Board Game",
      ],
      landmarks: [
        "Eiffel Tower",
        "Statue of Liberty",
        "Great Wall",
        "Colosseum",
        "Taj Mahal",
        "Big Ben",
      ],
      fashion: [
        "Designer Bag",
        "Running Shoes",
        "Dress Shirt",
        "Jeans",
        "Sunglasses",
        "Watch",
        "Sweater",
      ],
    };

    // Get terms for this category or use generic terms
    const terms = categoryTerms[category as keyof typeof categoryTerms] || [
      "Product",
      "Item",
      "Brand",
      "Service",
    ];

    // Pick a random term from the list
    return terms[Math.floor(Math.random() * terms.length)];
  }

  // Helper to generate a realistic volume compared to the known term
  function generateRandomVolume(knownVolume: number): number {
    // Generate a volume that's somewhat realistic compared to the known term
    // Either higher or lower by a reasonable margin (20%-200%)
    const multiplier =
      Math.random() < 0.5
        ? 0.2 + Math.random() * 0.8 // Lower: 20%-100% of known volume
        : 1 + Math.random(); // Higher: 100%-200% of known volume

    return Math.floor(knownVolume * multiplier);
  }

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
    try {
      // Save high score before quitting
      if (currentPlayer && currentPlayer.score > 0 && gameState.category) {
        console.log(
          `Saving high score during quit: ${currentPlayer.score} in ${gameState.category}`
        );
        try {
          // Call static method directly for reliability
          const mockUserUid =
            sessionStorage.getItem("mock_user_uid") || userUid;
          const playerToUse = mockUserUid || userUid;
          if (playerToUse) {
            await TrendGuesserService.updateHighScore(
              playerToUse,
              gameState.category,
              currentPlayer.score
            );
          }
        } catch (e) {
          console.error("Error saving high score during quit:", e);
        }
      }

      // Try Firebase first, then fall back to local navigation
      if (gameId) {
        try {
          // Try to end the game properly in Firebase
          await endGame();
          console.log("Game ended successfully in Firebase during quit");
        } catch (err) {
          console.warn(
            "Error ending game in Firebase during quit, continuing anyway:",
            err
          );
        }
      } else {
        console.warn(
          "No gameId available for quit, using local navigation only"
        );
      }

      // Always reset local state and navigate
      resetGame();
      router.push("/game");
    } catch (err) {
      console.error("Unexpected error during game quit:", err);
      // Final fallback - force a navigation to the game page
      resetGame();
      router.push("/game");
    }
  };

  // No game state - show error
  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
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

  const isDesktop = windowSize.width >= 768;

  return (
    <div className="min-h-screen flex flex-col">
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
      {/* Top bar with score */}
      <div className="p-4 z-10 bg-black/30 backdrop-blur-sm grid grid-cols-3 items-center border-b border-white/10">
        <div className="flex items-center justify-start gap-2 grow lg:shrink">
          <button
            onClick={handleQuit}
            className="px-4 py-1 bg-black/40 rounded-full border border-game-neon-red/30 text-game-neon-red text-sm font-game-fallback hover:bg-black/60"
          >
            QUIT
          </button>
          <span className="text-white/70 font-game-fallback text-sm">
            {(gameState.category || "technology").toUpperCase()}
          </span>
        </div>

        <div className="lg:flex justify-center hidden">
          <h1 className="text-xl font-display text-game-neon-yellow tracking-wider animate-glow font-display-fallback">
            TREND GUESSER
          </h1>
        </div>
        <div className="flex lg:hidden"></div>

        <div className="flex items-center justify-end gap-3">
          <span className="text-white font-game-fallback">SCORE:</span>
          <span className="text-2xl text-game-neon-green font-bold font-game-fallback">
            {currentPlayer?.score || 0}
          </span>

          {/* Show high score if available */}
          {currentPlayer?.highScores &&
          gameState.category &&
          currentPlayer.highScores[gameState.category] ? (
            <span className="text-sm text-white/70 font-game-fallback ml-2">
              HIGH: {currentPlayer.highScores[gameState.category]}
            </span>
          ) : null}
        </div>
      </div>

      {/* Main game container - simplified layout */}
      <div className="flex-1 z-10 grid grid-rows-[1fr_auto_1fr] h-[calc(100vh-64px)]">
        {/* Top card (known term) */}
        <div className="flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg card-transition-wrapper ${
              isTransitioning ? "fade-out" : "fade-in"
            }`}
            id="higher-card"
          >
            <div
              className="w-full rounded-xl overflow-hidden shadow-xl relative h-[250px]"
              style={{
                backgroundImage: `url("${
                  gameState?.knownTerm?.imageUrl || ""
                }")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

              {/* Content */}
              <div className="relative p-4 flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-4 font-game-fallback">
                  {gameState?.knownTerm?.term || "Loading..."}
                </h3>

                <div className="text-center">
                  <p className="text-sm text-white/70 font-game-fallback mb-1">
                    Monthly Search Volume
                  </p>
                  <p className="text-4xl font-bold text-white font-game-fallback font-display">
                    {gameState?.knownTerm?.volume !== undefined
                      ? gameState.knownTerm.volume.toLocaleString()
                      : "..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle ribbon with buttons */}
        <div className="flex items-center justify-center bg-black/70 border-y border-white/10 py-4">
          <div className="flex justify-center items-center gap-6 w-full max-w-md">
            <button
              onClick={() => handleGuess(false)}
              disabled={isGuessing}
              className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-red/70 text-game-neon-red font-bold font-game-fallback text-xl 
      hover:bg-black/90 hover:scale-105 hover:border-game-neon-red hover:shadow-[0_0_15px_rgba(255,0,68,0.5)] 
      active:scale-95 active:bg-black/100 active:shadow-[0_0_20px_rgba(255,0,68,0.7)]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:bg-black/60
      flex-1 max-w-36 text-center transition-all duration-200 ease-in-out"
            >
              LOWER
            </button>

            <button
              onClick={() => handleGuess(true)}
              disabled={isGuessing}
              className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-green/70 text-game-neon-green font-bold font-game-fallback text-xl 
      hover:bg-black/90 hover:scale-105 hover:border-game-neon-green hover:shadow-[0_0_15px_rgba(0,255,85,0.5)] 
      active:scale-95 active:bg-black/100 active:shadow-[0_0_20px_rgba(0,255,85,0.7)]
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:hover:bg-black/60
      flex-1 max-w-36 text-center transition-all duration-200 ease-in-out"
            >
              HIGHER
            </button>
          </div>
        </div>

        {/* Bottom card (hidden term) */}
        <div className="flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg card-transition-wrapper ${
              isTransitioning ? "fade-out" : "fade-in"
            }`}
            id="lower-card"
          >
            <div
              className="w-full rounded-xl overflow-hidden shadow-xl relative h-[250px]"
              style={{
                backgroundImage: `url("${
                  gameState?.hiddenTerm?.imageUrl || ""
                }")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80"></div>

              {/* Content */}
              <div className="relative p-4 flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-4 font-game-fallback">
                  {gameState?.hiddenTerm?.term || "Loading..."}
                </h3>

                {showResult ? (
                  <div className="text-center volume-reveal">
                    <p className="text-sm text-white/70 font-game-fallback mb-1">
                      Monthly Search Volume
                    </p>
                    <p className="text-4xl font-bold text-white font-game-fallback font-display">
                      {gameState?.hiddenTerm?.volume !== undefined
                        ? gameState.hiddenTerm.volume.toLocaleString()
                        : "..."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <p className="text-sm text-white/70 font-game-fallback mb-1">
                      Monthly Search Volume
                    </p>
                    <div className="w-16 h-16 rounded-full border-4 border-game-neon-yellow flex items-center justify-center">
                      <span className="text-3xl font-bold text-game-neon-yellow">
                        ?
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && !showResult && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 bg-game-neon-red/20 border border-game-neon-red/50 rounded-lg text-white text-center max-w-xs z-50">
            {error}
          </div>
        )}
      </div>

      {/* Correct guess notification */}
      {showResult && lastGuessCorrect === true && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-4 bg-game-neon-green/20 backdrop-blur-md rounded-xl border border-game-neon-green/50 text-game-neon-green font-bold text-xl shadow-lg z-50 result-notification correct-guess">
          {gameState.hiddenTerm.volume === gameState.knownTerm.volume ? (
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
        </div>
      )}

      {/* Game over overlay */}
      {showResult && lastGuessCorrect === false && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/5 backdrop-blur-md">
          <div className="w-full max-w-xl mx-4 overflow-hidden">
            {/* Game over header */}
            <div className="bg-game-neon-red/30 border-b-2 border-game-neon-red/50 p-6 text-center rounded-t-2xl">
              <h2 className="text-4xl font-bold text-game-neon-red font-game-fallback">
                GAME OVER!
              </h2>
              <p className="text-white text-xl mt-2 font-game-fallback">
                Final score: {currentPlayer?.score || 0}
              </p>
            </div>

            {/* Card comparison */}
            <div className="bg-black/60 flex flex-col gap-3 p-6">
              {/* Known term card */}
              <div className="rounded-xl overflow-hidden shadow-xl relative p-4 bg-black/40">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-white font-game-fallback">
                    {gameState?.knownTerm?.term || "Loading..."}
                  </h3>
                  <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <p className="text-sm text-white/70 font-game-fallback">
                      Search Volume
                    </p>
                    <p className="text-2xl font-bold text-white font-game-fallback font-display text-center">
                      {gameState?.knownTerm?.volume !== undefined
                        ? gameState.knownTerm.volume.toLocaleString()
                        : "..."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparison indicator */}
              <div className="flex items-center justify-center gap-4 my-1">
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
                    const knownVolume = gameState.knownTerm.volume;
                    const hiddenVolume = gameState.hiddenTerm.volume;

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
              <div className="rounded-xl overflow-hidden shadow-xl relative p-4 bg-black/40">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <h3 className="text-xl font-bold text-white font-game-fallback">
                    {gameState?.hiddenTerm?.term || "Loading..."}
                  </h3>
                  <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <p className="text-sm text-white/70 font-game-fallback">
                      Search Volume
                    </p>
                    <p className="text-2xl font-bold text-white font-game-fallback font-display text-center">
                      {gameState?.hiddenTerm?.volume !== undefined
                        ? gameState.hiddenTerm.volume.toLocaleString()
                        : "..."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Play again and category buttons */}
            <div className="p-6 bg-black/40 flex justify-center gap-4 rounded-b-2xl border-t border-white/10">
              <button
                onClick={() => {
                  const currentCategory = gameState.category;

                  // Try Firebase first, then fall back to local restart
                  if (gameId) {
                    // Save high score first
                    if (
                      currentPlayer &&
                      currentPlayer.score > 0 &&
                      gameState.category
                    ) {
                      console.log(
                        `Saving final score before restart: ${currentPlayer.score} in ${gameState.category}`
                      );
                      try {
                        // Call static method directly for reliability
                        const mockUserUid =
                          sessionStorage.getItem("mock_user_uid") || userUid;
                        const playerToUse = mockUserUid || userUid;
                        if (playerToUse) {
                          TrendGuesserService.updateHighScore(
                            playerToUse,
                            gameState.category,
                            currentPlayer.score
                          ).catch((err) =>
                            console.error(
                              "Error saving final high score for restart:",
                              err
                            )
                          );
                        }
                      } catch (e) {
                        console.error(
                          "Error saving final score before restart:",
                          e
                        );
                      }
                    }

                    // End game in Firebase and then restart with the same category
                    endGame()
                      .then(() => {
                        console.log(
                          "Game ended successfully in Firebase, restarting..."
                        );
                        resetGame();
                        setTimeout(() => {
                          startGame(currentCategory);
                        }, 100);
                      })
                      .catch((err) => {
                        console.warn(
                          "Error ending game in Firebase, falling back to local restart:",
                          err
                        );
                        resetGame();
                        setTimeout(() => {
                          startGame(currentCategory);
                        }, 100);
                      });
                  } else {
                    // No gameId, just restart locally
                    console.warn("No gameId available, using local restart");
                    resetGame();
                    setTimeout(() => {
                      startGame(currentCategory);
                    }, 100);
                  }
                }}
                className="px-8 py-3 bg-black/60 rounded-xl border-2 border-game-neon-green/40 text-game-neon-green font-game-fallback hover:bg-black/80 hover:scale-105 transition-all duration-300"
              >
                Play Again
              </button>

              <button
                onClick={() => {
                  // Try Firebase first, then fall back to local navigation
                  if (gameId) {
                    // Save high score first
                    if (
                      currentPlayer &&
                      currentPlayer.score > 0 &&
                      gameState.category
                    ) {
                      console.log(
                        `Saving final score before changing category: ${currentPlayer.score} in ${gameState.category}`
                      );
                      try {
                        // Call static method directly for reliability
                        const mockUserUid =
                          sessionStorage.getItem("mock_user_uid") || userUid;
                        const playerToUse = mockUserUid || userUid;
                        if (playerToUse) {
                          TrendGuesserService.updateHighScore(
                            playerToUse,
                            gameState.category,
                            currentPlayer.score
                          ).catch((err) =>
                            console.error(
                              "Error saving final high score before changing category:",
                              err
                            )
                          );
                        }
                      } catch (e) {
                        console.error(
                          "Error saving final score before changing category:",
                          e
                        );
                      }
                    }

                    // End game in Firebase and then navigate
                    endGame()
                      .then(() => {
                        console.log(
                          "Game ended successfully in Firebase, navigating..."
                        );
                        resetGame();
                        router.push("/game");
                      })
                      .catch((err) => {
                        console.warn(
                          "Error ending game in Firebase, falling back to local navigation:",
                          err
                        );
                        resetGame();
                        router.push("/game");
                      });
                  } else {
                    // No gameId, just navigate locally
                    console.warn("No gameId available, using local navigation");
                    resetGame();
                    router.push("/game");
                  }
                }}
                className="px-6 py-3 bg-black/40 rounded-xl border border-white/30 text-white font-game-fallback hover:bg-black/80 hover:scale-105 transition-all duration-300"
              >
                Change Category
              </button>
            </div>
          </div>
        </div>
      )}

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
