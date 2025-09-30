/**
 * @file providers/registry.ts
 * @description Provider registry and React hooks for traffic data
 * @version 1.0.0
 */

import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import {
  DataProvider,
  TrafficEvent,
  ProviderRegistry,
  DataProviderError,
  ProviderMetrics
} from '../types/TrafficEvent';
import {
  BayArea511Provider,
  NYCDOTProvider,
  TxDOTProvider,
  GenericProvider
} from './implementations';

/**
 * Provider factory function type
 */
type ProviderFactory = () => DataProvider;

/**
 * Available metro areas
 */
export enum Metro {
  BAY_AREA = 'bayArea',
  NYC = 'nyc',
  TEXAS = 'texas',
  LA = 'losAngeles',
  CHICAGO = 'chicago',
  SEATTLE = 'seattle',
  DENVER = 'denver',
  ATLANTA = 'atlanta'
}

/**
 * Metro configuration
 */
interface MetroConfig {
  name: string;
  displayName: string;
  center: [number, number]; // [latitude, longitude]
  zoom: number;
  bounds?: [[number, number], [number, number]];
}

/**
 * Metro configurations
 */
export const metroConfigs: Record<Metro, MetroConfig> = {
  [Metro.BAY_AREA]: {
    name: 'bayArea',
    displayName: 'San Francisco Bay Area',
    center: [37.7749, -122.4194],
    zoom: 10,
    bounds: [[36.8, -123.5], [38.8, -121.0]]
  },
  [Metro.NYC]: {
    name: 'nyc',
    displayName: 'New York City',
    center: [40.7128, -74.0060],
    zoom: 11,
    bounds: [[40.4774, -74.2591], [40.9176, -73.7004]]
  },
  [Metro.TEXAS]: {
    name: 'texas',
    displayName: 'Texas (Statewide)',
    center: [31.0, -100.0],
    zoom: 6,
    bounds: [[25.8371, -106.6457], [36.5007, -93.5083]]
  },
  [Metro.LA]: {
    name: 'losAngeles',
    displayName: 'Los Angeles',
    center: [34.0522, -118.2437],
    zoom: 10,
    bounds: [[33.7, -118.7], [34.4, -117.8]]
  },
  [Metro.CHICAGO]: {
    name: 'chicago',
    displayName: 'Chicago',
    center: [41.8781, -87.6298],
    zoom: 11,
    bounds: [[41.6, -88.0], [42.1, -87.4]]
  },
  [Metro.SEATTLE]: {
    name: 'seattle',
    displayName: 'Seattle',
    center: [47.6062, -122.3321],
    zoom: 11,
    bounds: [[47.3, -122.6], [47.9, -122.0]]
  },
  [Metro.DENVER]: {
    name: 'denver',
    displayName: 'Denver',
    center: [39.7392, -104.9903],
    zoom: 11,
    bounds: [[39.5, -105.3], [40.0, -104.6]]
  },
  [Metro.ATLANTA]: {
    name: 'atlanta',
    displayName: 'Atlanta',
    center: [33.7490, -84.3880],
    zoom: 11,
    bounds: [[33.5, -84.7], [34.0, -84.0]]
  }
};

/**
 * Provider registry singleton
 */
class ProviderRegistryManager {
  private providers: Map<string, DataProvider> = new Map();
  private factories: Map<string, ProviderFactory> = new Map();
  private metricsInterval?: NodeJS.Timeout;
  
  constructor() {
    // Register default providers
    this.registerDefaults();
    
    // Start metrics collection
    if (process.env.NODE_ENV === 'production') {
      this.startMetricsCollection();
    }
  }
  
  /**
   * Register default providers
   */
  private registerDefaults(): void {
    // Bay Area 511
    this.registerFactory(Metro.BAY_AREA, () => 
      new BayArea511Provider(process.env.REACT_APP_511_API_KEY)
    );
    
    // NYC DOT
    this.registerFactory(Metro.NYC, () => new NYCDOTProvider());
    
    // Texas DOT
    this.registerFactory(Metro.TEXAS, () => new TxDOTProvider());
    
    // Los Angeles (example with generic provider)
    this.registerFactory(Metro.LA, () => 
      new GenericProvider(
        {
          name: 'LA511',
          baseUrl: 'https://api.511la.org',
          defaultParams: { format: 'json', status: 'active' },
          timeout: 30000
        },
        '/traffic/events',
        'events'
      )
    );
    
    // Add more metros as needed...
  }
  
  /**
   * Register a provider factory
   */
  registerFactory(key: string, factory: ProviderFactory): void {
    this.factories.set(key, factory);
  }
  
