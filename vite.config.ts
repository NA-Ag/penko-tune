import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          manifestFilename: 'manifest.json',
          includeAssets: ['penguin-tune-logo.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
          manifest: {
            name: "Penko Tune",
            short_name: "Tune",
            description: "Privacy-focused music player with 10-band EQ, visualizers, and YouTube streaming.",
            start_url: "./",
            display: "standalone",
            background_color: "#09090b",
            theme_color: "#06b6d4",
            icons: [
              {
                src: "./penguin-tune-logo.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any maskable"
              },
              {
                src: "./pwa-192x192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any maskable"
              },
              {
                src: "./pwa-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable"
              }
            ]
          }
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'bittorrent-dht': path.resolve(__dirname, 'utils/bittorrent-dht-mock.ts'),
        }
      },
      define: {
        global: 'window',
      },
    };
});
