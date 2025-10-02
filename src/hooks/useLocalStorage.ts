/**
 * useLocalStorage Hook
 * Manages state persistence in localStorage with TypeScript support
 * 
 * @module hooks/useLocalStorage
 * @version 1.0.1
 */

import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = T | ((prevValue: T) => T);

interface UseLocalStorageOptions {
  serializer?: (value: any) => string;
  deserializer?: (value: string) => any;
  syncData?: boolean;
  initializeFromStorage?: boolean;
}

/**
 * Custom hook for managing localStorage with React state
 * 
 * Features:
 * - Automatic synchronization with localStorage
 * - Cross-tab synchronization via storage events
 * - Custom serialization/deserialization
 * - Type-safe with TypeScript generics
 * - Error handling for quota exceeded and parse errors
 * 
 * @param key - localStorage key
 * @param defaultValue - Default value if key doesn't exist
 * @param options - Configuration options
 * @returns [storedValue, setValue, removeValue]
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: UseLocalStorageOptions = {}
): [T, (value: SetValue<T>) => void, () => void] {
  const {
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    syncData = true,
    initializeFromStorage = true,
  } = options;

  // Initialize state with value from localStorage or default
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (!initializeFromStorage) {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      
      if (item === null) {
        return defaultValue;
      }

      return deserializer(item);
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      if (storedValue === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, serializer(storedValue));
      }
    } catch (error) {
      // Handle QuotaExceededError
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error(
          `localStorage quota exceeded for key "${key}". Consider clearing old data.`
        );
      } else {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    }
  }, [key, storedValue, serializer]);

  // Handle storage events for cross-tab synchronization
  useEffect(() => {
    if (!syncData) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== key || e.storageArea !== localStorage) return;

      try {
        if (e.newValue === null) {
          setStoredValue(defaultValue);
        } else {
          const newValue = deserializer(e.newValue);
          setStoredValue(newValue);
        }
      } catch (error) {
        console.error(`Error syncing localStorage key "${key}":`, error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue, deserializer, syncData]);

  // Set value function
  const setValue = useCallback(
    (value: SetValue<T>) => {
      try {
        // Allow value to be a function for functional updates
        setStoredValue(prevValue => {
          const valueToStore = value instanceof Function ? value(prevValue) : value;
          return valueToStore;
        });
      } catch (error) {
        console.error(`Error updating localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  // Remove value function
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      setStoredValue(defaultValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, defaultValue]);

  return [storedValue, setValue, removeValue];
}

/**
 * Hook variant that returns an object instead of tuple
 * Useful for better readability with named properties
 */
export function useLocalStorageObject<T>(
  key: string,
  defaultValue: T,
  options: UseLocalStorageOptions = {}
) {
  const [value, setValue, removeValue] = useLocalStorage(key, defaultValue, options);

  return {
    value,
    setValue,
    removeValue,
    reset: () => setValue(defaultValue),
  };
}

export default useLocalStorage;
