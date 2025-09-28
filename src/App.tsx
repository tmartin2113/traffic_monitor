/**
 * App Component
 * Main application orchestrator for 511 Traffic Monitor
 * @author 511 Traffic Monitor
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Map as LeafletMap } from 'leaflet';
import axios from 'axios';
import { AlertCircle, WifiOff, RefreshCw, Settings, Key } from 'lucide-react';
import clsx from 'clsx';

// Component imports
import UnifiedSearch from '@components/UnifiedSearch/UnifiedSearch';
import TrafficMap from '@components/TrafficMap/TrafficMap';
import EventSidebar from '@components/EventSidebar/EventSidebar';

// Type imports
import { TrafficEvent, EventType, EventSeverity } from '@types/api.types';

// Utility imports
import { logger } from '@utils/logger';
import { isWithinGeofence } from '@utils/geoUtils';

// Styles
import '@styles/globals.css';
import '@styles/map.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

/* ========================
   Type Definitions
======================== */

interface MapBounds {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

interface AppConfig {
  apiKey: string | null;
  apiUrl: string;
  refreshInterval: number;
  clusterMarkers: boolean;
  showGeofence: boolean;
}

interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

/* ========================
   Constants
======================== */

const DEFAULT_CONFIG: AppConfig = {
  apiKey: import.meta.env.VITE_511_API_KEY || null,
  apiUrl: import.meta.env.VITE_511_API_URL || 'https://api.511.org',
  refreshInterval: 60000, // 1 minute
  clusterMarkers: true,
  showGeofence: true,
};

const STORAGE_KEYS = {
  API_KEY: '511_api_key',
  CONFIG: '511_app_config',
  LAST_VIEW: '511_last_view',
};

/* ========================
   Query Client Configuration
======================== */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 300000, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors except 429 (rate limit)
        if (error?.response?.status >= 400 && error?.response?.status < 500 && error?.response?.status !== 429) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

/* ========================
   API Functions
======================== */

const fetchTrafficEvents = async (apiUrl: string, apiKey: string, bounds?: MapBounds): Promise<TrafficEvent[]> => {
  try {
    const params = new URLSearchParams({
      format: 'json',
      status: 'ACTIVE',
      api_key: apiKey,
    });
    
    if (bounds) {
      params.append('bbox', `${bounds.xmin},${bounds.ymin},${bounds.xmax},${bounds.ymax}`);
    }
    
    const response = await axios.get<{ events: TrafficEvent[] }>(
      `${apiUrl}/traffic/events?${params.toString()}`,
      {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
        },
      }
    );
    
    // Validate and transform data
    const events = response.data?.events || [];
    
    return events.map(event => ({
      ...event,
      // Ensure required fields
      id: event.id || `event-${Date.now()}-${Math.random()}`,
      headline: event.headline || 'Unknown Event',
      event_type: event.event_type || EventType.INCIDENT,
      // Parse dates
      created: event.created ? new Date(event.created).toISOString() : new Date().toISOString(),
      updated: event.updated ? new Date(event.updated).toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError: ApiError = {
        message: error.response?.data?.message || error.message,
        status: error.response?.status,
        code: error.code,
      };
      
      logger.error('API request failed', apiError);
      
      if (error.response?.status === 403) {
        throw new Error('Invalid API key. Please check your 511.org API key.');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. The 511 API is not responding.');
      }
      
      throw apiError;
    }
    throw error;
  }
};

/* ========================
   Custom Hooks
======================== */

const useLocalStorage = <T>(key: string, defaultValue: T): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      logger.warn(`Failed to load from localStorage: ${key}`, error);
      return defaultValue;
    }
  });
  
  const setStoredValue = useCallback((newValue: T) => {
    try {
      setValue(newValue);
      localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      logger.error(`Failed to save to localStorage: ${key}`, error);
    }
  }, [key]);
  
  return [value, setStoredValue];
};

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
};

/* ========================
   Sub-Components
======================== */

// API Key Setup Component
const ApiKeySetup: React.FC<{
  onSubmit: (apiKey: string) => void;
}> = ({ onSubmit }) => {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Test the API key
      await fetchTrafficEvents(DEFAULT_CONFIG.apiUrl, apiKey);
      onSubmit(apiKey);
    } catch (err: any) {
      setError(err.message || 'Invalid API key');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-100 flex items-center justify-center p-4 z-[2000]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Key className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            511.org API Key Required
          </h2>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          To use this application, you need a free API key from 511.org.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>How to get your API key:</strong>
          </p>
          <ol className="mt-2 space-y-1 text-sm text-blue-700">
            <li>1. Visit <a href="https://511.org/open-data/developers" target="_blank" rel="noopener noreferrer" className="underline font-medium">511.org Developer Portal</a></li>
            <li>2. Sign up for a free account</li>
            <li>3. Generate your API token</li>
            <li>4. Copy and paste it below</li>
          </ol>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              id="api-key"
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your 511.org API key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !apiKey.trim()}
            className={clsx(
              'w-full py-2 px-4 rounded-md font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              loading || !apiKey.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Validating...
              </span>
            ) : (
              'Connect to 511.org'
            )}
          </button>
        </form>
        
        <p className="mt-4 text-xs text-gray-500 text-center">
          Your API key will be stored locally in your browser
        </p>
      </div>
    </div>
  );
};

