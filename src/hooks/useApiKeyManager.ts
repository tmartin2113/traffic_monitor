/**
 * @file hooks/useApiKeyManager.ts
 * @description API key management with React Query cache clearing
 * @version 2.0.0
 * 
 * FIXES BUG #16: Now properly clears React Query cache when API key changes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalStorage } from './useLocalStorage';
import { trafficAPI } from '@services/api/trafficApi';
import { STORAGE_KEYS } from '@utils/constants';
import { logger } from '@utils/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * API key validation result
 */
interface ValidationResult {
  isValid: boolean;
  error?: string;
  code?: 'FORMAT' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'NETWORK' | 'UNKNOWN';
}

/**
 * Return type for useApiKeyManager hook
 */
export interface UseApiKeyManagerResult {
  /** Current API key */
  apiKey: string | null;
  /** Set new API key (validates and stores) */
  setApiKey: (key: string) => Promise<void>;
  /** Remove API key and clear cache */
  removeApiKey: () => Promise<void>;
  /** Whether the stored key is valid */
  isValidApiKey: boolean;
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Validate an API key without storing it */
  validateApiKey: (key: string) => Promise<ValidationResult>;
  /** Current error message */
  error: string | null;
  /** Clear all cached data */
  clearCache: () => Promise<void>;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate API key format
 */
function isValidKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  const trimmed = key.trim();

  // Basic validation - API keys are typically alphanumeric and at least 20 characters
  const keyPattern = /^[a-zA-Z0-9_-]{20,64}$/;
  return keyPattern.test(trimmed);
}

/**
 * Parse API error into user-friendly message
 */
