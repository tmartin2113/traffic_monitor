/**
 * @file App.tsx
 * @description Main application component for 511 Bay Area Traffic Monitor
 * @version 3.0.0
 * 
 * Production-ready application integrating:
 * - Real-time traffic event monitoring
 * - Interactive map visualization
 * - Advanced filtering and search
 * - State management with Zustand
 * - Error boundaries and loading states
 */

import React, { useState, useEffect, useCallback, Suspense, ErrorBoundary as ReactErrorBoundary } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Type imports
import type {
  TrafficEvent,
  EventType,
  EventSeverity,
} from '@types/api.types';

// Component imports
import { TrafficMap } from '@components/TrafficMap/TrafficMap';
import { EventList } from '@components/EventPanel/EventList';
import { EventDetails } from '@components/EventPanel/EventDetails';
import { FilterPanel } from '@components/FilterPanel/FilterPanel';
import { ApiKeyInput } from '@components/FilterPanel/ApiKeyInput';
import { RateLimitIndicator } from '@components/FilterPanel/RateLimitIndicator';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { ErrorAlert } from '@components/shared/ErrorAlert';

// Store hooks
import {
  useEventStore,
  useFilterStore,
  useMapStore,
} from '@stores/index';

// Custom hooks
import { useTrafficEvents } from '@hooks/useTrafficEvents';
import { useApiKeyManager } from '@hooks/useApiKeyManager';
import { useGeofencing } from '@hooks/useGeofencing';

// Utilities
import { BAY_AREA_BOUNDS, GEOFENCE, POLL_INTERVAL } from '@utils/constants';
import { isWithinGeofence } from '@utils/geoUtils';
import { formatDateTime } from '@utils/dateUtils';

// Styles
import '@styles/globals.css';
import '@styles/map.css';

/**
 * Configure React Query client with production-ready settings
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      refetchOnMount: false,
    },
    mutations: {
      retry: 2,
      retryDelay: 1000,
    },
  },
});

/**
 * Error Boundary Component
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application Error:', error, errorInfo);
    
    // Send to error tracking service in production
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl">⚠️</div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Application Error
                </h1>
                <p className="text-gray-600 mt-1">
                  Something went wrong. Please refresh the page to try again.
                </p>
              </div>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 p-4 bg-gray-50 rounded border">
                <summary className="cursor-pointer font-medium text-gray-700">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs text-red-600 overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Loading Fallback Component
 */
const LoadingFallback: React.FC = () => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="text-center">
      <LoadingSpinner size="large" />
      <p className="mt-4 text-gray-600 text-lg">Loading Traffic Monitor...</p>
    </div>
  </div>
);

/**
 * Header Component
 */
const AppHeader: React.FC<{
  onToggleSidebar: () => void;
  showSidebar: boolean;
  eventCount: number;
  closureCount: number;
}> = ({ onToggleSidebar, showSidebar, eventCount, closureCount }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-2xl">🚦</span>
                511 Bay Area Traffic Monitor
              </h1>
              <p className="text-sm text-gray-600 mt-1 hidden sm:block">
                Real-time traffic events and road closures
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                <span className="text-blue-600 font-semibold">{eventCount}</span>
                <span className="text-gray-600">Events</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg">
                <span className="text-red-600 font-semibold">{closureCount}</span>
                <span className="text-gray-600">Closures</span>
              </div>
            </div>

            <RateLimitIndicator />
          </div>
        </div>
      </div>
    </header>
  );
};

/**
 * Sidebar Component
 */
