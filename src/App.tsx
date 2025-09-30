/**
 * @file App.tsx
 * @description Complete application example integrating the traffic event system
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  TrafficEvent,
  EventType,
  EventSeverity
} from './types/TrafficEvent';
import { TrafficMap } from './components/TrafficMap';
import { Metro, providerRegistry } from './providers/registry';

/**
 * Configure React Query client
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000, // 15 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always'
    }
  }
});

/**
 * Event details panel component
 */
const EventDetailsPanel: React.FC<{ event: TrafficEvent | null }> = ({ event }) => {
  if (!event) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-center">
          Click on a traffic event to see details
        </p>
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-white rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-2">{event.headline}</h3>
      
      {event.description && (
        <p className="text-gray-700 mb-4">{event.description}</p>
      )}
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-semibold">Type:</span> {event.eventType}
        </div>
        <div>
          <span className="font-semibold">Severity:</span> {event.severity || 'Unknown'}
        </div>
        
        {event.roads && event.roads.length > 0 && (
          <div className="col-span-2">
            <span className="font-semibold">Affected Roads:</span>
            <ul className="ml-4 mt-1">
              {event.roads.map((road, idx) => (
                <li key={idx} className="list-disc">{road}</li>
              ))}
            </ul>
          </div>
        )}
        
        {event.startTime && (
          <div>
            <span className="font-semibold">Started:</span>
            <br />
            {new Date(event.startTime).toLocaleString()}
          </div>
        )}
        
        {event.endTime && (
          <div>
            <span className="font-semibold">Expected End:</span>
            <br />
            {new Date(event.endTime).toLocaleString()}
          </div>
        )}
        
        {event.lanesAffected && (
          <div>
            <span className="font-semibold">Lanes Affected:</span> {event.lanesAffected}
          </div>
        )}
        
        {event.direction && (
          <div>
            <span className="font-semibold">Direction:</span> {event.direction}
          </div>
        )}
        
        <div className="col-span-2 mt-2 pt-2 border-t">
          <div className="text-xs text-gray-500">
            <div>Source: {event.source}</div>
            {event.updated && (
              <div>Last Updated: {new Date(event.updated).toLocaleString()}</div>
            )}
            <div>Event ID: {event.id}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Filters component
 */
const FiltersPanel: React.FC<{
  filters: {
    eventTypes: EventType[];
    severities: EventSeverity[];
    searchQuery: string;
  };
  onFiltersChange: (filters: any) => void;
}> = ({ filters, onFiltersChange }) => {
  const handleEventTypeToggle = (type: EventType) => {
    const newTypes = filters.eventTypes.includes(type)
      ? filters.eventTypes.filter(t => t !== type)
      : [...filters.eventTypes, type];
    
    onFiltersChange({
      ...filters,
      eventTypes: newTypes
    });
  };
  
  const handleSeverityToggle = (severity: EventSeverity) => {
    const newSeverities = filters.severities.includes(severity)
      ? filters.severities.filter(s => s !== severity)
      : [...filters.severities, severity];
    
    onFiltersChange({
      ...filters,
      severities: newSeverities
    });
  };
  
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="font-bold text-lg mb-3">Filters</h3>
      
      {/* Search */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Search
        </label>
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onFiltersChange({
            ...filters,
            searchQuery: e.target.value
          })}
          placeholder="Search events..."
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {/* Event Types */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Event Types
        </label>
        <div className="space-y-1">
          {Object.values(EventType).map(type => (
            <label key={type} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filters.eventTypes.includes(type)}
                onChange={() => handleEventTypeToggle(type)}
                className="mr-2"
              />
              <span className="text-sm">{type.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Severities */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Severity Levels
        </label>
        <div className="space-y-1">
          {Object.values(EventSeverity).map(severity => (
            <label key={severity} className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={filters.severities.includes(severity)}
                onChange={() => handleSeverityToggle(severity)}
                className="mr-2"
              />
              <span className="text-sm capitalize">{severity}</span>
            </label>
          ))}
        </div>
      </div>
      
      {/* Clear Filters */}
      <button
        onClick={() => onFiltersChange({
          eventTypes: [],
          severities: [],
          searchQuery: ''
        })}
        className="mt-4 w-full px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
      >
        Clear All Filters
      </button>
    </div>
  );
};

/**
 * Main Application Component
 */
const App: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<TrafficEvent | null>(null);
  const [currentMetro, setCurrentMetro] = useState<Metro>(Metro.BAY_AREA);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    eventTypes: [] as EventType[],
    severities: [] as EventSeverity[],
    searchQuery: ''
  });
  
  const handleEventClick = useCallback((event: TrafficEvent) => {
    setSelectedEvent(event);
  }, []);
  
  const handleMetroChange = useCallback((metro: Metro) => {
    setCurrentMetro(metro);
    setSelectedEvent(null);
  }, []);
  
  const activeFilters = useMemo(() => {
    const hasFilters = 
      filters.eventTypes.length > 0 ||
      filters.severities.length > 0 ||
      filters.searchQuery.length > 0;
    
    return hasFilters ? filters : undefined;
  }, [filters]);
  
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">
                🚦 Traffic Event Monitor
              </h1>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </button>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Filters */}
            {showFilters && (
              <div className="lg:col-span-1">
                <FiltersPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </div>
            )}
            
            {/* Center - Map */}
            <div className={showFilters ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <TrafficMap
                  initialMetro={currentMetro}
                  height="600px"
                  onEventClick={handleEventClick}
                  onMetroChange={handleMetroChange}
                  showControls={true}
                  showMetrics={true}
                  autoRefresh={true}
                  filters={activeFilters}
                />
              </div>
            </div>
            
            {/* Right Sidebar - Event Details */}
            <div className="lg:col-span-1">
              <EventDetailsPanel event={selectedEvent} />
            </div>
          </div>
        </main>
        
        {/* Footer */}
        <footer className="mt-12 bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <p className="text-center text-sm text-gray-500">
              Traffic data provided by various DOT APIs. Updates every 30 seconds.
            </p>
          </div>
        </footer>
      </div>
      
      {/* React Query DevTools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
};

export default App;

/**
 * Environment variables needed (create a .env file):
 * 
 * REACT_APP_511_API_KEY=your_511_api_key_here
 * REACT_APP_NYC_APP_TOKEN=your_nyc_open_data_token_here
 * REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here (optional for better maps)
 */

/**
 * Package.json dependencies to install:
 * 
 * {
 *   "dependencies": {
 *     "react": "^18.2.0",
 *     "react-dom": "^18.2.0",
 *     "react-leaflet": "^4.2.1",
 *     "leaflet": "^1.9.4",
 *     "@tanstack/react-query": "^5.0.0",
 *     "@tanstack/react-query-devtools": "^5.0.0",
 *     "geojson": "^0.5.0",
 *     "typescript": "^5.0.0"
 *   },
 *   "devDependencies": {
 *     "@types/react": "^18.2.0",
 *     "@types/react-dom": "^18.2.0",
 *     "@types/leaflet": "^1.9.0",
 *     "@types/geojson": "^7946.0.0",
 *     "@testing-library/react": "^14.0.0",
 *     "@testing-library/jest-dom": "^6.0.0",
 *     "jest": "^29.0.0"
 *   }
 * }
 */
