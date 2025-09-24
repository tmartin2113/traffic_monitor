/**
 * useLocalStorage Hook
 * Manages state persistence in localStorage with TypeScript support
 */

import { useState, useEffect, useCallback, useRef } from 'react';

type SetValue<T> = T | ((prevValue: T) => T);

interface UseLocalStorageOptions {
  serializer?: (value: any) => string;
  deserializer?: (value: string) => any;
  syncData?: boolean;
  initializeFromStorage?: boolean;
}

/**
 * Custom hook for managing localStorage with React state
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

  const isFirstRender = useRef(true);

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
    // Skip the first render if we initialized from storage
    if (isFirstRender.current && initializeFromStorage) {
      isFirstRender.current = false;
      return;
    }

    try {
      if (storedValue === undefined) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, serializer(storedValue));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
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
        // Allow value to be a function
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
 * Hook for managing multiple localStorage keys
 */
export function useLocalStorageMultiple<T extends Record<string, any>>(
  keys: Record<keyof T, any>,
  options: UseLocalStorageOptions = {}
): {
  values: T;
  setValue: (key: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  removeValue: (key: keyof T) => void;
  clearAll: () => void;
} {
  const storageHooks = {} as Record<keyof T, ReturnType<typeof useLocalStorage>>;

  // Create individual hooks for each key
  Object.entries(keys).forEach(([k, defaultValue]) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    storageHooks[k as keyof T] = useLocalStorage(k, defaultValue, options);
  });

  // Aggregate values
  const values = Object.entries(storageHooks).reduce((acc, [k, [value]]) => {
    acc[k as keyof T] = value;
    return acc;
  }, {} as T);

  // Set individual value
  const setValue = useCallback((key: keyof T, value: any) => {
    if (storageHooks[key]) {
      const [, setter] = storageHooks[key];
      setter(value);
    }
  }, [storageHooks]);

  // Set multiple values
  const setValues = useCallback((newValues: Partial<T>) => {
    Object.entries(newValues).forEach(([k, v]) => {
      setValue(k as keyof T, v);
    });
  }, [setValue]);

  // Remove individual value
  const removeValue = useCallback((key: keyof T) => {
    if (storageHooks[key]) {
      const [, , remover] = storageHooks[key];
      remover();
    }
  }, [storageHooks]);

  // Clear all values
  const clearAll = useCallback(() => {
    Object.keys(storageHooks).forEach(k => {
      removeValue(k as keyof T);
    });
  }, [storageHooks, removeValue]);

  return {
    values,
    setValue,
    setValues,
    removeValue,
    clearAll,
  };
}

/**
 * Hook for checking localStorage availability
 */
export function useLocalStorageAvailable(): boolean {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    try {
      const testKey = '__localStorage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      setIsAvailable(true);
    } catch {
      setIsAvailable(false);
    }
  }, []);

  return isAvailable;
}

/**
 * Hook for getting localStorage size
 */
export function useLocalStorageSize(): { used: number; total: number; percentage: number } {
  const [size, setSize] = useState({ used: 0, total: 0, percentage: 0 });

  useEffect(() => {
    const calculateSize = () => {
      try {
        let usedSpace = 0;
        
        // Calculate used space (rough estimate)
        for (const key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            const item = localStorage.getItem(key);
            if (item) {
              usedSpace += key.length + item.length;
            }
          }
        }

        // Most browsers have 5-10MB limit
        const totalSpace = 5 * 1024 * 1024; // 5MB in bytes
        const percentage = (usedSpace / totalSpace) * 100;

        setSize({
          used: usedSpace,
          total: totalSpace,
          percentage: Math.min(percentage, 100),
        });
      } catch (error) {
        console.error('Error calculating localStorage size:', error);
      }
    };

    calculateSize();
    
    // Recalculate on storage events
    const handleStorage = () => calculateSize();
    window.addEventListener('storage', handleStorage);
    
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return size;
}
