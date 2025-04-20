import React from 'react';

interface CustomTermInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  error: string | null;
}

const CustomTermInput: React.FC<CustomTermInputProps> = ({ value, onChange, onSubmit, error }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="w-full max-w-md bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-game-neon-blue/30 shadow-neon-blue-sm">
      <h2 className="text-2xl font-display text-game-neon-blue mb-4 text-center">
        CUSTOM TERMS
      </h2>
      
      <p className="text-white mb-6 text-center font-game-fallback">
        Enter any search term to see how it compares with others
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder="Enter a search term"
            className="w-full px-4 py-3 rounded-lg bg-black/60 border border-game-neon-blue/50 text-white font-game-fallback focus:outline-none focus:ring-2 focus:ring-game-neon-blue/70"
            autoFocus
          />
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-game-neon-red/20 border border-game-neon-red/40 rounded-lg text-white text-center">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          className="w-full py-3 bg-game-neon-blue/20 backdrop-blur-sm rounded-lg border border-game-neon-blue/50 text-game-neon-blue font-game-fallback hover:bg-game-neon-blue/30 hover:scale-105 transition-all duration-300 shadow-neon-blue-sm"
        >
          Start Game
        </button>
      </form>
    </div>
  );
};

export default CustomTermInput;