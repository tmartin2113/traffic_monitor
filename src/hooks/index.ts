/**
 * Custom Hooks Barrel Export
 * Central export point for all custom React hooks
 * 
 * @module hooks
 * @description Provides reusable React hooks for the 511 Traffic Monitor application.
 * Includes hooks for API integration, state management, geolocation, and UI controls.
 * 
 * @author Senior Development Team
 * @since 1.0.0
 * @license MIT
 */

// ============================================
// Traffic Data Hooks
// ============================================

export { 
  useTrafficEvents,
  type UseTrafficEventsOptions,
  type UseTrafficEventsResult 
} from './useTrafficEvents';

// ============================================
// API Management Hooks
// ============================================

export { 
  useApiKeyManager,
  type UseApiKeyManagerResult 
} from './useApiKeyManager';

// ============================================
// Storage Hooks
// ============================================

export { 
  useLocalStorage,
  type UseLocalStorageOptions 
} from './useLocalStorage';

// ============================================
// Geolocation Hooks
// ============================================

export { 
  useGeofencing,
  type UseGeofencingOptions,
  type UseGeofencingResult 
} from './useGeofencing';

// ============================================
// Map Control Hooks
// ============================================

export { 
  useMapControls,
  type UseMapControlsOptions,
  type UseMapControlsResult 
} from './useMapControls';

// ============================================
// Utility Hooks (if they exist)
// ============================================

// Export these if the files exist in your hooks directory
// export { useDebounce } from './useDebounce';
// export { useThrottle } from './useThrottle';
// export { useMediaQuery } from './useMediaQuery';
// export { usePrevious } from './usePrevious';
// export { useOnClickOutside } from './useOnClickOutside';
// export { useIntersectionObserver } from './useIntersectionObserver';
// export { useWindowSize } from './useWindowSize';

// ============================================
// Hook Utilities
// ============================================

/**
 * Hook configuration constants
 */
export const HOOK_CONFIG = {
  DEFAULT_POLLING_INTERVAL: 60000,
  DEFAULT_CACHE_TIME: 30000,
  DEFAULT_STALE_TIME: 5000,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
} as const;

/**
 * Hook status types
 */
export type HookStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Common hook error type
 */
export interface HookError {
  message: string;
  code?: string;
  statusCode?: number;
  timestamp: Date;
}

/**
 * Common hook options interface
 */
export interface BaseHookOptions {
  enabled?: boolean;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  retry?: boolean | number;
  retryDelay?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: HookError) => void;
}

// ============================================
// Version Information
// ============================================

export const HOOKS_VERSION = '1.0.0' as const;

// ============================================
// Re-export common React hooks with type safety
// ============================================

export {
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
