/**
 * @file hooks/useDatabase.ts
 * @description React hooks for managing IndexedDB connections with automatic cleanup
 * @version 2.0.0 - ALL BUGS FIXED ✅
 * 
 * FIXES APPLIED:
 * ✅ BUG FIX #1: Replaced console.error in useDatabase() with logger.error
 * ✅ BUG FIX #2: Replaced console.error in useDatabaseQuery() with logger.error
 * ✅ BUG FIX #3: Replaced console.error in useDatabaseMutation() with logger.error
 * 
 * PRODUCTION STANDARDS:
 * - NO console.* statements (uses logger utility)
 * - Automatic connection cleanup on unmount
 * - Proper error handling
 * - TypeScript type safety
 * - Connection pooling via manager
 * - Memory leak prevention
 * 
 * @author Senior Development Team
 * @since 2.0.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { TrafficDatabase } from '../db/TrafficDatabase';
import { dbConnectionManager, withDatabase } from '../db/DatabaseConnectionManager';
import { StoredEvent } from '../db/TrafficDatabase';
import { logger } from '@utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Hook return type
 */
interface UseDatabaseReturn {
  db: TrafficDatabase | null;
  isReady: boolean;
  error: Error | null;
  retry: () => void;
}

// ============================================================================
// PRIMARY DATABASE HOOK
// ============================================================================

/**
 * Hook to manage database connection with automatic cleanup
 * FIXED BUG #1: Replaced console.error with logger.error
 * 
 * @param componentName - Optional component name for tracking
 * @returns Database instance, ready state, error state, and retry function
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { db, isReady, error } = useDatabase('MyComponent');
 *   
 *   useEffect(() => {
 *     if (isReady && db) {
 *       db.events.toArray().then(events => {
 *         console.log('Events:', events);
 *       });
 *     }
 *   }, [isReady, db]);
 *   
 *   // Cleanup is automatic on unmount
 * }
 * ```
 */
export function useDatabase(componentName?: string): UseDatabaseReturn {
  const [db, setDb] = useState<TrafficDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const componentNameRef = useRef(componentName || `Component_${Math.random().toString(36).substr(2, 9)}`);

  const retry = useCallback(() => {
    setRetryCount(prev => prev + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const name = componentNameRef.current;

    async function acquireConnection() {
      try {
        setError(null);
        const database = await dbConnectionManager.acquire(name);
        
        if (isMounted) {
          setDb(database);
          setIsReady(true);
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          setIsReady(false);
          
          // FIXED BUG #1: Replaced console.error with logger.error
          logger.error('Failed to acquire database connection in useDatabase hook', {
            componentName: name,
            error: error.message,
            stack: error.stack,
            retryCount,
          });
        }
      }
    }

    acquireConnection();

    // Cleanup: Release connection on unmount
    return () => {
      isMounted = false;
      setIsReady(false);
      dbConnectionManager.release(name);
    };
  }, [retryCount]);

  return { db, isReady, error, retry };
}

// ============================================================================
// DATABASE QUERY HOOK
// ============================================================================

/**
 * Hook to perform a database query with automatic connection management
 * FIXED BUG #2: Replaced console.error with logger.error
 * 
 * @param queryFn - Query function to execute
 * @param deps - Dependencies array (like useEffect)
 * @param componentName - Optional component name for tracking
 * @returns Query result, loading state, and error state
 * 
 * @example
 * ```tsx
 * function EventList() {
 *   const { data, loading, error } = useDatabaseQuery(
 *     async (db) => db.events.where('severity').equals('CRITICAL').toArray(),
 *     []
 *   );
 *   
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   return <div>{data?.length} critical events</div>;
 * }
 * ```
 */
export function useDatabaseQuery<T>(
  queryFn: (db: TrafficDatabase) => Promise<T>,
  deps: React.DependencyList,
  componentName?: string
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { db, isReady } = useDatabase(componentName);

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!isReady || !db) {
      return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    async function executeQuery() {
      try {
        setLoading(true);
        setError(null);

        // Add timeout to prevent hanging queries
        const result = await Promise.race([
          queryFn(db),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Query timeout')), 30000);
          })
        ]);

        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          
          // FIXED BUG #2: Replaced console.error with logger.error
          logger.error('Database query failed in useDatabaseQuery hook', {
            componentName,
            error: error.message,
            stack: error.stack,
            queryTimeout: error.message === 'Query timeout',
          });
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    executeQuery();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isReady, db, refetchTrigger, ...deps]);

  return { data, loading, error, refetch };
}

// ============================================================================
// DATABASE MUTATION HOOK
// ============================================================================

