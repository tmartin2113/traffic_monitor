import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { comlink } from 'vite-plugin-comlink';

export default defineConfig({
  plugins: [
    react(),
    comlink(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: '511 Bay Area Traffic Monitor',
        short_name: '511 Traffic',
        description: 'Real-time traffic monitoring with differential updates',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        sourcemap: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.511\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60
              }
            }
          }
        ]
      }
    })
  ],
  worker: {
    plugins: [comlink()]
  },
  optimizeDeps: {
    exclude: ['comlink']
  }
});
