import React, { useState, useEffect, useCallback } from "react";
import { SearchCategory } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface CategorySelectionProps {
  onSelect: (category: SearchCategory) => void;
}

interface CategoryScores {
  [category: string]: number;
}

const CategorySelection: React.FC<CategorySelectionProps> = ({ onSelect }) => {
  const { userUid } = useAuth();
  const [highScores, setHighScores] = useState<CategoryScores>({});
  const [loading, setLoading] = useState(true);

  // Create a memoized function to load high scores
  const loadHighScores = useCallback(() => {
    if (typeof window !== "undefined" && userUid) {
      try {
        // Only log in development
        if (process.env.NODE_ENV === "development") {
          console.log(
            "CategorySelection: Loading high scores for user:",
            userUid
          );
        }

        // Try to load high scores from localStorage
        const scoresData = localStorage.getItem(`tg_highscores_${userUid}`);
        if (scoresData) {
          try {
            const scores = JSON.parse(scoresData) as CategoryScores;

            // Only log in development
            if (process.env.NODE_ENV === "development") {
              console.log("Loaded high scores:", scores);
            }

            setHighScores(scores);
          } catch (parseErr) {
            console.error("Error parsing high scores:", parseErr);
            setHighScores({});
          }
        } else {
          // If no localStorage data, try to gather from completed games in sessionStorage
          const scores: CategoryScores = {};

          if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") {
            // In mock mode, collect scores from session storage
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key && key.startsWith("game_")) {
                try {
                  const gameData = JSON.parse(
                    sessionStorage.getItem(key) || "{}"
                  );
                  const gameState = gameData["__trendguesser.state"];
                  const playerData = gameData[userUid];

                  if (
                    gameState?.finished &&
                    gameState?.category &&
                    playerData?.score
                  ) {
                    const category = gameState.category;
                    const score = playerData.score;

                    // Update high score if better than existing
                    if (!scores[category] || score > scores[category]) {
                      scores[category] = score;
                    }
                  }
                } catch (e) {
                  console.error("Error parsing game data for high scores:", e);
                }
              }
            }

            // Save collected scores
            if (Object.keys(scores).length > 0) {
              setHighScores(scores);
              localStorage.setItem(
                `tg_highscores_${userUid}`,
                JSON.stringify(scores)
              );
            }
          }
        }
      } catch (e) {
        console.error("Error loading high scores:", e);
      }

      setLoading(false);
    }
  }, [userUid]);

  // Load high scores when component mounts or userUid changes
  useEffect(() => {
    loadHighScores();
  }, [userUid, loadHighScores]);

  // Listen for storage events to update high scores when they change
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      // If it's a StorageEvent, check if it's the high scores key
      if (
        "key" in event &&
        event.key === `tg_highscores_${userUid}` &&
        typeof window !== "undefined"
      ) {
        loadHighScores();
      } else if (event.type === "storage") {
        // For our custom storage events
        loadHighScores();
      }
    };

    // Add event listener for storage events
    window.addEventListener("storage", handleStorageChange as EventListener);

    return () => {
      // Remove event listener when component unmounts
      window.removeEventListener(
        "storage",
        handleStorageChange as EventListener
      );
    };
  }, [userUid, loadHighScores]);

  // Add playCount with each category to track which ones have been played
  const categories: {
    id: SearchCategory;
    name: string;
    description: string;
    color: string;
  }[] = [
    {
      id: "snacks",
      name: "Snacks",
      description: "Chips, crisps, and sweets",
      color:
        "border-game-neon-yellow text-game-neon-yellow shadow-neon-yellow-sm",
    },
    {
      id: "landmarks",
      name: "Famous Landmarks",
      description: "Famous places & buildings",
      color: "border-game-neon-purple text-game-neon-purple shadow-neon-purple-sm",
    },
    {
      id: "fashion",
      name: "Fashion",
      description: "Trends & styles",
      color: "border-game-neon-red text-game-neon-red shadow-neon-red-sm",
    },
    {
      id: "cars",
      name: "Car Brands",
      description: "Cars & vehicles",
      color: "border-game-neon-blue text-game-neon-blue shadow-neon-blue-sm",
    },
    {
      id: "celebrities",
      name: "Celebrities",
      description: "Famous people & influencers",
      color: "border-game-neon-green text-game-neon-green shadow-neon-green-sm",

    },
    {
      id: "pets",
      name: "Pets",
      description: "Cats, dogs, and more",
      color: "border-game-neon-yellow text-game-neon-yellow shadow-neon-yellow-sm",
    },
    {
      id: "technology",
      name: "Technology",
      description: "Tech & gadgets",
      color: "border-blue-400 text-blue-400 shadow-blue-sm",
    },
    {
      id: "sports",
      name: "Sports",
      description: "Athletes & championships",
      color: "border-green-400 text-green-400 shadow-green-sm",
    },
    {
      id: "everything",
      name: "Everything",
      description: "Mix of all categories",
      color: "border-purple-400 text-purple-400 shadow-purple-sm",
    },
    {
      id: "latest",
      name: "Latest",
      description: "Recent trending topics",
      color: "border-yellow-400 text-yellow-400 shadow-yellow-sm",
    },
    {
      id: "custom",
      name: "Custom",
      description: "Choose your own term",
      color: "border-game-neon-blue text-game-neon-blue shadow-neon-blue-sm",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={`p-4 bg-black/40 backdrop-blur-sm rounded-xl border ${category.color} hover:bg-black/60 hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center h-32 relative`}
        >
          <h3 className="text-xl font-bold mb-1">{category.name}</h3>
          <p className="text-sm opacity-80">{category.description}</p>

          {/* High score badge */}
          {!loading &&
            (highScores[category.id] ? (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20 text-xs flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span>High: {highScores[category.id]}</span>
              </div>
            ) : (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20 text-xs text-gray-400">
                New
              </div>
            ))}
        </button>
      ))}

      {/* Debug buttons - only shown in development */}
      {process.env.NODE_ENV === "development" && (
        <>
          <button
            onClick={() => {
              // Get any stored game data for debugging
              if (typeof window !== "undefined") {
                console.log("======== SESSION STORAGE DEBUG ========");

                // Check for current game ID
                const currentGameId = sessionStorage.getItem("current_game_id");
                console.log("Current game ID:", currentGameId);

                // Check for mock user ID
                const mockUserUid = sessionStorage.getItem("mock_user_uid");
                console.log("Mock user ID:", mockUserUid);

                // List all game data in storage
                const keys = [];
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  if (key && key.startsWith("game_")) {
                    const value = sessionStorage.getItem(key);
                    if (value) {
                      try {
                        const data = JSON.parse(value);
                        const gameState = data["__trendguesser.state"];
                        console.log(`Game data for ${key}:`, {
                          status: data.status,
                          started: gameState?.started,
                          category: gameState?.category,
                          currentRound: gameState?.currentRound,
                          usedTerms: gameState?.usedTerms?.length,
                        });

                        // If this is the current game, show more details
                        if (currentGameId && key === `game_${currentGameId}`) {
                          console.log("Current game details:", gameState);
                        }
                      } catch (e) {
                        console.error("Error parsing game data:", e);
                      }
                    }
                    keys.push(key);
                  }
                }

                if (keys.length === 0) {
                  console.log("No game data in session storage");
                }

                console.log("======================================");

                // If we have a current game ID but no corresponding game data, clear it
                if (
                  currentGameId &&
                  !sessionStorage.getItem(`game_${currentGameId}`)
                ) {
                  console.log("Cleaning up stale game ID reference");
                  sessionStorage.removeItem("current_game_id");
                }
              }
            }}
            className="p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-black/30 text-white/50 flex flex-col items-center justify-center text-center h-32"
          >
            <h3 className="text-xl font-bold mb-1">Debug</h3>
            <p className="text-sm opacity-80">Check session storage</p>
          </button>

          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                // Clear all session storage data
                const gameKeys = [];
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  if (
                    key &&
                    (key.startsWith("game_") ||
                      key === "current_game_id" ||
                      key === "mock_user_uid")
                  ) {
                    gameKeys.push(key);
                  }
                }

                // Remove all game-related keys
                gameKeys.forEach((key) => {
                  sessionStorage.removeItem(key);
                });

                console.log(
                  `Cleared ${gameKeys.length} items from session storage:`,
                  gameKeys
                );

                // Optionally, reload the page to reset all state
                if (
                  confirm(
                    "Session storage cleared. Reload page to reset all application state?"
                  )
                ) {
                  window.location.reload();
                }
              }
            }}
            className="p-4 bg-black/20 backdrop-blur-sm rounded-xl border border-red-500/30 hover:bg-black/30 text-red-400 flex flex-col items-center justify-center text-center h-32"
          >
            <h3 className="text-xl font-bold mb-1">Reset</h3>
            <p className="text-sm opacity-80">Clear session storage</p>
          </button>
        </>
      )}
    </div>
  );
};

export default CategorySelection;
