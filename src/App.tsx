/**
 * @file App.tsx
 * @description Main application component with comprehensive error boundary integration
 * @version 2.1.0 - FIXED ALL BUGS
 * 
 * PRODUCTION-READY STANDARDS:
 * - Complete error boundary coverage for all critical sections
 * - Isolated error boundaries prevent cascade failures
 * - Proper error recovery mechanisms
 * - Development vs Production error display
 * 
 * FIXES APPLIED:
 * - Bug #1: Fixed import from './config/env' (not 'environment')
 * - Bug #2: Corrected ErrorBoundary component import path
 * - Bug #4: Updated ErrorBoundary props to match actual interface
 * - Bug #5: Fixed lazy-loaded component imports
 */

import React, { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { envConfig } from './config/env';

// Lazy load heavy components
const TrafficMap = lazy(() => import('./components/TrafficMap/TrafficMap'));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const FilterPanel = lazy(() => import('./components/FilterPanel/FilterPanel'));

/**
 * React Query Client Configuration
 * 
 * SECURITY NOTE: Queries are disabled by default on window focus
 * to prevent unnecessary API calls that could expose the API key
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      onError: (error) => {
        console.error('Query Error:', error);
      }
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation Error:', error);
      }
    }
  }
});

/**
 * Loading Fallback Component
 */
const LoadingFallback: React.FC<{ message?: string }> = ({ 
  message = 'Loading...' 
}) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600 text-lg">{message}</p>
    </div>
  </div>
);

/**
 * Main App Component with Comprehensive Error Handling
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary
      level="app"
      onError={(error, errorInfo) => {
        // Root level error logging
        console.error('Root Application Error:', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        });
      }}
    >
      <QueryClientProvider client={queryClient}>
        {/* React Query Devtools - Development Only */}
        {envConfig.isDevelopment() && (
          <ReactQueryDevtools 
            initialIsOpen={false}
            position="bottom-right"
          />
        )}

        <div className="app-container">
          {/* Header Section with Isolated Error Boundary */}
          <ErrorBoundary
            level="section"
            fallback={
              <div className="bg-red-50 border-b border-red-200 p-4">
                <p className="text-red-700 text-sm">
                  Header failed to load. Main application continues below.
                </p>
              </div>
            }
          >
            <Suspense fallback={<LoadingFallback message="Loading header..." />}>
              <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-4">
                  <h1 className="text-2xl font-bold text-gray-900">
                    511 Bay Area Traffic Monitor
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Real-time traffic events and road conditions
                  </p>
                </div>
              </header>
            </Suspense>
          </ErrorBoundary>

          {/* Main Content Area */}
          <main className="flex-1 overflow-hidden">
            <div className="h-full flex flex-col lg:flex-row">
              {/* Filter Panel with Isolated Error Boundary */}
              <ErrorBoundary
                level="section"
                fallback={
                  <aside className="w-full lg:w-80 bg-gray-50 border-r border-gray-200 p-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-yellow-800 text-sm">
                        ⚠️ Filters unavailable. Using default settings.
                      </p>
                    </div>
                  </aside>
                }
              >
                <Suspense fallback={<LoadingFallback message="Loading filters..." />}>
                  <aside className="w-full lg:w-80 bg-white border-r border-gray-200">
                    <FilterPanel />
                  </aside>
                </Suspense>
              </ErrorBoundary>

              {/* Map Section with Isolated Error Boundary */}
              <ErrorBoundary
                level="section"
                resetKeys={['map-section']}
                onError={(error) => {
                  console.error('Map Error - May be recoverable:', error);
                }}
                fallback={
                  <div className="flex-1 flex items-center justify-center bg-gray-100">
                    <div className="text-center p-8">
                      <div className="text-6xl mb-4">🗺️</div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Map Unavailable
                      </h2>
                      <p className="text-gray-600 mb-4">
                        The traffic map could not be loaded. This may be due to:
                      </p>
                      <ul className="text-left text-sm text-gray-600 mb-4 max-w-md mx-auto">
                        <li>• Network connectivity issues</li>
                        <li>• Browser compatibility problems</li>
                        <li>• Temporary service disruption</li>
                      </ul>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Reload Application
                      </button>
                    </div>
                  </div>
                }
              >
                <Suspense fallback={<LoadingFallback message="Loading map..." />}>
                  <div className="flex-1 relative">
                    <TrafficMap />
                  </div>
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>

          {/* Dashboard Section with Isolated Error Boundary */}
          <ErrorBoundary
            level="section"
            fallback={
              <div className="border-t border-gray-200 bg-gray-50 p-4">
                <p className="text-gray-600 text-sm text-center">
                  Dashboard statistics unavailable
                </p>
              </div>
            }
          >
            <Suspense fallback={<LoadingFallback message="Loading dashboard..." />}>
              <section className="border-t border-gray-200 bg-white">
                <Dashboard />
              </section>
            </Suspense>
          </ErrorBoundary>

          {/* Footer with Basic Error Boundary */}
          <ErrorBoundary level="section">
            <footer className="bg-gray-800 text-white py-6">
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center">
                  <div className="mb-4 md:mb-0">
                    <p className="text-sm">
                      © 2025 511 Bay Area Traffic Monitor
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Data provided by 511.org API
                    </p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <a 
                      href="https://511.org" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-blue-400 transition-colors"
                    >
                      511.org
                    </a>
                    <a 
                      href="https://511.org/privacy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-blue-400 transition-colors"
                    >
                      Privacy Policy
                    </a>
                    <a 
                      href="https://511.org/terms" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-blue-400 transition-colors"
                    >
                      Terms of Service
                    </a>
                  </div>
                </div>
              </div>
            </footer>
          </ErrorBoundary>
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
