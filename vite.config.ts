import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        tailwindcss(),
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          manifestFilename: 'manifest.json',
          // Streams decrypted share-link audio to the player (see public/share-sw.js)
          workbox: {
            importScripts: ['share-sw.js'],
            navigateFallbackDenylist: [/__penko_share/],
          },
          includeAssets: ['favicon.svg', 'penko-tune-logo.svg', 'apple-touch-icon.png'],
          manifest: {
            name: "Penko Tune",
            short_name: "Penko Tune",
            description: "Privacy-focused music player with 10-band EQ, visualizers, and peer-to-peer sharing.",
            start_url: "./",
            display: "standalone",
            background_color: "#0f172a",
            theme_color: "#0f172a",
            categories: ["music", "entertainment"],
            icons: [
              { src: "./pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
              { src: "./pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
              // Tile has 5px padding on a 26px canvas, safe for maskable cropping
              { src: "./pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              { src: "./penko-tune-logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
            ]
          }
        })
      ],
      resolve: {
        alias: [
          { find: '@', replacement: path.resolve(__dirname, '.') },
          // Node-only modules pulled in by webtorrent that Vite would otherwise externalize to empty stubs
          { find: 'bittorrent-dht', replacement: path.resolve(__dirname, 'utils/bittorrent-dht-mock.ts') },
          { find: /^path$/, replacement: 'path-browserify' },
        ]
      },
      define: {
        global: 'window',
      },
    };
});
