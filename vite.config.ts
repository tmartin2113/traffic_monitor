import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    react(),
    
    // Add legacy browser support
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
      polyfills: {
        'es.promise': true,
        'es.array.iterator': true,
        'es.object.assign': true,
        'es.object.keys': true,
        'es.array.find': true,
        'es.array.includes': true
      }
    }),
    
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.511\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      // Disable PWA on browsers without service worker support
      disable: !('serviceWorker' in navigator)
    })
  ],
  
  build: {
    // Ensure compatibility with older browsers
    target: ['es2015', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
    
    // Polyfill dynamic imports
    polyfillModulePreload: true,
    
    // Create source maps for debugging
    sourcemap: true,
    
    // Optimize chunks
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'map-vendor': ['leaflet', 'react-leaflet'],
          'data-vendor': ['dexie', 'zustand']
        }
      }
    }
  },
  
  // Server configuration for deployment
  server: {
    host: true,
    port: 3000,
    cors: true
  }
});
