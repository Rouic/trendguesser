/** @type {import('next').NextConfig} */


const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  // Removed 'export' output to enable API routes
  reactStrictMode: false,
  eslint: {
    dirs: ['src'],
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
  
  // Asset prefix for static assets (when deployed to CDN)
  // assetPrefix: process.env.NODE_ENV === 'production' ? 'https://cdn.yourdomain.com' : '',
  
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
    
    return config;
  },
  
  // Headers to add to all pages
  headers: async () => {
    return [
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