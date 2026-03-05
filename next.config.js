/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig = {
  // Désactivé : provoque AbortError sur Mac lors de la connexion Supabase (double mount)
  reactStrictMode: false,
  swcMinify: true,
  // Configuration des images pour Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'kwqrnyrjzkxwgngbzkkz.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Désactiver l'optimisation pour les images Supabase si nécessaire
    unoptimized: false,
  },
  // Réduire le bruit de la console en production
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // Masquer les warnings non critiques
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Optimisations
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = withPWA(nextConfig);
