/**
 * @file vite.config.ts
 * @description Production-ready Vite configuration with enhanced development server
 * @version 2.0.0
 * 
 * PRODUCTION-READY STANDARDS:
 * - Port conflict handling
 * - Optimized build configuration
 * - PWA support
 * - Legacy browser support
 * - Source maps and chunking
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  // Parse environment variables with defaults
  const devServerPort = parseInt(env.VITE_DEV_SERVER_PORT || '3000', 10);
  const devServerHost = env.VITE_DEV_SERVER_HOST || 'localhost';
  const devServerOpen = env.VITE_DEV_SERVER_OPEN === 'true';
  
  return {
    plugins: [
      react({
        // Fast refresh for better DX
        fastRefresh: true,
        // Babel plugins for optimization
        babel: {
          plugins: [
            ['@babel/plugin-transform-runtime', { useESModules: true }]
          ]
        }
      }),
      
      // Legacy browser support
      legacy({
        targets: ['defaults', 'not IE 11'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
        renderLegacyChunks: true,
        polyfills: true
      }),
      
      // PWA configuration
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
                  maxAgeSeconds: 5 * 60 // 5 minutes
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
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
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
      })
    ],
    
    // Path resolution
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
        '@config': path.resolve(__dirname, './src/config')
      }
    },
    
    // Build configuration
    build: {
      // Output directory
      outDir: env.VITE_BUILD_OUTPUT_DIR || 'dist',
      
      // Target browsers
      target: ['es2015', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
      
      // Generate source maps
      sourcemap: env.VITE_BUILD_SOURCEMAP === 'true' || mode === 'development',
      
      // Minification
      minify: env.VITE_BUILD_MINIFY !== 'false' ? 'terser' : false,
      
      // Terser options for better minification
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
      
      // Polyfill for dynamic imports
      polyfillModulePreload: true,
      
      // Asset inline limit
      assetsInlineLimit: parseInt(env.VITE_BUILD_ASSET_INLINE_LIMIT || '4096', 10),
      
      // Chunk size warnings
      chunkSizeWarningLimit: 1000,
      
      // Rollup options for code splitting
      rollupOptions: {
        output: {
          // Manual chunks for better caching
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'map-vendor': ['leaflet', 'react-leaflet', 'leaflet.markercluster'],
            'data-vendor': ['dexie', 'dexie-react-hooks'],
            'state-vendor': ['zustand', 'valtio'],
            'util-vendor': ['axios', 'date-fns', 'zod']
          },
          // Asset file naming
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
          // Chunk file naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          // Entry file naming
          entryFileNames: 'assets/js/[name]-[hash].js'
        }
      },
      
      // Enable/disable CSS code splitting
      cssCodeSplit: true,
      
      // Rollup external dependencies (don't bundle these)
      // Uncomment if you want to exclude certain packages
      // rollupOptions: {
      //   external: ['some-large-dependency']
      // }
    },
    
    // Development server configuration
    server: {
      // Host configuration
      host: devServerHost === 'true' || devServerHost === '0.0.0.0' ? true : devServerHost,
      
      // Port with fallback handling
      port: devServerPort,
      
      // CRITICAL FIX: Allow automatic port selection if specified port is taken
      strictPort: false,
      
      // Open browser automatically
      open: devServerOpen,
      
      // CORS configuration
      cors: true,
      
      // HMR (Hot Module Replacement) configuration
      hmr: {
        overlay: true,
        // Uncomment if using custom HMR port
        // port: devServerPort + 1
      },
      
      // Proxy configuration for API requests (optional)
      // Useful for avoiding CORS during development
      proxy: {
        // Example: Proxy /api requests to 511.org
        // '/api': {
        //   target: 'https://api.511.org',
        //   changeOrigin: true,
        //   rewrite: (path) => path.replace(/^\/api/, ''),
        //   configure: (proxy, _options) => {
        //     proxy.on('error', (err, _req, _res) => {
        //       console.log('proxy error', err);
        //     });
        //     proxy.on('proxyReq', (proxyReq, req, _res) => {
        //       console.log('Sending Request to the Target:', req.method, req.url);
        //     });
        //     proxy.on('proxyRes', (proxyRes, req, _res) => {
        //       console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
        //     });
        //   }
        // }
      },
      
      // Watch options
      watch: {
        // Ignore node_modules for better performance
        ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**']
      },
      
      // File system access restrictions for security
      fs: {
        // Allow serving files from parent directories (if needed)
        // strict: false,
        // Allowed directories
        allow: ['.']
      }
    },
    
    // Preview server configuration (for production builds)
    preview: {
      port: devServerPort + 1000,
      strictPort: false,
      host: true,
      cors: true,
      open: devServerOpen
    },
    
    // Optimization configuration
    optimizeDeps: {
      // Force pre-bundling of these dependencies
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'leaflet',
        'zustand'
      ],
      // Exclude these from optimization
      exclude: ['@vite/client', '@vite/env'],
      // Enable esbuild optimization
      esbuildOptions: {
        target: 'es2015'
      }
    },
    
    // Environment variable prefix
    envPrefix: 'VITE_',
    
    // CSS configuration
    css: {
      // CSS modules configuration
      modules: {
        localsConvention: 'camelCase'
      },
      // PostCSS configuration (reads from postcss.config.js)
      postcss: './postcss.config.js',
      // Preprocessor options
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`
        }
      },
      // Enable CSS source maps in development
      devSourcemap: mode === 'development'
    },
    
    // Test configuration (if using Vitest)
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
    
    // Logging level
    logLevel: mode === 'development' ? 'info' : 'warn',
    
    // Clear screen on reload
    clearScreen: true
  };
});
