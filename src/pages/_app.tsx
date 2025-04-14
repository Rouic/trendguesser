import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { ConsentProvider } from "../contexts/ConsentContext";
import { AuthProvider } from "../contexts/AuthContext";
import { GameProvider } from "../contexts/GameContext";
import { initializeFirebase } from "../lib/firebase/firebase";

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const canonicalUrl = `https://trendguesser.com${router.asPath === "/" ? "" : router.asPath}`;
  
  // Initialize Firebase immediately, not in useEffect
  // This ensures Firebase is available before any components mount
  if (typeof window !== 'undefined') {
    const { app, auth, db } = initializeFirebase(true, false);
    console.log("Firebase initialized in _app.tsx");
  }
  
  // Load fonts
  useEffect(() => {
    // Load Oswald font for game-style text
    const linkOswald = document.createElement('link');
    linkOswald.rel = 'stylesheet';
    linkOswald.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;700&display=swap';
    document.head.appendChild(linkOswald);
    
    // Load Press Start 2P for title/display text
    const linkPressStart = document.createElement('link');
    linkPressStart.rel = 'stylesheet';
    linkPressStart.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
    document.head.appendChild(linkPressStart);
    
    return () => {
      document.head.removeChild(linkOswald);
      document.head.removeChild(linkPressStart);
    };
  }, []);
  
  return (
    <ConsentProvider>
      <AuthProvider>
        <GameProvider>
          <Head>
            {/* Primary Meta Tags */}
            <title>TrendGuesser - the higher or lower game</title>
            <meta
              name="description"
              content="TrendGuesser - the higher or lower game"
            />
            <meta
              name="keywords"
              content="trendguesser, higher or lower, game, single player, trending, search, game"
            />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1, maximum-scale=5"
            />

            {/* Canonical URL */}
            <link rel="canonical" href={canonicalUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:url" content={canonicalUrl} />
            <meta
              property="og:title"
              content="TrendGuesser - the higher or lower game"
            />
            <meta
              property="og:description"
              content="TrendGuesser - the higher or lower game"
            />
            <meta
              property="og:image"
              content="https://trendguesser.com/images/social-cover.png"
            />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:site_name" content="Trend Guesser" />
            <meta property="og:locale" content="en_US" />

            {/* Twitter */}
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={canonicalUrl} />
            <meta
              property="twitter:title"
              content="Trend Guesser - Higher or Lower Search Trending Game"
            />
            <meta
              property="twitter:description"
              content="TrendGuesser - the higher or lower game"
            />
            <meta
              property="twitter:image"
              content="https://trendguesser.com/images/social-cover.png"
            />

            {/* Favicon and icons */}
            <link rel="icon" href="/favicon.ico" />

            {/* Preload fonts */}
            <link
              rel="preload"
              href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;700&display=swap"
              as="style"
            />
            <link
              rel="preload"
              href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
              as="style"
            />
          </Head>
          <Component {...pageProps} />
        </GameProvider>
      </AuthProvider>
    </ConsentProvider>
  );
}

export default MyApp;
