import { SearchCategory } from '../types';

export interface CategoryConfig {
  id: SearchCategory;
  name: string;
  description: string;
  // Web-specific styling (Tailwind classes)
  webStyles: {
    color: string;
    borderColor: string;
    shadowColor: string;
  };
  // Mobile-specific styling (React Native color values)
  mobileStyles: {
    backgroundColor: string;
    textColor: string;
    borderColor: string;
  };
  enabled: boolean; // Whether this category should be shown
  order: number; // Display order (lower numbers first)
}

export const categories: CategoryConfig[] = [
  {
    id: "snacks",
    name: "Snacks",
    description: "Chips, crisps, and sweets",
    webStyles: {
      color: "text-game-neon-yellow",
      borderColor: "border-game-neon-yellow",
      shadowColor: "shadow-neon-yellow-sm",
    },
    mobileStyles: {
      backgroundColor: "#FFCC00",
      textColor: "#FFFFFF",
      borderColor: "#FFCC00",
    },
    enabled: true,
    order: 1
  },
  {
    id: "landmarks",
    name: "Landmarks",
    description: "Famous places & buildings",
    webStyles: {
      color: "text-game-neon-red",
      borderColor: "border-game-neon-red",
      shadowColor: "shadow-neon-red-sm",
    },
    mobileStyles: {
      backgroundColor: "#9932fc",
      textColor: "#FFFFFF",
      borderColor: "#9932fc",
    },
    enabled: true,
    order: 2
  },
  {
    id: "technology",
    name: "Technology",
    description: "Tech & gadgets",
    webStyles: {
      color: "text-blue-400",
      borderColor: "border-blue-400",
      shadowColor: "shadow-blue-sm",
    },
    mobileStyles: {
      backgroundColor: "#3b82f6",
      textColor: "#FFFFFF",
      borderColor: "#3b82f6",
    },
    enabled: true,
    order: 3
  },
  {
    id: "sports",
    name: "Sports",
    description: "Athletes & championships",
    webStyles: {
      color: "text-green-400",
      borderColor: "border-green-400",
      shadowColor: "shadow-green-sm",
    },
    mobileStyles: {
      backgroundColor: "#4ade80",
      textColor: "#FFFFFF",
      borderColor: "#4ade80",
    },
    enabled: true,
    order: 4
  },
   {
    id: "hands",
    name: "Health & Safety",
    description: "Test your knowledge on health and safety",
    webStyles: {
      color: "text-indigo-400",
      borderColor: "border-indigo-400",
      shadowColor: "shadow-indigo-sm",
    },
    mobileStyles: {
      backgroundColor: "#4ade80",
      textColor: "#FFFFFF",
      borderColor: "#4ade80",
    },
    enabled: false,
    order: 5
  },
  {
    id: "entertainment",
    name: "Entertainment",
    description: "Movies, music & events",
    webStyles: {
      color: "text-pink-400",
      borderColor: "border-pink-400",
      shadowColor: "shadow-pink-sm",
    },
    mobileStyles: {
      backgroundColor: "#ec4899",
      textColor: "#FFFFFF",
      borderColor: "#ec4899",
    },
    enabled: false, // Disabled by default, can be enabled later
    order: 6
  },
//   {
//     id: "fashion",
//     name: "Fashion",
//     description: "Trends & styles",
//     webStyles: {
//       color: "text-game-neon-red",
//       borderColor: "border-game-neon-red",
//       shadowColor: "shadow-neon-red-sm",
//     },
//     mobileStyles: {
//       backgroundColor: "#FF3366",
//       textColor: "#FFFFFF",
//       borderColor: "#FF3366",
//     },
//     enabled: false,
//     order: 7
//   },
//   {
//     id: "cars",
//     name: "Car Brands",
//     description: "Cars & vehicles",
//     webStyles: {
//       color: "text-game-neon-blue",
//       borderColor: "border-game-neon-blue",
//       shadowColor: "shadow-neon-blue-sm",
//     },
//     mobileStyles: {
//       backgroundColor: "#00DDFF",
//       textColor: "#FFFFFF",
//       borderColor: "#00DDFF",
//     },
//     enabled: false,
//     order: 8
//   },
//   {
//     id: "celebrities",
//     name: "Celebrities",
//     description: "Famous people & influencers",
//     webStyles: {
//       color: "text-game-neon-green",
//       borderColor: "border-game-neon-green",
//       shadowColor: "shadow-neon-green-sm",
//     },
//     mobileStyles: {
//       backgroundColor: "#00FF99",
//       textColor: "#FFFFFF",
//       borderColor: "#00FF99",
//     },
//     enabled: false,
//     order: 9
//   },
//   {
//     id: "pets",
//     name: "Pets",
//     description: "Cats, dogs, and more",
//     webStyles: {
//       color: "text-game-neon-yellow",
//       borderColor: "border-game-neon-yellow",
//       shadowColor: "shadow-neon-yellow-sm",
//     },
//     mobileStyles: {
//       backgroundColor: "#FFCC00",
//       textColor: "#FFFFFF",
//       borderColor: "#FFCC00",
//     },
//     enabled: false,
//     order: 10
//   },
//   {
//     id: "latest",
//     name: "Latest",
//     description: "Recent trending topics",
//     webStyles: {
//       color: "text-yellow-400",
//       borderColor: "border-yellow-400",
//       shadowColor: "shadow-yellow-sm",
//     },
//     mobileStyles: {
//       backgroundColor: "#facc15",
//       textColor: "#FFFFFF",
//       borderColor: "#facc15",
//     },
//     enabled: false,
//     order: 11
//   },
//   {
//     id: "custom",
//     name: "Custom",
//     description: "Choose your own term",
//     webStyles: {
//       color: "text-game-neon-blue",
//       borderColor: "border-game-neon-blue",
//       shadowColor: "shadow-neon-blue-sm",
//     },
//     mobileStyles: {
//       backgroundColor: "#3b82f6",
//       textColor: "#FFFFFF",
//       borderColor: "#3b82f6",
//     },
//     enabled: true,
//     order: 12
//   },
//   {
//     id: "general",
//     name: "General",
//     description: "All-purpose topics",
//     webStyles: {
//       color: "text-gray-400",
//       borderColor: "border-gray-400",
//       shadowColor: "shadow-gray-sm",
//     },
//     mobileStyles: {
//       backgroundColor: "#9ca3af",
//       textColor: "#FFFFFF",
//       borderColor: "#9ca3af",
//     },
//     enabled: true,
//     order: 13
//   }
];

// Helper functions for filtering and sorting categories
export const getEnabledCategories = (): CategoryConfig[] => {
  return categories
    .filter(cat => cat.enabled)
    .sort((a, b) => a.order - b.order);
};

// Get a category by ID
export const getCategoryById = (id: SearchCategory): CategoryConfig | undefined => {
  return categories.find(cat => cat.id === id);
};

// Get a complete class string for web styling
export const getWebCategoryClasses = (category: CategoryConfig): string => {
  return `${category.webStyles.borderColor} ${category.webStyles.color} ${category.webStyles.shadowColor}`;
};