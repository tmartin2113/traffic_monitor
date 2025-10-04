/**
 * @file vite.config.ts
 * @description Production-ready Vite configuration
 * @version 3.0.0
 * 
 * FIXES BUG #17: Added console removal plugin for production builds
 */

import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

/**
 * Custom plugin to remove console statements in production
 * More aggressive than esbuild's drop feature
 */
function removeConsolePlugin(): Plugin {
  return {
    name: 'remove-console',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      // Skip node_modules and test files
      if (id.includes('node_modules') || id.includes('.test.') || id.includes('.spec.')) {
        return null;
      }

      // Remove all console.* except console.error
      const transformed = code
        .replace(/console\.(log|debug|info|warn|table|trace|group|groupEnd|groupCollapsed|time|timeEnd|assert|count|countReset|dir|dirxml|profile|profileEnd|clear)\s*\([^)]*\);?/g, '')
        .replace(/console\.(log|debug|info|warn|table|trace|group|groupEnd|groupCollapsed|time|timeEnd|assert|count|countReset|dir|dirxml|profile|profileEnd|clear)\s*\([^)]*\)/g, 'void 0');
      
      return {
        code: transformed,
        map: null
      };
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const devServerPort = parseInt(env.VITE_DEV_SERVER_PORT || '3000', 10);
  const devServerHost = env.VITE_DEV_SERVER_HOST || 'localhost';
  const devServerOpen = env.VITE_DEV_SERVER_OPEN === 'true';
  
  return {
    plugins: [
      react({
        fastRefresh: true,
        babel: {
          plugins: [
            ['@babel/plugin-transform-runtime', { useESModules: true }]
          ]
        }
      }),
      
      legacy({
        targets: ['defaults', 'not IE 11'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        renderLegacyChunks: true,
        polyfills: true
      }),
      
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: '511 Bay Area Traffic Monitor',
          short_name: '511 Traffic',
          description: 'Real-time traffic events and road conditions for Bay Area',
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
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.511\.org\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 5 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'map-tiles-cache',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 30 * 24 * 60 * 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true
        },
        devOptions: {
          enabled: mode === 'development',
          type: 'module'
        }
      }),

      // BUG FIX #17: Remove console statements in production
      ...(mode === 'production' ? [removeConsolePlugin()] : []),
    ],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@services': path.resolve(__dirname, './src/services'),
        '@stores': path.resolve(__dirname, './src/stores'),
        '@types': path.resolve(__dirname, './src/types'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@db': path.resolve(__dirname, './src/db'),
        '@config': path.resolve(__dirname, './src/config'),
        '@adapters': path.resolve(__dirname, './src/adapters')
      }
    },
    
    build: {
      outDir: env.VITE_BUILD_OUTPUT_DIR || 'dist',
      target: ['es2015', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
      sourcemap: env.VITE_BUILD_SOURCEMAP === 'true' || mode === 'development',
      minify: env.VITE_BUILD_MINIFY !== 'false' ? 'terser' : false,
      
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          pure_funcs: mode === 'production' ? ['console.log', 'console.debug'] : []
        },
        format: {
          comments: false
        }
      },
      
      polyfillModulePreload: true,
      assetsInlineLimit: parseInt(env.VITE_BUILD_ASSET_INLINE_LIMIT || '4096', 10),
      chunkSizeWarningLimit: 1000,
      
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'map-vendor': ['leaflet', 'react-leaflet', 'leaflet.markercluster'],
            'data-vendor': ['dexie', 'dexie-react-hooks'],
            'state-vendor': ['zustand', 'valtio'],
            'util-vendor': ['axios', 'date-fns', 'zod']
          },
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/woff2?|ttf|eot/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js'
        }
      },
      
      cssCodeSplit: true,
    },
    
    server: {
      host: devServerHost === 'true' || devServerHost === '0.0.0.0' 
        ? true 
        : devServerHost,
      port: devServerPort,
      strictPort: false, // BUG FIX #12: Allow port fallback
      open: devServerOpen,
      cors: true,
      
      hmr: {
        overlay: true,
      },
      
      watch: {
        ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      },
      
      fs: {
        allow: ['.']
      }
    },
    
    preview: {
      port: devServerPort + 1000,
      strictPort: false,
      host: true,
      cors: true,
      open: devServerOpen
    },
    
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'leaflet',
        'zustand'
      ],
      exclude: ['@vite/client', '@vite/env'],
      esbuildOptions: {
        target: 'es2015'
      }
    },
    
    envPrefix: 'VITE_',
    
    css: {
      modules: {
        localsConvention: 'camelCase'
      },
      postcss: './postcss.config.js',
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`
        }
      },
      devSourcemap: mode === 'development'
    },
    
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/tests/setup.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/tests/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData',
          '**/dist'
        ]
      }
    },
    
    logLevel: mode === 'development' ? 'info' : 'warn',
    clearScreen: true,
    
    // BUG FIX #17: Additional esbuild drop configuration
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      legalComments: 'none',
    }
  };
});
