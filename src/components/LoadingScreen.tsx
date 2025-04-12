import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen bg-game-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 border-t-4 border-game-neon-blue rounded-full animate-spin"></div>
          <div className="absolute inset-3 border-t-4 border-game-neon-pink rounded-full animate-spin-reverse"></div>
        </div>
        
        <h2 className="text-2xl font-display text-game-neon-blue mb-2 animate-pulse">
          {message}
        </h2>
        
        <p className="text-white/70 font-game-fallback text-sm">
          Please wait a moment
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;