function parseApiError(error: unknown): { message: string; code: ValidationResult['code'] } {
  if (!error) {
    return { message: 'Unknown error occurred', code: 'UNKNOWN' };
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('unauthorized') || message.includes('401')) {
      return {
        message: 'Invalid API key. Please check your key and try again.',
        code: 'UNAUTHORIZED',
      };
    }

    if (message.includes('rate limit') || message.includes('429')) {
      return {
        message: 'Rate limit reached. The API key is valid but you have exceeded the rate limit.',
        code: 'RATE_LIMITED',
      };
    }

    if (message.includes('network') || message.includes('fetch')) {
      return {
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK',
      };
    }

    return { message: error.message, code: 'UNKNOWN' };
  }

  return { message: 'An unexpected error occurred', code: 'UNKNOWN' };
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for managing API key with automatic cache clearing
 * 
 * Features:
 * - API key validation before storing
 * - Automatic React Query cache clearing on key change
 * - LocalStorage persistence
 * - Format validation
 * - Error handling with user-friendly messages
 * - Loading states
 * 
 * @returns API key manager interface
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const {
 *     apiKey,
 *     setApiKey,
 *     removeApiKey,
 *     isValidApiKey,
 *     isValidating,
 *     error,
 *   } = useApiKeyManager();
 *   
 *   const handleSubmit = async (key: string) => {
 *     await setApiKey(key); // Validates and clears cache
 *   };
 *   
 *   return (
 *     <div>
 *       {error && <p>{error}</p>}
 *       {isValidating && <p>Validating...</p>}
 *       <button onClick={() => removeApiKey()}>Remove Key</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useApiKeyManager(): UseApiKeyManagerResult {
  // React Query client for cache management
  const queryClient = useQueryClient();

  // LocalStorage for persistence
  const [storedApiKey, setStoredApiKey, removeStoredApiKey] = useLocalStorage<string | null>(
    STORAGE_KEYS.API_KEY,
    null
  );

  // State
  const [isValidApiKey, setIsValidApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've done initial validation
  const hasValidatedRef = useRef(false);

  /**
   * Validate API key with actual API call
   */
  const validateApiKey = useCallback(
    async (key: string): Promise<ValidationResult> => {
      // Format validation first
      if (!isValidKeyFormat(key)) {
        return {
          isValid: false,
          error: 'Invalid API key format. Key should be 20-64 alphanumeric characters.',
          code: 'FORMAT',
        };
      }

      setIsValidating(true);
      setError(null);

      try {
        // Temporarily set the API key for testing
        const originalKey = trafficAPI.getApiKey();
        trafficAPI.setApiKey(key);

        logger.debug('Validating API key...');

        // Try to fetch minimal data to test the key
        await trafficAPI.fetchEvents(
          { limit: 1 },
          {
            signal: AbortSignal.timeout(10000), // 10 second timeout
          }
        );

        // If successful, the key is valid
        logger.info('API key validated successfully');
        return { isValid: true };
      } catch (err: unknown) {
        logger.warn('API key validation failed', { error: err });

        const { message, code } = parseApiError(err);

        // Special case: rate limited means key is actually valid
        if (code === 'RATE_LIMITED') {
          logger.info('API key valid but rate limited');
          return {
            isValid: true,
            error: message,
            code,
          };
        }

        return {
          isValid: false,
          error: message,
          code,
        };
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  /**
   * Set API key with validation and cache clearing
   */
  const setApiKey = useCallback(
    async (key: string): Promise<void> => {
      const trimmedKey = key.trim();

      logger.debug('Setting new API key');

      // Validate the key
      const result = await validateApiKey(trimmedKey);

      if (!result.isValid) {
        setError(result.error || 'Invalid API key');
        setIsValidApiKey(false);
        throw new Error(result.error || 'Invalid API key');
      }

      // Key is valid - store it
      setStoredApiKey(trimmedKey);
      trafficAPI.setApiKey(trimmedKey);
      setIsValidApiKey(true);
      setError(result.error || null); // May have rate limit warning

      // CRITICAL: Clear React Query cache when API key changes
      logger.debug('Clearing React Query cache due to API key change');
      await queryClient.clear();

      logger.info('API key set and cache cleared successfully');
    },
    [validateApiKey, setStoredApiKey, queryClient]
  );

  /**
   * Remove API key and clear all cached data
   */
  const removeApiKey = useCallback(async (): Promise<void> => {
    logger.debug('Removing API key');

    // Remove from storage
    removeStoredApiKey();

    // Clear from API client
    trafficAPI.setApiKey('');

    // Update state
    setIsValidApiKey(false);
    setError(null);

    // CRITICAL: Clear React Query cache when API key is removed
    logger.debug('Clearing React Query cache due to API key removal');
    await queryClient.clear();

    logger.info('API key removed and cache cleared successfully');
  }, [removeStoredApiKey, queryClient]);

  /**
   * Manually clear cache
   */
  const clearCache = useCallback(async (): Promise<void> => {
    logger.debug('Manually clearing React Query cache');
    await queryClient.clear();
    logger.info('Cache cleared successfully');
  }, [queryClient]);

  /**
   * Validate stored API key on mount (only once)
   */
  useEffect(() => {
    if (storedApiKey && !hasValidatedRef.current && !isValidating) {
      hasValidatedRef.current = true;

      logger.debug('Validating stored API key on mount');

      // Set the key in the API client
      trafficAPI.setApiKey(storedApiKey);

      // Validate asynchronously
      validateApiKey(storedApiKey)
        .then((result) => {
          setIsValidApiKey(result.isValid);
          if (result.error) {
            setError(result.error);
          }
        })
        .catch((err) => {
          logger.error('Failed to validate stored API key', { error: err });
          setIsValidApiKey(false);
          setError('Failed to validate stored API key');
        });
    }
  }, []); // Only run on mount

  /**
   * Check for environment variable API key
   */
  useEffect(() => {
    const envApiKey = import.meta.env.VITE_511_API_KEY;

    if (envApiKey && !storedApiKey && !hasValidatedRef.current) {
      logger.debug('Found API key in environment variables');

      // Auto-set environment variable key
      setApiKey(envApiKey).catch((err) => {
        logger.error('Failed to set environment API key', { error: err });
      });
    }
  }, [storedApiKey, setApiKey]);

  /**
   * Cleanup: clear cache on unmount if key is invalid
   */
  useEffect(() => {
    return () => {
      if (!isValidApiKey && storedApiKey) {
        logger.debug('Clearing cache on unmount due to invalid key');
        queryClient.clear();
      }
    };
  }, [isValidApiKey, storedApiKey, queryClient]);

  return {
    apiKey: storedApiKey,
    setApiKey,
    removeApiKey,
    isValidApiKey,
    isValidating,
    validateApiKey,
    error,
    clearCache,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to check if API key is configured
 */
export function useHasApiKey(): boolean {
  const { apiKey } = useApiKeyManager();
  return apiKey !== null && apiKey.length > 0;
}

/**
 * Hook to require API key (throws if not configured)
 */
export function useRequireApiKey(): void {
  const { apiKey, isValidApiKey } = useApiKeyManager();

  useEffect(() => {
    if (!apiKey || !isValidApiKey) {
      throw new Error('API key is required but not configured or invalid');
    }
  }, [apiKey, isValidApiKey]);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useApiKeyManager;
