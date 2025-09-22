/**
 * Main Application Component
 * Orchestrates the 511 Bay Area Traffic Monitor
 */

import React, { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { TrafficMap } from '@components/Map';
import { FilterPanel } from '@components/FilterPanel';
import { EventListPanel } from '@components/EventPanel';
import { LoadingSpinner, ErrorAlert } from '@components/shared';
import { useTrafficEvents } from '@hooks/useTrafficEvents';
import { useMapControls } from '@hooks/useMapControls';
import { useLocalStorage } from '@hooks/useLocalStorage';
import { useApiKeyManager } from '@hooks/useApiKeyManager';
import { EventType, EventSeverity, TrafficEvent } from '@types/api.types';
import { DEFAULT_FILTERS, STORAGE_KEYS } from '@utils/constants';
import type { FilterState } from '@types/filter.types';

// Create a client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000,
      retry: 3,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TrafficMonitorApp />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}

function TrafficMonitorApp() {
  // State Management
  const [filters, setFilters] = useLocalStorage<FilterState>(
    STORAGE_KEYS.FILTERS,
    DEFAULT_FILTERS
  );
  const [selectedEvent, setSelectedEvent] = useState<TrafficEvent | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showEventList, setShowEventList] = useState(true);

  // Hooks
  const { apiKey, setApiKey, isValidApiKey } = useApiKeyManager();
  const {
    events,
    filteredEvents,
    closureEvents,
    isLoading,
    error,
    refetch,
    rateLimitInfo
  } = useTrafficEvents(apiKey, filters);
  
  const {
    mapRef,
    mapCenter,
    mapZoom,
    setMapCenter,
    setMapZoom,
    flyToLocation,
    fitBounds
  } = useMapControls();

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, [setFilters]);

  // Handle event selection
  const handleEventSelect = useCallback((event: TrafficEvent) => {
    setSelectedEvent(event);
    if (event.geography?.coordinates) {
      const coords = Array.isArray(event.geography.coordinates[0])
        ? event.geography.coordinates[0]
        : event.geography.coordinates;
      const [lng, lat] = coords as number[];
      flyToLocation(lat, lng, 14);
    }
  }, [flyToLocation]);

  // Handle API key submission
  const handleApiKeySubmit = useCallback((key: string) => {
    setApiKey(key);
    refetch();
  }, [setApiKey, refetch]);

  // Auto-refresh effect
  useEffect(() => {
    if (!apiKey || !isValidApiKey) return;

    const interval = setInterval(() => {
      refetch();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [apiKey, isValidApiKey, refetch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle sidebar with 'S' key
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        setSidebarCollapsed(prev => !prev);
      }
      // Toggle event list with 'E' key
      if (e.key === 'e' && !e.ctrlKey && !e.metaKey) {
        setShowEventList(prev => !prev);
      }
      // Clear filters with 'C' key
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
        setFilters(DEFAULT_FILTERS);
      }
      // Refresh with 'R' key
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        refetch();
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [setFilters, refetch]);

  // Page visibility handling for background refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && apiKey) {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [apiKey, refetch]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-100">
      {/* Map Container */}
      <TrafficMap
        ref={mapRef}
        events={filteredEvents}
        selectedEvent={selectedEvent}
        onEventSelect={handleEventSelect}
        center={mapCenter}
        zoom={mapZoom}
        onCenterChange={setMapCenter}
        onZoomChange={setMapZoom}
      />

      {/* Filter Panel */}
      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        apiKey={apiKey}
        onApiKeySubmit={handleApiKeySubmit}
        rateLimitInfo={rateLimitInfo}
        eventCounts={{
          total: events.length,
          filtered: filteredEvents.length,
          closures: closureEvents.length,
        }}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onRefresh={refetch}
        isRefreshing={isLoading}
      />

      {/* Event List Panel */}
      {showEventList && apiKey && (
        <EventListPanel
          events={filteredEvents}
          closureEvents={closureEvents}
          selectedEvent={selectedEvent}
          onEventSelect={handleEventSelect}
          onClose={() => setShowEventList(false)}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-[2000]">
          <LoadingSpinner size="lg" message="Loading traffic data..." />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <ErrorAlert
          message={error.message}
          onRetry={refetch}
          onDismiss={() => {}}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[2000]"
        />
      )}

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg px-3 py-2 text-xs flex items-center space-x-4 z-[1000]">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-gray-600">
            {isLoading ? 'Updating...' : 'Live'}
          </span>
        </div>
        <div className="text-gray-500">
          {filteredEvents.length} events • {closureEvents.length} closures
        </div>
        {rateLimitInfo && (
          <div className="text-gray-500">
            API: {rateLimitInfo.remaining}/{60}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg px-3 py-2 text-xs text-gray-500 z-[1000]">
        <div className="flex items-center space-x-2">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">S</kbd>
          <span>Toggle sidebar</span>
        </div>
        <div className="flex items-center space-x-2 mt-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">E</kbd>
          <span>Toggle event list</span>
        </div>
      </div>

      {/* API Key Prompt (if not set) */}
      {!apiKey && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[3000]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Welcome to 511 Traffic Monitor
            </h2>
            <p className="text-gray-600 mb-6">
              Please enter your 511.org API key to start monitoring traffic events in the Bay Area.
            </p>
            <ApiKeyInput onSubmit={handleApiKeySubmit} />
            <p className="text-sm text-gray-500 mt-4">
              Don't have an API key?{' '}
              <a
                href="https://511.org/open-data/token"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Get one here
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// API Key Input Component
function ApiKeyInput({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSubmit(key.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
          API Key
        </label>
        <input
          id="api-key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter your 511.org API key"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>
      <button
        type="submit"
        disabled={!key.trim()}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        Start Monitoring
      </button>
    </form>
  );
}
