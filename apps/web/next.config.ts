import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // il motore e' consumato come sorgente TypeScript dal workspace
  transpilePackages: ['@cnl/core'],

  // @cnl/core usa import ESM con estensione esplicita (`./calculate.js`), che e' la
  // forma corretta per un pacchetto ESM: il bundler va istruito a risolverli sui .ts.
  // NB: lo spread va PRIMA, altrimenti la configurazione di Next sovrascrive il nostro '.js'.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
