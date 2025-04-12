import React from 'react';
import { SearchCategory } from '@/types';

interface CategorySelectionProps {
  onSelect: (category: SearchCategory) => void;
}

const CategorySelection: React.FC<CategorySelectionProps> = ({ onSelect }) => {
  const categories: { id: SearchCategory; name: string; description: string; color: string }[] = [
    {
      id: 'animals',
      name: 'Animals',
      description: 'From pets to wildlife',
      color: 'border-green-400 text-green-400 shadow-green-sm'
    },
    {
      id: 'celebrities',
      name: 'Celebrities',
      description: 'Stars and famous people',
      color: 'border-pink-400 text-pink-400 shadow-pink-sm'
    },
    {
      id: 'everything',
      name: 'Everything',
      description: 'Mix of all categories',
      color: 'border-purple-400 text-purple-400 shadow-purple-sm'
    },
    {
      id: 'latest',
      name: 'Latest News',
      description: 'Current trending topics',
      color: 'border-yellow-400 text-yellow-400 shadow-yellow-sm'
    },
    {
      id: 'games',
      name: 'Games',
      description: 'Video games & gaming',
      color: 'border-red-400 text-red-400 shadow-red-sm'
    },
    {
      id: 'technology',
      name: 'Technology',
      description: 'Tech & gadgets',
      color: 'border-blue-400 text-blue-400 shadow-blue-sm'
    },
    {
      id: 'questions',
      name: 'Questions',
      description: 'Popular queries',
      color: 'border-orange-400 text-orange-400 shadow-orange-sm'
    },
    {
      id: 'custom',
      name: 'Custom',
      description: 'Choose your own term',
      color: 'border-game-neon-blue text-game-neon-blue shadow-neon-blue-sm'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={`p-4 bg-black/40 backdrop-blur-sm rounded-xl border ${category.color} hover:bg-black/60 hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center text-center h-32`}
        >
          <h3 className="text-xl font-bold mb-1">{category.name}</h3>
          <p className="text-sm opacity-80">{category.description}</p>
        </button>
      ))}
    </div>
  );
};

export default CategorySelection;