// Error Boundary Component
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
    logger.error('Application error', { error, errorInfo });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

/* ========================
   Main App Component
======================== */

const App: React.FC = () => {
  // State Management
  const [config, setConfig] = useLocalStorage<AppConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
  const [selectedEvent, setSelectedEvent] = useState<TrafficEvent | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  
  // Online status
  const isOnline = useOnlineStatus();
  
  // Data fetching
  const eventsQuery = useQuery<TrafficEvent[], Error>({
    queryKey: ['traffic-events', mapBounds, config.apiKey],
    queryFn: () => {
      if (!config.apiKey) {
        throw new Error('API key not configured');
      }
      return fetchTrafficEvents(config.apiUrl, config.apiKey, mapBounds || undefined);
    },
    enabled: Boolean(config.apiKey && isOnline),
    refetchInterval: config.refreshInterval,
    refetchIntervalInBackground: false,
  });
  
  // Filter closure events
  const closureEvents = React.useMemo(() => {
    if (!eventsQuery.data) return [];
    
    return eventsQuery.data.filter(event => {
      // Check for closure indicators
      const hasClosureGeography = Boolean(event.closure_geography);
      const isClosureType = event.event_subtypes?.includes('ROAD_CLOSURE');
      const hasClosureInHeadline = event.headline?.toLowerCase().includes('closed') ||
                                   event.headline?.toLowerCase().includes('closure');
      
      return hasClosureGeography || isClosureType || hasClosureInHeadline;
    });
  }, [eventsQuery.data]);
  
  // Event handlers
  const handleApiKeySubmit = useCallback((apiKey: string) => {
    setConfig(prev => ({ ...prev, apiKey }));
  }, [setConfig]);
  
  const handleEventSelect = useCallback((event: TrafficEvent | null) => {
    setSelectedEvent(event);
  }, []);
  
  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
    logger.info('Map initialized');
  }, []);
  
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setMapBounds(bounds);
  }, []);
  
  const handleRefresh = useCallback(() => {
    eventsQuery.refetch();
  }, [eventsQuery]);
  
  // Show API key setup if not configured
  if (!config.apiKey) {
    return <ApiKeySetup onSubmit={handleApiKeySubmit} />;
  }
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="relative w-full h-screen overflow-hidden">
          {/* Map Container */}
          <TrafficMap
            events={eventsQuery.data || []}
            closureEvents={closureEvents}
            selectedEvent={selectedEvent}
            onEventSelect={handleEventSelect}
            onBoundsChange={handleBoundsChange}
            onMapReady={handleMapReady}
            showGeofence={config.showGeofence}
            clusterEvents={config.clusterMarkers}
          />
          
          {/* Unified Search - Top Right */}
          <div className="absolute top-4 right-4 z-[1000] w-96">
            <UnifiedSearch
              open511BaseUrl={config.apiUrl}
              open511ApiKey={config.apiKey}
              bbox={mapBounds}
              map={mapRef.current}
              onSelectEvent={handleEventSelect}
              placeholder="Search places, roads, or events..."
              className="shadow-lg"
            />
          </div>
          
          {/* Event Sidebar - Left Side */}
          <EventSidebar
            events={eventsQuery.data || []}
            closureEvents={closureEvents}
            selectedEvent={selectedEvent}
            onEventSelect={handleEventSelect}
            collapsible={true}
            defaultCollapsed={false}
            position="left"
            width={384}
          />
          
          {/* Status Bar - Bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t px-4 py-2 flex items-center justify-between text-sm z-[998]">
            <div className="flex items-center gap-4">
              {/* Connection Status */}
              {!isOnline && (
                <div className="flex items-center gap-2 text-orange-600">
                  <WifiOff className="w-4 h-4" />
                  <span>Offline Mode</span>
                </div>
              )}
              
              {/* Data Status */}
              <div className="flex items-center gap-2 text-gray-600">
                {eventsQuery.isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading events...</span>
                  </>
                ) : eventsQuery.isError ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-600">Error loading events</span>
                  </>
                ) : (
                  <>
                    <span>{eventsQuery.data?.length || 0} events</span>
                    <span>•</span>
                    <span>{closureEvents.length} closures</span>
                  </>
                )}
              </div>
              
              {/* Last Update */}
              {eventsQuery.dataUpdatedAt > 0 && (
                <div className="text-gray-500">
                  Updated {new Date(eventsQuery.dataUpdatedAt).toLocaleTimeString()}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={eventsQuery.isLoading}
                className={clsx(
                  'p-1.5 rounded transition-colors',
                  eventsQuery.isLoading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
                aria-label="Refresh data"
              >
                <RefreshCw className={clsx(
                  'w-4 h-4',
                  eventsQuery.isLoading && 'animate-spin'
                )} />
              </button>
              
              {/* Settings Button */}
              <button
                onClick={() => {
                  // Placeholder for settings modal
                  logger.info('Settings clicked');
                }}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* React Query DevTools */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