  /**
   * Get or create a provider instance
   */
  getProvider(key: string): DataProvider {
    // Check if provider already exists
    let provider = this.providers.get(key);
    if (provider) {
      return provider;
    }
    
    // Check if factory exists
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`No provider registered for key: ${key}`);
    }
    
    // Create and cache provider
    provider = factory();
    this.providers.set(key, provider);
    
    return provider;
  }
  
  /**
   * Check if a provider is available
   */
  hasProvider(key: string): boolean {
    return this.factories.has(key) || this.providers.has(key);
  }
  
  /**
   * Get all available provider keys
   */
  getAvailableProviders(): string[] {
    return Array.from(new Set([
      ...this.factories.keys(),
      ...this.providers.keys()
    ]));
  }
  
  /**
   * Clear provider cache
   */
  clearProviderCache(key?: string): void {
    if (key) {
      const provider = this.providers.get(key);
      if (provider && 'clearCache' in provider) {
        (provider as any).clearCache();
      }
    } else {
      this.providers.forEach(provider => {
        if ('clearCache' in provider) {
          (provider as any).clearCache();
        }
      });
    }
  }
  
  /**
   * Get metrics for all providers
   */
  getAllMetrics(): Record<string, ProviderMetrics> {
    const metrics: Record<string, ProviderMetrics> = {};
    
    this.providers.forEach((provider, key) => {
      if ('getMetrics' in provider) {
        metrics[key] = (provider as any).getMetrics();
      }
    });
    
    return metrics;
  }
  
  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    // Send metrics every 5 minutes
    this.metricsInterval = setInterval(() => {
      const metrics = this.getAllMetrics();
      
      // Send to analytics service
      if (window.gtag) {
        Object.entries(metrics).forEach(([provider, data]) => {
          window.gtag('event', 'provider_metrics', {
            provider,
            request_count: data.requestCount,
            error_count: data.errorCount,
            avg_response_time: data.averageResponseTime
          });
        });
      }
    }, 5 * 60 * 1000);
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.providers.clear();
    this.factories.clear();
  }
}

/**
 * Global provider registry instance
 */
export const providerRegistry = new ProviderRegistryManager();

/**
 * Hook to fetch traffic events for a specific metro
 */
export function useTrafficEvents(
  metro: Metro | string,
  options?: {
    refetchInterval?: number;
    staleTime?: number;
    enabled?: boolean;
    onError?: (error: Error) => void;
    onSuccess?: (data: TrafficEvent[]) => void;
  }
): UseQueryResult<TrafficEvent[], Error> & {
  metrics?: ProviderMetrics;
  refetch: () => void;
} {
  const queryClient = useQueryClient();
  const metricsRef = useRef<ProviderMetrics>();
  
  // Memoize the fetch function
  const fetchEvents = useCallback(async (): Promise<TrafficEvent[]> => {
    if (!providerRegistry.hasProvider(metro)) {
      throw new Error(`No provider available for metro: ${metro}`);
    }
    
    const provider = providerRegistry.getProvider(metro);
    
    try {
      const events = await provider.fetchEvents();
      
      // Update metrics if available
      if ('getMetrics' in provider) {
        metricsRef.current = (provider as any).getMetrics();
      }
      
      return events;
    } catch (error) {
      // Log error for monitoring
      console.error(`Failed to fetch events for ${metro}:`, error);
      
      // Re-throw as DataProviderError if not already
      if (error instanceof DataProviderError) {
        throw error;
      }
      
      throw new DataProviderError(
        error instanceof Error ? error.message : 'Unknown error',
        metro,
        error
      );
    }
  }, [metro]);
  
  // Use React Query
  const query = useQuery<TrafficEvent[], Error>({
    queryKey: ['traffic-events', metro],
    queryFn: fetchEvents,
    refetchInterval: options?.refetchInterval ?? 30000, // Default 30 seconds
    staleTime: options?.staleTime ?? 15000, // Default 15 seconds
    enabled: options?.enabled ?? true,
    retry: (failureCount, error) => {
      // Don't retry on client errors
      if (error instanceof DataProviderError && error.message.includes('Client error')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
  
  // Handle callbacks
  useEffect(() => {
    if (query.isError && options?.onError) {
      options.onError(query.error);
    }
  }, [query.isError, query.error, options]);
  
  useEffect(() => {
    if (query.isSuccess && options?.onSuccess) {
      options.onSuccess(query.data);
    }
  }, [query.isSuccess, query.data, options]);
  
  // Custom refetch that also clears cache
  const refetch = useCallback(() => {
    providerRegistry.clearProviderCache(metro);
    queryClient.invalidateQueries({ queryKey: ['traffic-events', metro] });
  }, [metro, queryClient]);
  
  return {
    ...query,
    metrics: metricsRef.current,
    refetch
  };
}

/**
 * Hook to get available metros
 */
export function useAvailableMetros(): {
  metros: Array<{ key: string; config: MetroConfig }>;
  isLoading: boolean;
} {
  const [isLoading, setIsLoading] = React.useState(true);
  const [metros, setMetros] = React.useState<Array<{ key: string; config: MetroConfig }>>([]);
  
  useEffect(() => {
    const checkProviders = async () => {
      setIsLoading(true);
      
      const availableMetros: Array<{ key: string; config: MetroConfig }> = [];
      
      for (const [key, config] of Object.entries(metroConfigs)) {
        if (providerRegistry.hasProvider(key)) {
          try {
            const provider = providerRegistry.getProvider(key);
            const isHealthy = await provider.healthCheck();
            
            if (isHealthy) {
              availableMetros.push({ key, config });
            }
          } catch (error) {
            console.warn(`Provider ${key} failed health check:`, error);
          }
        }
      }
      
      setMetros(availableMetros);
      setIsLoading(false);
    };
    
    checkProviders();
  }, []);
  
  return { metros, isLoading };
}

/**
 * Hook to manage provider metrics
 */
export function useProviderMetrics(): Record<string, ProviderMetrics> {
  const [metrics, setMetrics] = React.useState<Record<string, ProviderMetrics>>({});
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(providerRegistry.getAllMetrics());
    }, 10000); // Update every 10 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return metrics;
}

// TypeScript declarations for Google Analytics
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
