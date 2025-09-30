/**
 * @file App.tsx
 * @description Main application component with clean abstraction layer integration
 * @version 2.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TrafficMap } from './components/TrafficMap';
import { EventDetailsPanel } from './components/EventDetailsPanel';
import { FiltersPanel } from './components/FiltersPanel';
import { Metro, useTrafficEvents } from './providers/registry';
import { TrafficEvent, EventType, EventSeverity } from './types/TrafficEvent';
import { useLocalStorage } from './hooks/useLocalStorage';
import './styles/globals.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Filter state interface
interface FilterState {
  eventTypes: string[];
  severities: string[];
  searchQuery: string;
}

// Default filter state
const DEFAULT_FILTERS: FilterState = {
  eventTypes: [],
  severities: [],
  searchQuery: '',
};

/**
 * Main App Content Component
 */
function AppContent() {
  // State management
  const [currentMetro, setCurrentMetro] = useState<Metro>(Metro.BAY_AREA);
  const [selectedEvent, setSelectedEvent] = useState<TrafficEvent | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useLocalStorage<FilterState>('traffic-filters', DEFAULT_FILTERS);
  
  // Fetch traffic events using the new provider system
  const {
    events = [],
    filteredEvents,
    isLoading,
    isError,
    error,
    refetch,
    metrics
  } = useTrafficEvents(currentMetro, {
    enabled: true,
    refetchInterval: 30000, // 30 seconds
  });
  
  // Apply filters to events
  const displayEvents = useMemo(() => {
    let result = [...events];
    
    // Filter by event types
    if (filters.eventTypes.length > 0) {
      result = result.filter(e => 
        filters.eventTypes.includes(e.eventType)
      );
    }
    
    // Filter by severities
    if (filters.severities.length > 0) {
      result = result.filter(e => 
        e.severity && filters.severities.includes(e.severity)
      );
    }
    
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(e =>
        e.headline.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        e.roads?.some(r => r.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [events, filters]);
  
  // Handle event click on map
  const handleEventClick = useCallback((event: TrafficEvent) => {
    setSelectedEvent(event);
  }, []);
  
  // Handle metro change
  const handleMetroChange = useCallback((metro: Metro) => {
    setCurrentMetro(metro);
    setSelectedEvent(null);
  }, []);
  
  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, [setFilters]);
  
  // Convert filters for map component
  const mapFilters = useMemo(() => ({
    eventTypes: filters.eventTypes as EventType[],
    severities: filters.severities as EventSeverity[],
    searchQuery: filters.searchQuery
  }), [filters]);
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🚦</span>
              <h1 className="text-2xl font-bold text-gray-900">
                Traffic Event Monitor
              </h1>
              {isLoading && (
                <span className="ml-4 text-sm text-gray-500">
                  Loading events...
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Event count */}
              <span className="text-sm text-gray-600">
                {displayEvents.length} of {events.length} events
              </span>
              
              {/* Refresh button */}
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
              
              {/* Toggle filters */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </button>
            </div>
          </div>
          
          {/* Error display */}
          {isError && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">
                Error loading traffic data: {error?.message || 'Unknown error'}
              </p>
            </div>
          )}
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Filters */}
          {showFilters && (
            <div className="lg:col-span-3">
              <FiltersPanel
                filters={filters}
                onFiltersChange={handleFiltersChange}
              />
            </div>
          )}
          
          {/* Center - Map */}
          <div className={showFilters ? 'lg:col-span-6' : 'lg:col-span-9'}>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: '600px' }}>
              <TrafficMap
                initialMetro={currentMetro}
                height="100%"
                onEventClick={handleEventClick}
                onMetroChange={handleMetroChange}
                showControls={true}
                showMetrics={metrics !== undefined}
                autoRefresh={false} // We handle refresh at app level
                filters={mapFilters}
              />
            </div>
          </div>
          
          {/* Right Sidebar - Event Details */}
          <div className="lg:col-span-3">
            <EventDetailsPanel 
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
            
            {/* Provider Metrics (if available) */}
            {metrics && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs">
                <h4 className="font-semibold text-gray-700 mb-2">Provider Status</h4>
                <div className="space-y-1 text-gray-600">
                  <div>Provider: {metrics.provider}</div>
                  <div>Requests: {metrics.requestCount}</div>
                  <div>Errors: {metrics.errorCount}</div>
                  <div>Avg Response: {metrics.averageResponseTime.toFixed(0)}ms</div>
                  {metrics.lastError && (
                    <div className="text-red-600">Last Error: {metrics.lastError}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="mt-auto bg-white shadow-sm border-t">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="text-center text-sm text-gray-500">
            <p>
              Traffic data provided by multiple DOT APIs via unified abstraction layer.
              Updates every 30 seconds. Current metro: {currentMetro}.
            </p>
            {process.env.REACT_APP_VERSION && (
              <p className="mt-1">Version {process.env.REACT_APP_VERSION}</p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Main App Component with Providers
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppContent />
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
