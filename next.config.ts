import type { NextConfig } from "next";
import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^\/worklets\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'audio-worklets',
        expiration: { maxEntries: 10 }
      }
    }
  ]
});

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {},
};

export default pwaConfig(nextConfig);
