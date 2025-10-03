/**
 * @file hooks/useFetchWithAbort.ts
 * @description Reusable hook for fetch requests with AbortController cleanup
 * @version 1.0.0
 * 
 * FIXES BUG #15: Missing Abort Controller Cleanup
 */

import { useEffect, useRef, useCallback } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Fetch options with AbortSignal
 */
export interface FetchOptions extends RequestInit {
  signal?: AbortSignal;
}

/**
 * Result of fetch operation
 */
export interface FetchResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isAborted: boolean;
}

// ============================================================================
// ABORT CONTROLLER HOOK
// ============================================================================

/**
 * Custom hook to create and cleanup AbortController
 * 
 * @returns Tuple of [signal, abort function]
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const [signal, abort] = useAbortController();
 *   
 *   useEffect(() => {
 *     fetch('/api/data', { signal })
 *       .then(res => res.json())
 *       .then(data => console.log(data))
 *       .catch(err => {
 *         if (err.name !== 'AbortError') {
 *           console.error(err);
 *         }
 *       });
 *     
 *     // Cleanup happens automatically on unmount
 *   }, [signal]);
 *   
 *   return <button onClick={abort}>Cancel</button>;
 * }
 * ```
 */
export function useAbortController(): [AbortSignal, () => void] {
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create AbortController if it doesn't exist
  if (!abortControllerRef.current) {
    abortControllerRef.current = new AbortController();
  }

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return [abortControllerRef.current.signal, abort];
}

// ============================================================================
// FETCH WITH ABORT HOOK
// ============================================================================

/**
 * Hook for making fetch requests with automatic abort on unmount
 * 
 * @template T - Expected response type
 * @param url - URL to fetch
 * @param options - Fetch options (RequestInit)
 * @param dependencies - Dependencies to trigger refetch
 * @returns Fetch result with data, error, and loading state
 * 
 * @example
 * ```typescript
 * function MyComponent({ userId }: { userId: string }) {
 *   const { data, error, isLoading } = useFetchWithAbort<User>(
 *     `/api/users/${userId}`,
 *     { method: 'GET' },
 *     [userId]
 *   );
 *   
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error error={error} />;
 *   if (!data) return null;
 *   
 *   return <UserProfile user={data} />;
 * }
 * ```
 */
export function useFetchWithAbort<T = unknown>(
  url: string | null,
  options: FetchOptions = {},
  dependencies: React.DependencyList = []
): FetchResult<T> {
  const [signal, abort] = useAbortController();
  const resultRef = useRef<FetchResult<T>>({
    data: null,
    error: null,
    isLoading: false,
    isAborted: false,
  });

  useEffect(() => {
    // Don't fetch if URL is null
    if (!url) {
      return;
    }

    // Create a new AbortController for this effect
    const controller = new AbortController();
    let isSubscribed = true;

    const fetchData = async () => {
      resultRef.current = {
        data: null,
        error: null,
        isLoading: true,
        isAborted: false,
      };

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (isSubscribed) {
          resultRef.current = {
            data,
            error: null,
            isLoading: false,
            isAborted: false,
          };
        }
      } catch (error) {
        if (error instanceof Error) {
          // Check if it was aborted
          if (error.name === 'AbortError') {
            if (isSubscribed) {
              resultRef.current = {
                data: null,
                error: null,
                isLoading: false,
                isAborted: true,
              };
            }
          } else {
            // Real error
            if (isSubscribed) {
              resultRef.current = {
                data: null,
                error,
                isLoading: false,
                isAborted: false,
              };
            }
          }
        }
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [url, ...dependencies]);

  return resultRef.current;
}

// ============================================================================
// ASYNC CALLBACK WITH ABORT
// ============================================================================

/**
 * Hook for creating an async callback with AbortController
 * 
 * @template T - Return type of callback
 * @param callback - Async callback function
 * @param dependencies - Dependencies for callback
 * @returns Tuple of [wrapped callback, abort function, isLoading]
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const [submitForm, cancelSubmit, isSubmitting] = useAsyncCallback(
 *     async (signal, formData) => {
 *       const response = await fetch('/api/submit', {
 *         method: 'POST',
 *         body: JSON.stringify(formData),
 *         signal,
 *       });
 *       return response.json();
 *     },
 *     []
 *   );
 *   
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       submitForm(new FormData(e.target));
 *     }}>
 *       <button type="submit" disabled={isSubmitting}>Submit</button>
 *       <button type="button" onClick={cancelSubmit}>Cancel</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useAsyncCallback<T = void, Args extends any[] = []>(
  callback: (signal: AbortSignal, ...args: Args) => Promise<T>,
  dependencies: React.DependencyList = []
): [(...args: Args) => Promise<T | null>, () => void, boolean] {
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isLoadingRef.current = false;
    }
  }, []);

  const wrappedCallback = useCallback(
    async (...args: Args): Promise<T | null> => {
      // Abort previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController
      abortControllerRef.current = new AbortController();
      isLoadingRef.current = true;

      try {
        const result = await callback(abortControllerRef.current.signal, ...args);
        isLoadingRef.current = false;
        return result;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Request was aborted, return null
          return null;
        }
        // Re-throw other errors
        isLoadingRef.current = false;
        throw error;
      }
    },
    dependencies
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  return [wrappedCallback, abort, isLoadingRef.current];
}

// ============================================================================
// ABORT ON TIMEOUT
// ============================================================================

/**
 * Hook to create AbortController with automatic timeout
 * 
 * @param timeoutMs - Timeout in milliseconds
 * @returns Tuple of [signal, abort function, isTimedOut]
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const [signal, abort, isTimedOut] = useAbortWithTimeout(5000);
 *   
 *   useEffect(() => {
 *     fetch('/api/slow-endpoint', { signal })
 *       .then(res => res.json())
 *       .then(data => console.log(data))
 *       .catch(err => {
 *         if (isTimedOut) {
 *           console.error('Request timed out');
 *         } else if (err.name !== 'AbortError') {
 *           console.error(err);
 *         }
 *       });
 *   }, [signal]);
 *   
 *   return <div>{isTimedOut && 'Request timed out'}</div>;
 * }
 * ```
 */
export function useAbortWithTimeout(
  timeoutMs: number
): [AbortSignal, () => void, boolean] {
  const abortControllerRef = useRef<AbortController>(new AbortController());
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const isTimedOutRef = useRef(false);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Set up timeout
    timeoutIdRef.current = setTimeout(() => {
      isTimedOutRef.current = true;
      abortControllerRef.current.abort();
    }, timeoutMs);

    // Cleanup
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [timeoutMs]);

  return [abortControllerRef.current.signal, abort, isTimedOutRef.current];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an error is an AbortError
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Wrap a fetch call with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  useAbortController,
  useFetchWithAbort,
  useAsyncCallback,
  useAbortWithTimeout,
  isAbortError,
  fetchWithTimeout,
};