/**
 * Hook to perform a database mutation with automatic connection management
 * FIXED BUG #3: Replaced console.error with logger.error
 * 
 * @param componentName - Optional component name for tracking
 * @returns Mutation function, loading state, and error state
 * 
 * @example
 * ```tsx
 * function AddEventButton() {
 *   const { mutate, loading, error } = useDatabaseMutation('AddEventButton');
 *   
 *   const handleAdd = async () => {
 *     await mutate(async (db) => {
 *       await db.events.add(newEvent);
 *     });
 *   };
 *   
 *   return <button onClick={handleAdd} disabled={loading}>Add Event</button>;
 * }
 * ```
 */
export function useDatabaseMutation(componentName?: string): {
  mutate: <T>(mutationFn: (db: TrafficDatabase) => Promise<T>) => Promise<T>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { db, isReady } = useDatabase(componentName);

  const mutate = useCallback(async <T,>(
    mutationFn: (db: TrafficDatabase) => Promise<T>
  ): Promise<T> => {
    if (!isReady || !db) {
      throw new Error('Database not ready');
    }

    try {
      setLoading(true);
      setError(null);

      const result = await mutationFn(db);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      // FIXED BUG #3: Replaced console.error with logger.error
      logger.error('Database mutation failed in useDatabaseMutation hook', {
        componentName,
        error: error.message,
        stack: error.stack,
      });
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isReady, db, componentName]);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { mutate, loading, error, reset };
}

// ============================================================================
// DATABASE SUBSCRIPTION HOOK
// ============================================================================

/**
 * Hook to subscribe to database changes
 * 
 * @param tableName - Name of the table to observe
 * @param callback - Callback function to execute on changes
 * @param componentName - Optional component name for tracking
 * 
 * @example
 * ```tsx
 * function LiveEventCounter() {
 *   const [count, setCount] = useState(0);
 *   
 *   useDatabaseSubscription('events', async (db) => {
 *     const newCount = await db.events.count();
 *     setCount(newCount);
 *   });
 *   
 *   return <div>Events: {count}</div>;
 * }
 * ```
 */
export function useDatabaseSubscription(
  tableName: keyof TrafficDatabase,
  callback: (db: TrafficDatabase) => Promise<void>,
  componentName?: string
): void {
  const { db, isReady } = useDatabase(componentName);

  useEffect(() => {
    if (!isReady || !db) {
      return;
    }

    let isMounted = true;

    // Initial callback execution
    callback(db).catch(err => {
      logger.error('Database subscription initial callback failed', {
        tableName,
        componentName,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Subscribe to table changes
    const table = db[tableName] as any;
    if (!table || typeof table.hook !== 'function') {
      logger.warn('Database table does not support hooks', {
        tableName,
        componentName,
        availableTables: db.tables.map(t => t.name),
      });
      return;
    }

    // Helper to execute callback safely
    const executeCallback = (eventType: string) => {
      if (isMounted) {
        callback(db).catch(err => {
          logger.error('Database subscription callback failed', {
            tableName,
            eventType,
            componentName,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    };

    // Subscribe to table events
    const subscription = table.hook('creating', () => executeCallback('creating'));
    const subscription2 = table.hook('updating', () => executeCallback('updating'));
    const subscription3 = table.hook('deleting', () => executeCallback('deleting'));

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      if (subscription2 && typeof subscription2.unsubscribe === 'function') {
        subscription2.unsubscribe();
      }
      if (subscription3 && typeof subscription3.unsubscribe === 'function') {
        subscription3.unsubscribe();
      }
    };
  }, [isReady, db, tableName, callback, componentName]);
}

// ============================================================================
// DATABASE STATISTICS HOOK
// ============================================================================

/**
 * Hook to get database statistics
 * 
 * @example
 * ```tsx
 * function DatabaseStats() {
 *   const stats = useDatabaseStats();
 *   return <div>Active connections: {stats.activeConnections}</div>;
 * }
 * ```
 */
export function useDatabaseStats() {
  const [stats, setStats] = useState(dbConnectionManager.getStatistics());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setStats(dbConnectionManager.getStatistics());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return stats;
}

// ============================================================================
// FORCE CLOSE HOOK
// ============================================================================

/**
 * Hook to force close all database connections (use with caution)
 * 
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const { forceClose, isClosing } = useForceCloseDatabase();
 *   
 *   return (
 *     <button onClick={forceClose} disabled={isClosing}>
 *       Force Close All Connections
 *     </button>
 *   );
 * }
 * ```
 */
export function useForceCloseDatabase(): {
  forceClose: () => Promise<void>;
  isClosing: boolean;
} {
  const [isClosing, setIsClosing] = useState(false);

  const forceClose = useCallback(async () => {
    setIsClosing(true);
    try {
      await dbConnectionManager.forceClose();
    } finally {
      setIsClosing(false);
    }
  }, []);

  return { forceClose, isClosing };
}

// ============================================================================
// EXPORT
// ============================================================================

export default useDatabase;
