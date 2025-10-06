import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@/utils/logger';
import Dexie from 'dexie';

/**
 * NOTE: This file expects a useDatabase() hook to exist in the same file
 * that returns: { db: TrafficDatabase, isReady: boolean, error: Error | null }
 * 
 * You should have your own implementation of useDatabase() that initializes
 * and manages your Dexie database instance.
 */

/**
 * Database table type definition
 * Replace with your actual table types
 */
interface TrafficDatabase extends Dexie {
  traffic: Dexie.Table<any, number>;
  sessions: Dexie.Table<any, number>;
  analytics: Dexie.Table<any, number>;
  [key: string]: any;
}

/**
 * Database status and instance
 */
interface DatabaseState {
  db: TrafficDatabase;
  isReady: boolean;
  error: Error | null;
}

/**
 * Custom error class for database subscription errors
 */
class DatabaseSubscriptionError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseSubscriptionError';
    Object.setPrototypeOf(this, DatabaseSubscriptionError.prototype);
  }
}

/**
 * Type guard to check if callback is async
 */
function isAsyncFunction(fn: Function): boolean {
  return fn.constructor.name === 'AsyncFunction';
}

/**
 * Validates the callback function
 * @throws {DatabaseSubscriptionError} If callback is invalid
 */
function validateCallback(
  callback: (db: TrafficDatabase) => Promise<void> | void
): void {
  if (typeof callback !== 'function') {
    throw new DatabaseSubscriptionError('Callback must be a function', {
      callbackType: typeof callback,
    });
  }
}

/**
 * Validates the table name exists in the database
 * @throws {DatabaseSubscriptionError} If table doesn't exist
 */
function validateTableName(
  db: TrafficDatabase,
  tableName: keyof TrafficDatabase
): void {
  if (!db || typeof db !== 'object') {
    throw new DatabaseSubscriptionError('Invalid database instance', {
      dbType: typeof db,
    });
  }

  if (!db[tableName]) {
    const availableTables = Object.keys(db.tables || {});
    throw new DatabaseSubscriptionError(
      `Table '${String(tableName)}' does not exist in database`,
      {
        tableName: String(tableName),
        availableTables,
      }
    );
  }

  // Verify it's actually a Dexie table
  if (typeof db[tableName].toArray !== 'function') {
    throw new DatabaseSubscriptionError(
      `'${String(tableName)}' is not a valid Dexie table`,
      {
        tableName: String(tableName),
        type: typeof db[tableName],
      }
    );
  }
}

/**
 * Subscribe to changes in a database table with automatic cleanup and error handling.
 *
 * This hook sets up a subscription to a Dexie database table and executes a callback
 * whenever the table changes. The subscription is automatically cleaned up when the
 * component unmounts or when dependencies change.
 *
 * **CRITICAL FIX:** This version correctly includes `tableName` in the dependency array
 * to prevent stale closure bugs. The previous buggy version omitted `tableName`, causing
 * subscriptions to potentially listen to the wrong table when the prop changed.
 *
 * @param tableName - The name of the database table to subscribe to. Must be a valid
 *                    key of TrafficDatabase. Changes to this value will re-establish
 *                    the subscription.
 * @param callback - Function called when table changes. Can be async or sync. This should
 *                   be wrapped in useCallback to prevent unnecessary re-subscriptions.
 * @param componentName - Optional name for logging and debugging purposes. Helps identify
 *                        which component created the subscription in logs.
 *
 * @throws {DatabaseSubscriptionError} If callback is not a function or table doesn't exist
 *
 * @example
 * ```typescript
 * // Basic usage
 * useDatabaseSubscription('traffic', async (db) => {
 *   const data = await db.traffic.toArray();
 *   setTrafficData(data);
 * });
 *
 * // With component name for better logging
 * useDatabaseSubscription(
 *   'sessions',
 *   useCallback(async (db) => {
 *     const sessions = await db.sessions.where('active').equals(1).toArray();
 *     setSessions(sessions);
 *   }, []),
 *   'SessionMonitor'
 * );
 *
 * // Dynamic table name (will re-subscribe when table changes)
 * const [selectedTable, setSelectedTable] = useState('traffic');
 * useDatabaseSubscription(selectedTable, handleTableChange, 'DynamicMonitor');
 * ```
 */
