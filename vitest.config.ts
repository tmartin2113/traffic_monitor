/**
 * @file vitest.config.ts
 * @description Vitest testing framework configuration
 * @version 1.0.0
 * 
 * Production-ready test configuration with:
 * - Strict coverage thresholds (80% minimum)
 * - JSDOM environment for React components
 * - Global test utilities (describe, it, expect)
 * - Coverage reporting (text, JSON, HTML, LCOV)
 * - Proper exclude patterns
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  test: {
    // Use jsdom for DOM testing
    environment: 'jsdom',
    
    // Make test utilities globally available
    globals: true,
    
    // Setup files to run before tests
    setupFiles: ['./tests/setup.ts'],
    
    // Coverage configuration
    coverage: {
      // Use V8 provider for faster coverage
      provider: 'v8',
      
      // Coverage reporters
      reporter: [
        'text',           // Console output
        'text-summary',   // Summary in console
        'json',           // For programmatic access
        'json-summary',   // Summary in JSON
        'html',           // HTML report in coverage/
        'lcov',           // For CI/CD tools (Codecov, Coveralls)
      ],
      
      // CRITICAL: Minimum coverage thresholds
      // CI/CD will fail if these are not met
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      
      // Files to include in coverage
      include: [
        'src/**/*.{ts,tsx}',
      ],
      
      // Files to exclude from coverage
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types.ts',
        '**/types/*.ts',
        'src/main.tsx',              // Application entry point
        'src/vite-env.d.ts',         // Vite type definitions
        'src/**/*.stories.tsx',      // Storybook stories
        'src/**/index.ts',           // Barrel exports
      ],
      
      // Ensure coverage directory is clean before each run
      clean: true,
      
      // Skip coverage when running in watch mode
      skipFull: false,
      
      // All files in src/ should be covered, even if not imported
      all: true,
    },
    
    // Test file patterns
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
    
    // Files to exclude from test discovery
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      '.git',
      '.cache',
      'build',
    ],
    
    // Test timeout (milliseconds)
    testTimeout: 10000,
    
    // Hook timeouts
    hookTimeout: 10000,
    
    // Fail tests on console.error
    // This ensures no errors slip through in tests
    onConsoleLog: (log, type) => {
      if (type === 'error') {
        throw new Error(`Console error in test: ${log}`);
      }
    },
    
    // Disable console output during tests (cleaner output)
    silent: false,
    
    // Reporters for test results
    reporters: [
      'default',    // Standard console output
      'verbose',    // Detailed test output
    ],
    
    // Enable UI for interactive test running
    ui: true,
    
    // Watch mode configuration
    watch: false,  // Disabled by default (use npm run test for watch)
    
    // Isolation settings
    isolate: true,  // Run each test file in isolation
    
    // Number of threads to use (0 = auto-detect)
    threads: true,
    maxThreads: 4,
    minThreads: 1,
    
    // Pool options
    pool: 'threads',
    
    // Retry failed tests (0 = no retries)
    retry: 0,
    
    // Benchmark configuration (if using benchmarks)
    benchmark: {
      include: ['**/*.bench.{ts,tsx}'],
      exclude: ['node_modules', 'dist'],
    },
  },
  
  // Path resolution (match Vite config)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@config': path.resolve(__dirname, './src/config'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
  
  // Define global constants for tests
  define: {
    'import.meta.env.VITE_511_API_KEY': JSON.stringify('test-api-key'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('https://api.511.org'),
    'import.meta.env.VITE_POLL_INTERVAL': JSON.stringify('60000'),
  },
});
