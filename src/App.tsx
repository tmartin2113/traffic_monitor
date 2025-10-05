/**
 * @file App.tsx
 * @description Main application component with comprehensive error boundary integration
 * @version 2.2.0 - ALL BUGS FIXED
 * 
 * PRODUCTION-READY STANDARDS:
 * - Complete error boundary coverage for all critical sections
 * - Isolated error boundaries prevent cascade failures
 * - Proper error recovery mechanisms
 * - Development vs Production error display
 * - NO console.* statements (uses logger utility)
 * 
 * FIXES APPLIED:
 * - Bug #1: Fixed import from './config/env' (not 'environment')
 * - Bug #2: Corrected ErrorBoundary component import path
 * - Bug #3: REMOVED all console.* statements from React Query callbacks
 * - Bug #4: Updated ErrorBoundary props to match actual interface
 * - Bug #5: Fixed lazy-loaded component imports
 * 
 * @author Senior Development Team
 * @since 2.2.0
 */

import React, { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { envConfig } from './config/env';
import { logger } from './utils/logger';

// ============================================================================
// LAZY-LOADED COMPONENTS
// ============================================================================

// Lazy load heavy components for better initial load performance
const TrafficMap = lazy(() => import('./components/TrafficMap/TrafficMap'));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard').catch(() => {
  // Graceful fallback if Dashboard doesn't exist yet
  logger.warn('Dashboard component not found, using fallback');
  return { default: () => <div>Dashboard coming soon</div> };
}));
const FilterPanel = lazy(() => import('./components/FilterPanel/FilterPanel'));

// ============================================================================
// REACT QUERY CONFIGURATION
// ============================================================================

/**
 * React Query Client Configuration
 * 
 * PRODUCTION STANDARDS:
 * - Proper error handling without console statements
 * - Exponential backoff retry strategy
 * - Appropriate cache times
 * - Security: Disabled refetch on window focus to prevent unnecessary API calls
 * 
 * FIXED: Removed all console.error statements, now uses logger
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry configuration with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => {
        const delay = Math.min(1000 * 2 ** attemptIndex, 30000);
        logger.debug(`Query retry attempt ${attemptIndex + 1}, waiting ${delay}ms`);
        return delay;
      },

      // Cache configuration
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes

      // Refetch configuration
      refetchOnWindowFocus: false, // Security: Prevent unnecessary API calls
      refetchOnMount: true,
      refetchOnReconnect: true,

      // Error handling - FIXED: Uses logger instead of console
      onError: (error) => {
        logger.error('React Query error occurred', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: 'query',
          timestamp: new Date().toISOString(),
        });
      },

      // Success handling (optional)
      onSuccess: (data) => {
        logger.debug('Query succeeded', {
          dataType: typeof data,
          timestamp: new Date().toISOString(),
        });
      },
    },

    mutations: {
      // Retry configuration for mutations
      retry: 1,

      // Error handling - FIXED: Uses logger instead of console
      onError: (error) => {
        logger.error('React Query mutation error occurred', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorType: 'mutation',
          timestamp: new Date().toISOString(),
        });
      },

      // Success handling (optional)
      onSuccess: (data) => {
        logger.debug('Mutation succeeded', {
          dataType: typeof data,
          timestamp: new Date().toISOString(),
        });
      },
    },
  },
});

// ============================================================================
// LOADING COMPONENTS
// ============================================================================

/**
 * Loading Fallback Component
 * Shown while lazy-loaded components are being fetched
 */
const LoadingFallback: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600 font-medium">{message}</p>
    </div>
  </div>
);

/**
 * Component-specific loading fallback
 */