export function useDatabaseSubscription(
  tableName: keyof TrafficDatabase,
  callback: (db: TrafficDatabase) => Promise<void> | void,
  componentName?: string
): void {
  const { db, isReady, error: dbError } = useDatabase(componentName);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef<boolean>(true);

  // Track the current subscription ID for logging
  const subscriptionIdRef = useRef<string>(
    `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  // Track if we're currently processing a callback to prevent overlapping executions
  const isProcessingRef = useRef<boolean>(false);

  // Stable reference to latest callback to avoid unnecessary effect triggers
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Early return if database is not ready
    if (!isReady || !db) {
      logger.debug('Database subscription waiting for database to be ready', {
        tableName: String(tableName),
        componentName,
        subscriptionId: subscriptionIdRef.current,
        isReady,
        hasDb: !!db,
      });
      return;
    }

    // Early return if there's a database error
    if (dbError) {
      logger.error('Cannot establish database subscription due to database error', {
        tableName: String(tableName),
        componentName,
        subscriptionId: subscriptionIdRef.current,
        error: dbError.message,
      });
      return;
    }

    // Validate inputs
    try {
      validateCallback(callback);
      validateTableName(db, tableName);
    } catch (error) {
      logger.error('Database subscription validation failed', {
        tableName: String(tableName),
        componentName,
        subscriptionId: subscriptionIdRef.current,
        error: error instanceof Error ? error.message : String(error),
        context: error instanceof DatabaseSubscriptionError ? error.context : undefined,
      });
      // Re-throw validation errors in development to make them visible
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
      return;
    }

    const table = db[tableName] as Dexie.Table<any, any>;
    const subId = subscriptionIdRef.current;

    logger.info('Database subscription established', {
      tableName: String(tableName),
      componentName,
      subscriptionId: subId,
      isAsync: isAsyncFunction(callback),
    });

    /**
     * Executes the callback with comprehensive error handling
     */
    const executeCallback = async (): Promise<void> => {
      // Skip if component unmounted
      if (!isMountedRef.current) {
        logger.debug('Skipping callback execution - component unmounted', {
          tableName: String(tableName),
          subscriptionId: subId,
        });
        return;
      }

      // Prevent overlapping executions
      if (isProcessingRef.current) {
        logger.debug('Skipping callback execution - previous execution still in progress', {
          tableName: String(tableName),
          subscriptionId: subId,
        });
        return;
      }

      isProcessingRef.current = true;

      try {
        const startTime = performance.now();

        // Execute the callback
        const result = callbackRef.current(db);

        // Handle async callbacks
        if (result instanceof Promise) {
          await result;
        }

        const duration = performance.now() - startTime;

        logger.debug('Database subscription callback executed successfully', {
          tableName: String(tableName),
          componentName,
          subscriptionId: subId,
          durationMs: duration.toFixed(2),
        });
      } catch (error) {
        logger.error('Error executing database subscription callback', {
          tableName: String(tableName),
          componentName,
          subscriptionId: subId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Don't re-throw - we want to keep the subscription active
        // The error is logged and the next change will trigger a new callback
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Set up the Dexie hook for table changes
    // Dexie's on('changes') hook triggers whenever the table is modified
    const unsubscribe = table.hook('creating', executeCallback);
    const unsubscribeUpdating = table.hook('updating', executeCallback);
    const unsubscribeDeleting = table.hook('deleting', executeCallback);

    // Execute callback immediately to get initial state
    executeCallback().catch((error) => {
      logger.error('Error during initial callback execution', {
        tableName: String(tableName),
        componentName,
        subscriptionId: subId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Cleanup function
    return () => {
      logger.info('Database subscription cleanup', {
        tableName: String(tableName),
        componentName,
        subscriptionId: subId,
      });

      // Unsubscribe from all hooks
      unsubscribe();
      unsubscribeUpdating();
      unsubscribeDeleting();

      // Reset processing flag
      isProcessingRef.current = false;
    };

    // ✅ CRITICAL FIX: Include ALL dependencies, especially tableName
    // The original bug omitted tableName, causing stale closure issues
  }, [isReady, db, dbError, callback, componentName, tableName]);
}

// Named exports for testing and validation
export { validateCallback, validateTableName, DatabaseSubscriptionError };
