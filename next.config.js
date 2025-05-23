/** @type {import('next').NextConfig} */

// Make bundle analyzer optional to prevent build failures
let withBundleAnalyzer = (config) => config; // Default fallback function
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch (e) {
  console.warn('Bundle analyzer not available, continuing without it');
}

const nextConfig = {
  // Removed 'export' output to enable API routes
  reactStrictMode: true,
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: true,
  },
  experimental: {
    externalDir: true, // Allows importing modules from outside the src directory
  },
  // Environment variables accessible to the client
  env: {
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'trendguesser',
  },
  // Image domains for next/image
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'us-central1-trendguesser.cloudfunctions.net',
        pathname: '/**',
      },
    ],
  },
  
  // Custom webpack configuration
  webpack: (config) => {
    // Audio files
    config.module.rules.push({
      test: /\.(mp3|wav|ogg)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/sounds/[name].[hash][ext]'
      }
    });

    config.resolve.alias = {
      ...config.resolve.alias,
      '@trendguesser/shared': path.resolve(__dirname, '../../packages/shared/src'),
    };
    
    return config;
  },
  
  // Headers to add to all pages
  headers: async () => {
    return [
      {
              // matching all API routes
              source: "/api/:path*",
              headers: [
                  { key: "Access-Control-Allow-Credentials", value: "true" },
                  { key: "Access-Control-Allow-Origin", value: "*" }, // replace this your actual origin
                  { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
                  { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
              ]
          },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);