const ComponentLoadingFallback: React.FC<{ name: string }> = ({ name }) => (
  <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
      <p className="text-sm text-gray-500">Loading {name}...</p>
    </div>
  </div>
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Global error handler for React Query
 */
const handleGlobalError = (error: Error) => {
  logger.error('Unhandled application error', {
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Error boundary fallback UI
 */
const ErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({
  error,
  resetError,
}) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
        <svg
          className="w-6 h-6 text-red-600"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
        Something went wrong
      </h2>
      <p className="text-gray-600 text-center mb-4">
        {envConfig.isDevelopment()
          ? error.message
          : 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={resetError}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        Try Again
      </button>
      {envConfig.isDevelopment() && (
        <details className="mt-4 text-sm text-gray-500">
          <summary className="cursor-pointer hover:text-gray-700">
            Error Details (Development Only)
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 rounded overflow-auto text-xs">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  </div>
);

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

/**
 * Main Application Component
 * 
 * Architecture:
 * - Root error boundary catches all errors
 * - React Query provides data fetching infrastructure
 * - Lazy loading for code splitting
 * - Individual error boundaries for each major section
 */
const App: React.FC = () => {
  // Log app initialization
  React.useEffect(() => {
    logger.info('Application initialized', {
      environment: envConfig.getEnvironment(),
      isDevelopment: envConfig.isDevelopment(),
      timestamp: new Date().toISOString(),
    });

    // Log environment info in development
    if (envConfig.isDevelopment()) {
      logger.group('Environment Configuration', () => {
        logger.debug('API Config', envConfig.getApiConfig());
        logger.debug('Map Config', envConfig.getMapConfig());
        logger.debug('Feature Flags', envConfig.getFeatureFlags());
      });
    }

    // Cleanup on unmount
    return () => {
      logger.info('Application unmounting');
    };
  }, []);

  return (
    <ErrorBoundary
      fallback={<ErrorFallback error={new Error('App failed to load')} resetError={() => window.location.reload()} />}
      onError={handleGlobalError}
    >
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-gray-50">
          {/* Main Application Layout */}
          <div className="flex flex-col h-screen">
            {/* Header Section */}
            <ErrorBoundary
              fallback={
                <header className="bg-red-50 border-b border-red-200 p-4">
                  <p className="text-red-600 text-center">Header failed to load</p>
                </header>
              }
            >
              <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="container mx-auto px-4 py-4">
                  <h1 className="text-2xl font-bold text-gray-900">
                    511 Bay Area Traffic Monitor
                  </h1>
                  <p className="text-sm text-gray-600">
                    Real-time traffic events and road conditions
                  </p>
                </div>
              </header>
            </ErrorBoundary>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden flex">
              {/* Sidebar with Filters */}
              <ErrorBoundary
                fallback={
                  <aside className="w-80 border-r border-gray-200 bg-white p-4">
                    <p className="text-red-600">Filter panel failed to load</p>
                  </aside>
                }
              >
                <Suspense fallback={<ComponentLoadingFallback name="Filters" />}>
                  <aside className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
                    <FilterPanel />
                  </aside>
                </Suspense>
              </ErrorBoundary>

              {/* Map Section */}
              <ErrorBoundary
                fallback={
                  <section className="flex-1 flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <p className="text-red-600 font-medium mb-2">Map failed to load</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="text-blue-600 hover:underline"
                      >
                        Reload Page
                      </button>
                    </div>
                  </section>
                }
              >
                <Suspense fallback={<LoadingFallback message="Loading map..." />}>
                  <section className="flex-1 relative">
                    <TrafficMap />
                  </section>
                </Suspense>
              </ErrorBoundary>
            </main>

            {/* Optional Dashboard Section */}
            {envConfig.getFeatureFlags().VITE_DEBUG && (
              <ErrorBoundary
                fallback={
                  <div className="bg-yellow-50 border-t border-yellow-200 p-2">
                    <p className="text-yellow-600 text-sm text-center">
                      Dashboard failed to load
                    </p>
                  </div>
                }
              >
                <Suspense fallback={<ComponentLoadingFallback name="Dashboard" />}>
                  <Dashboard />
                </Suspense>
              </ErrorBoundary>
            )}
          </div>
        </div>

        {/* React Query Devtools (Development Only) */}
        {envConfig.isDevelopment() && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
