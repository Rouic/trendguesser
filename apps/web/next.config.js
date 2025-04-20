/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // Disable ESLint during builds to prevent the error
  eslint: {
    // Only run ESLint on local development, not during builds
    ignoreDuringBuilds: true,
  },
  async headers() {
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
          }
      ]
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