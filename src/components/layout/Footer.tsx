// src/components/layout/Footer.tsx
import React from "react";
import Link from "next/link";

interface FooterProps {
  mini?: boolean;
}

const Footer: React.FC<FooterProps> = ({mini = false}) => {

  // App version from environment or default
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "v1.0.0";

  if(mini) {
    return (
      <div className="flex flex-col justify-between items-center">
      <Link href="/" className="flex justify-center lg:hidden">
        <h1 className="text-md font-display text-game-neon-yellow/20 hover:text-game-neon-yellow tracking-wider animate-glow font-display-fallback">
          TREND GUESSER
        </h1>
      </Link>
       <Link
            href="https://github.com/Rouic/trendguesser"
            target="_blank"
            rel="noreferrer"
            className=" text-xs mt-4 text-game-neon-yellow/50 font-display-fallback hover:text-game-neon-yellow transition duration-200"
          >
            v{appVersion}
          </Link>
      </div>
    );
  }


  return (
    <footer className="py-4 px-6 mt-auto z-30 rounded-lg">
      <div className="container mx-auto">
        <div className="flex flex-col justify-between items-center">
          {/* Footer links */}
          <nav className="mb-4 md:mb-0">
            <ul className="flex flex-wrap gap-4 justify-center md:justify-start font-game-fallback">
              <li>
                <Link
                  href="/game"
                  className="text-white/40 hover:text-white transition duration-200"
                >
                  New Game
                </Link>
              </li>
              <li>
                <Link
                  href="/leaderboard"
                  className="text-white/40 hover:text-white transition duration-200"
                >
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-white/40 hover:text-white transition duration-200"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/40 hover:text-white transition duration-200"
                >
                  Privacy
                </Link>
              </li>
            </ul>
          </nav>

          {/* Copyright */}
          <Link
            href="https://github.com/Rouic/trendguesser"
            target="_blank"
            rel="noreferrer"
            className=" text-xs mt-4 text-game-neon-yellow/50 font-display-fallback hover:text-game-neon-yellow transition duration-200"
          >
            v{appVersion}
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
