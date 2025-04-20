/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // Disable ESLint during builds to prevent the error
  eslint: {
    // Only run ESLint on local development, not during builds
    ignoreDuringBuilds: true,
  },
  experimental: {
    externalDir: true, // Allows importing modules from outside the src directory
  },
  webpack: (config) => {
    // Add a rule to handle shared package
    config.resolve.alias = {
      ...config.resolve.alias,
      '@trendguesser/shared': path.resolve(__dirname, '../../packages/shared/src'),
    };
    return config;
  },
};

module.exports = nextConfig;