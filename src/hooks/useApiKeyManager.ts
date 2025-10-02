/**
 * useApiKeyManager Hook
 * Manages API key storage and validation
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { trafficAPI } from '@services/api/trafficApi';
import { STORAGE_KEYS } from '@utils/constants';

interface UseApiKeyManagerResult {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  removeApiKey: () => void;
  isValidApiKey: boolean;
  isValidating: boolean;
  validateApiKey: (key: string) => Promise<boolean>;
  error: string | null;
}

export function useApiKeyManager(): UseApiKeyManagerResult {
  const [storedApiKey, setStoredApiKey, removeStoredApiKey] = useLocalStorage<string | null>(
    STORAGE_KEYS.API_KEY,
    null
  );
  
  const [isValidApiKey, setIsValidApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate API key format
  const isValidFormat = useCallback((key: string): boolean => {
    if (!key || typeof key !== 'string') return false;
    // Basic validation - API keys are typically alphanumeric and at least 20 characters
    const keyPattern = /^[a-zA-Z0-9_-]{20,64}$/;
    return keyPattern.test(key.trim());
  }, []);

  // Validate API key with actual API call
  const validateApiKey = useCallback(async (key: string): Promise<boolean> => {
    if (!isValidFormat(key)) {
      setError('Invalid API key format');
      return false;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Set the API key temporarily
      const originalKey = trafficAPI.getApiKey();
      trafficAPI.setApiKey(key);

      // Try to fetch events with minimal parameters to test the key
      await trafficAPI.fetchEvents({ limit: 1 });
      
      // If successful, the key is valid
      setIsValidApiKey(true);
      setError(null);
      return true;
    } catch (err: any) {
      // Check if it's an authentication error
      if (err.code === 'UNAUTHORIZED' || err.statusCode === 401) {
        setError('Invalid API key. Please check your key and try again.');
      } else if (err.code === 'RATE_LIMITED' || err.statusCode === 429) {
        // Rate limited means the key is valid but we hit the limit
        setIsValidApiKey(true);
        setError('Rate limit reached, but API key is valid.');
        return true;
      } else {
        setError('Failed to validate API key. Please try again.');
      }
      
      setIsValidApiKey(false);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [isValidFormat]);

  // Set API key
  const setApiKey = useCallback((key: string) => {
    const trimmedKey = key.trim();
    
    if (!isValidFormat(trimmedKey)) {
      setError('Invalid API key format');
      return;
    }

    // Store the key
    setStoredApiKey(trimmedKey);
    trafficAPI.setApiKey(trimmedKey);
    
    // Validate it asynchronously
    validateApiKey(trimmedKey);
  }, [isValidFormat, setStoredApiKey, validateApiKey]);

  // Remove API key
  const removeApiKey = useCallback(() => {
    removeStoredApiKey();
    trafficAPI.setApiKey('');
    setIsValidApiKey(false);
    setError(null);
  }, [removeStoredApiKey]);

  // Validate stored API key on mount
  useEffect(() => {
    if (storedApiKey && !isValidApiKey && !isValidating) {
      trafficAPI.setApiKey(storedApiKey);
      validateApiKey(storedApiKey);
    }
  }, []); // Only run on mount

  // Check environment variable for default API key
  useEffect(() => {
    const envApiKey = import.meta.env.VITE_511_API_KEY;
    if (envApiKey && !storedApiKey) {
      setApiKey(envApiKey);
    }
  }, [storedApiKey, setApiKey]);

  return {
    apiKey: storedApiKey,
    setApiKey,
    removeApiKey,
    isValidApiKey,
    isValidating,
    validateApiKey,
    error,
  };
}