const Sidebar: React.FC<{
  show: boolean;
  onClose: () => void;
  selectedEvent: TrafficEvent | null;
  onEventSelect: (event: TrafficEvent | null) => void;
}> = ({ show, onClose, selectedEvent, onEventSelect }) => {
  return (
    <>
      {/* Mobile overlay */}
      {show && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-80 bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${show ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedEvent ? 'Event Details' : 'Filters & Events'}
          </h2>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            aria-label="Close sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-y-auto">
          {selectedEvent ? (
            <EventDetails
              event={selectedEvent}
              onClose={() => onEventSelect(null)}
            />
          ) : (
            <>
              <div className="p-4 border-b border-gray-200">
                <FilterPanel />
              </div>
              <EventList onEventSelect={onEventSelect} />
            </>
          )}
        </div>
      </aside>
    </>
  );
};

/**
 * Main Application Component
 */
const AppContent: React.FC = () => {
  // Local UI state
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);

  // API Key Management
  const { apiKey, isValidApiKey } = useApiKeyManager();

  // Store state
  const events = useEventStore((state) => state.events);
  const filters = useFilterStore((state) => state.filters);
  const mapCenter = useMapStore((state) => state.center);
  
  // Computed values
  const eventArray = Array.from(events.values());
  const closureCount = eventArray.filter(event => 
    event.roads?.some(road => road.state === 'CLOSED')
  ).length;

  // Get selected event
  const selectedEvent = selectedEventId 
    ? events.get(selectedEventId) || null 
    : null;

  // Fetch traffic events
  const {
    data: fetchedEvents,
    isLoading,
    isError,
    error,
    refetch,
  } = useTrafficEvents({
    enabled: isValidApiKey,
    refetchInterval: POLL_INTERVAL,
    geofence: GEOFENCE,
  });

  // Geofencing hook
  useGeofencing(GEOFENCE);

  // Update events in store when fetched
  useEffect(() => {
    if (fetchedEvents && fetchedEvents.length > 0) {
      const eventStore = useEventStore.getState();
      eventStore.setEvents(fetchedEvents);
    }
  }, [fetchedEvents]);

  // Check API key on mount
  useEffect(() => {
    setApiKeyConfigured(isValidApiKey);
  }, [isValidApiKey]);

  // Handle event selection
  const handleEventSelect = useCallback((event: TrafficEvent | null) => {
    setSelectedEventId(event?.id || null);
    
    // Update map center if event selected
    if (event && event.geography?.coordinates) {
      const [lng, lat] = event.geography.coordinates;
      useMapStore.getState().setCenter({ lat, lng });
      useMapStore.getState().setZoom(14);
    }
  }, []);

  // Handle event click from map
  const handleMapEventClick = useCallback((event: TrafficEvent) => {
    handleEventSelect(event);
    // Open sidebar on mobile
    if (window.innerWidth < 1024) {
      setShowSidebar(true);
    }
  }, [handleEventSelect]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setShowSidebar(prev => !prev);
  }, []);

  // Show API key input if not configured
  if (!apiKeyConfigured) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🔑</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              API Key Required
            </h2>
            <p className="text-gray-600">
              Please enter your 511.org API key to access traffic data.
            </p>
          </div>

          <ApiKeyInput onKeyValidated={() => setApiKeyConfigured(true)} />

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              Don't have an API key?{' '}
              <a
                href="https://511.org/open-data/token"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Get one free from 511.org
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (isError && error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <AppHeader
          onToggleSidebar={toggleSidebar}
          showSidebar={showSidebar}
          eventCount={eventArray.length}
          closureCount={closureCount}
        />
        <div className="max-w-4xl mx-auto p-8">
          <ErrorAlert
            title="Failed to Load Traffic Data"
            message={error instanceof Error ? error.message : 'An unexpected error occurred'}
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  // Main app layout
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <AppHeader
        onToggleSidebar={toggleSidebar}
        showSidebar={showSidebar}
        eventCount={eventArray.length}
        closureCount={closureCount}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          show={showSidebar}
          onClose={() => setShowSidebar(false)}
          selectedEvent={selectedEvent}
          onEventSelect={handleEventSelect}
        />

        <main className="flex-1 relative">
          {isLoading && eventArray.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <LoadingSpinner size="large" />
                <p className="mt-4 text-gray-600">Loading traffic events...</p>
              </div>
            </div>
          ) : (
            <TrafficMap
              events={eventArray}
              filters={filters}
              selectedEvent={selectedEvent}
              onEventClick={handleMapEventClick}
              bounds={BAY_AREA_BOUNDS}
              showControls
              showMetrics={import.meta.env.DEV}
            />
          )}

          {/* Loading indicator for background updates */}
          {isLoading && eventArray.length > 0 && (
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 flex items-center gap-2">
              <LoadingSpinner size="small" />
              <span className="text-sm text-gray-600">Updating...</span>
            </div>
          )}
        </main>
      </div>

      {/* Development tools */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </div>
  );
};

/**
 * App Root Component with Providers
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<LoadingFallback />}>
          <AppContent />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
