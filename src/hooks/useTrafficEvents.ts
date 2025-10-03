/**
 * @file hooks/useTrafficEvents.ts
 * @description Hook for fetching traffic events with AbortController cleanup
 * @version 2.0.0
 * 
 * FIXES BUG #15: Now properly cancels API requests on unmount
 */

import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { TrafficEvent } from '@types/api.types';
import { MapBounds } from '@types/map.types';
import { trafficAPI } from '@services/api/trafficApi';
import { logger } from '@utils/logger';
import { isWithinGeofence } from '@utils/geoUtils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Options for useTrafficEvents hook
 */
export interface UseTrafficEventsOptions {
  /** Enable/disable fetching */
  enabled?: boolean;
  /** Refetch interval in milliseconds */
  refetchInterval?: number;
  /** Geofence bounds for filtering */
  geofence?: MapBounds;
  /** Event type filter */
  eventTypes?: string[];
  /** Severity filter */
  severities?: string[];
  /** Callback on successful fetch */
  onSuccess?: (data: TrafficEvent[]) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Stale time in milliseconds */
  staleTime?: number;
  /** Cache time in milliseconds */
  cacheTime?: number;
}

/**
 * Return type for useTrafficEvents hook
 */
export interface UseTrafficEventsResult extends UseQueryResult<TrafficEvent[], Error> {
  /** Refetch events */
  refetch: () => Promise<void>;
  /** Cancel ongoing request */
  cancel: () => void;
}

// ============================================================================
// QUERY KEY FACTORY
// ============================================================================

/**
 * Generate cache key for traffic events query
 */
function getQueryKey(options: UseTrafficEventsOptions): string[] {
  return [
    'traffic-events',
    JSON.stringify({
      geofence: options.geofence,
      eventTypes: options.eventTypes,
      severities: options.severities,
    }),
  ];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to fetch traffic events with automatic cleanup
 * 
 * Features:
 * - Automatic AbortController cleanup on unmount
 * - React Query integration for caching
 * - Geofence filtering
 * - Polling support with automatic cancellation
 * - Error handling and retry logic
 * 
 * @param options - Hook configuration options
 * @returns Query result with traffic events and controls
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { 
 *     data: events, 
 *     isLoading, 
 *     error,
 *     refetch,
 *     cancel
 *   } = useTrafficEvents({
 *     enabled: true,
 *     refetchInterval: 60000,
 *     geofence: BAY_AREA_BOUNDS,
 *     onSuccess: (events) => console.log(`Fetched ${events.length} events`),
 *     onError: (error) => console.error('Failed to fetch', error),
 *   });
 *   
 *   // Cancel request on user action
 *   const handleCancel = () => cancel();
 *   
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error />;
 *   
 *   return <EventList events={events} />;
 * }
 * ```
 */
export function useTrafficEvents(
  options: UseTrafficEventsOptions = {}
): UseTrafficEventsResult {
  const {
    enabled = true,
    refetchInterval,
    geofence,
    eventTypes,
    severities,
    onSuccess,
    onError,
    staleTime = 30000,
    cacheTime = 300000,
  } = options;

  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUnmountedRef = useRef(false);

  /**
   * Fetch function with AbortController support
   */
  const fetchEvents = useCallback(
    async ({ signal }: { signal: AbortSignal }): Promise<TrafficEvent[]> => {
      logger.debug('Fetching traffic events', {
        geofence,
        eventTypes,
        severities,
      });

      try {
        // Create AbortController for this request
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Link external signal to internal controller
        if (signal) {
          signal.addEventListener('abort', () => {
            controller.abort();
          });
        }

        // Fetch events from API with AbortSignal
        const events = await trafficAPI.fetchEvents(
          {
            eventTypes,
            severities,
          },
          {
            signal: controller.signal,
          }
        );

        // Filter by geofence if provided
        let filteredEvents = events;
        if (geofence) {
          filteredEvents = events.filter((event) => {
            if (event.geometry?.type === 'Point') {
              const [lng, lat] = event.geometry.coordinates as number[];
              return isWithinGeofence(lat, lng, geofence);
            }
            return true;
          });

          logger.debug(
            `Filtered ${events.length} events to ${filteredEvents.length} within geofence`
          );
        }

        return filteredEvents;
      } catch (error) {
        // Don't log abort errors
        if (error instanceof Error && error.name !== 'AbortError') {
          logger.error('Failed to fetch traffic events', { error });
        }
        throw error;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [geofence, eventTypes, severities]
  );

  /**
   * React Query hook with abort support
   */
  const queryResult = useQuery<TrafficEvent[], Error>({
    queryKey: getQueryKey(options),
    queryFn: fetchEvents,
    enabled,
    refetchInterval,
    staleTime,
    gcTime: cacheTime,
    retry: (failureCount, error) => {
      // Don't retry if aborted
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  /**
   * Handle success callback
   */
  useEffect(() => {
    if (queryResult.data && !isUnmountedRef.current && onSuccess) {
      onSuccess(queryResult.data);
    }
  }, [queryResult.data, onSuccess]);

  /**
   * Handle error callback
   */
  useEffect(() => {
    if (queryResult.error && !isUnmountedRef.current && onError) {
      // Don't call onError for abort errors
      if (queryResult.error.name !== 'AbortError') {
        onError(queryResult.error);
      }
    }
  }, [queryResult.error, onError]);

  /**
   * Cancel function to abort ongoing request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      logger.debug('Cancelling traffic events request');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Refetch function
   */
  const refetch = useCallback(async () => {
    await queryResult.refetch();
  }, [queryResult]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;

      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        logger.debug('Aborting traffic events request on unmount');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return {
    ...queryResult,
    refetch,
    cancel,
  };
}

// ============================================================================
// ADDITIONAL HOOKS
// ============================================================================

/**
 * Hook to prefetch traffic events
 * 
 * Useful for preloading data before navigating to a new view
 * 
 * @param options - Hook configuration options
 * @returns Prefetch function
 */
export function usePrefetchTrafficEvents() {
  const queryClient = useQueryClient();

  return useCallback(
    (options: UseTrafficEventsOptions = {}) => {
      const queryKey = getQueryKey(options);
      return queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const controller = new AbortController();
          try {
            return await trafficAPI.fetchEvents({}, { signal: controller.signal });
          } finally {
            controller.abort();
          }
        },
      });
    },
    [queryClient]
  );
}

/**
 * Hook to invalidate traffic events cache
 * 
 * Forces refetch of traffic events
 * 
 * @returns Invalidate function
 */
export function useInvalidateTrafficEvents() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: ['traffic-events'],
    });
  }, [queryClient]);
}

/**
 * Hook to get cached traffic events without fetching
 * 
 * @param options - Hook configuration options
 * @returns Cached traffic events or undefined
 */
export function useCachedTrafficEvents(
  options: UseTrafficEventsOptions = {}
): TrafficEvent[] | undefined {
  const queryClient = useQueryClient();
  const queryKey = getQueryKey(options);

  return queryClient.getQueryData<TrafficEvent[]>(queryKey);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useTrafficEvents;
