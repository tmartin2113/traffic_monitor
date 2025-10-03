/**
 * @file hooks/useApiKeyManager.test.ts
 * @description Tests for API key management with cache clearing
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useApiKeyManager } from './useApiKeyManager';
import { trafficAPI } from '@services/api/trafficApi';

// Mock dependencies
vi.mock('@services/api/trafficApi', () => ({
  trafficAPI: {
    getApiKey: vi.fn(),
    setApiKey: vi.fn(),
    fetchEvents: vi.fn(),
  },
}));

vi.mock('./useLocalStorage', () => ({
  useLocalStorage: vi.fn((key, initialValue) => {
    const [value, setValue] = React.useState(initialValue);
    const remove = () => setValue(null);
    return [value, setValue, remove];
  }),
}));

vi.mock('@utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useApiKeyManager', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('API Key Validation', () => {
    it('should validate correct API key format', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      const validationResult = await act(async () => {
        return await result.current.validateApiKey(validKey);
      });

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.error).toBeUndefined();
    });

    it('should reject invalid API key format', async () => {
      const invalidKey = 'too-short';

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      const validationResult = await act(async () => {
        return await result.current.validateApiKey(invalidKey);
      });

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.code).toBe('FORMAT');
      expect(validationResult.error).toContain('format');
    });

    it('should handle unauthorized API key', async () => {
      const validFormatKey = 'abcd1234efgh5678ijkl9012mnop3456';

      const unauthorizedError = new Error('Unauthorized');
      (trafficAPI.fetchEvents as any).mockRejectedValueOnce(unauthorizedError);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      const validationResult = await act(async () => {
        return await result.current.validateApiKey(validFormatKey);
      });

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.code).toBe('UNAUTHORIZED');
    });

    it('should treat rate limited as valid', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      const rateLimitError = new Error('Rate limit exceeded');
      (trafficAPI.fetchEvents as any).mockRejectedValueOnce(rateLimitError);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      const validationResult = await act(async () => {
        return await result.current.validateApiKey(validKey);
      });

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.code).toBe('RATE_LIMITED');
    });

    it('should handle network errors', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      const networkError = new Error('Network request failed');
      (trafficAPI.fetchEvents as any).mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      const validationResult = await act(async () => {
        return await result.current.validateApiKey(validKey);
      });

      expect(validationResult.isValid).toBe(false);
      expect(validationResult.code).toBe('NETWORK');
    });
  });

  describe('Setting API Key', () => {
    it('should set valid API key', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.setApiKey(validKey);
      });

      expect(result.current.isValidApiKey).toBe(true);
      expect(result.current.apiKey).toBe(validKey);
      expect(result.current.error).toBeNull();
    });

    it('should reject invalid API key', async () => {
      const invalidKey = 'invalid';

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      await expect(async () => {
        await act(async () => {
          await result.current.setApiKey(invalidKey);
        });
      }).rejects.toThrow();

      expect(result.current.isValidApiKey).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it('should clear cache when setting new API key', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any).mockResolvedValueOnce([]);

      // Add some data to cache
      queryClient.setQueryData(['traffic-events'], [{ id: '1' }]);

      expect(queryClient.getQueryData(['traffic-events'])).toBeTruthy();

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.setApiKey(validKey);
      });

      // Cache should be cleared
      await waitFor(() => {
        expect(queryClient.getQueryData(['traffic-events'])).toBeUndefined();
      });
    });

    it('should trim whitespace from API key', async () => {
      const keyWithWhitespace = '  abcd1234efgh5678ijkl9012mnop3456  ';
      const trimmedKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.setApiKey(keyWithWhitespace);
      });

      expect(result.current.apiKey).toBe(trimmedKey);
    });
  });

  describe('Removing API Key', () => {
    it('should remove API key', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      // Set key first
      await act(async () => {
        await result.current.setApiKey(validKey);
      });

      expect(result.current.apiKey).toBe(validKey);

      // Remove key
      await act(async () => {
        await result.current.removeApiKey();
      });

      expect(result.current.apiKey).toBeNull();
      expect(result.current.isValidApiKey).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should clear cache when removing API key', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      // Set key and add cache data
      await act(async () => {
        await result.current.setApiKey(validKey);
      });

      queryClient.setQueryData(['traffic-events'], [{ id: '1' }]);

      expect(queryClient.getQueryData(['traffic-events'])).toBeTruthy();

      // Remove key
      await act(async () => {
        await result.current.removeApiKey();
      });

      // Cache should be cleared
      await waitFor(() => {
        expect(queryClient.getQueryData(['traffic-events'])).toBeUndefined();
      });
    });

    it('should clear API from trafficAPI service', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.setApiKey(validKey);
        await result.current.removeApiKey();
      });

      expect(trafficAPI.setApiKey).toHaveBeenLastCalledWith('');
    });
  });

  describe('Loading States', () => {
    it('should set isValidating during validation', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      let resolveValidation: (value: any) => void;
      const validationPromise = new Promise((resolve) => {
        resolveValidation = resolve;
      });

      (trafficAPI.fetchEvents as any).mockReturnValueOnce(validationPromise);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      // Start validation
      act(() => {
        result.current.setApiKey(validKey);
      });

      // Should be validating
      expect(result.current.isValidating).toBe(true);

      // Resolve validation
      await act(async () => {
        resolveValidation!([]);
        await validationPromise;
      });

      // Should no longer be validating
      await waitFor(() => {
        expect(result.current.isValidating).toBe(false);
      });
    });
  });

  describe('Manual Cache Clearing', () => {
    it('should provide clearCache function', async () => {
      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current.clearCache).toBe('function');
    });

    it('should clear cache when clearCache is called', async () => {
      queryClient.setQueryData(['traffic-events'], [{ id: '1' }]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.clearCache();
      });

      expect(queryClient.getQueryData(['traffic-events'])).toBeUndefined();
    });
  });

  describe('Environment Variable Key', () => {
    it('should use environment variable key if no stored key', async () => {
      const envKey = 'env1234efgh5678ijkl9012mnop3456env';

      // Mock environment variable
      vi.stubGlobal('import.meta', {
        env: {
          VITE_511_API_KEY: envKey,
        },
      });

      (trafficAPI.fetchEvents as any).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.apiKey).toBe(envKey);
      });

      vi.unstubAllGlobals();
    });
  });

  describe('Error Handling', () => {
    it('should set error message on validation failure', async () => {
      const invalidKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any).mockRejectedValueOnce(
        new Error('Unauthorized')
      );

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.setApiKey(invalidKey);
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toContain('Invalid API key');
    });

    it('should clear error on successful validation', async () => {
      const validKey = 'abcd1234efgh5678ijkl9012mnop3456';

      (trafficAPI.fetchEvents as any)
        .mockRejectedValueOnce(new Error('Unauthorized'))
        .mockResolvedValueOnce([]);

      const { result } = renderHook(() => useApiKeyManager(), {
        wrapper: createWrapper(),
      });

      // First attempt fails
      await act(async () => {
        try {
          await result.current.setApiKey('invalid_key_12345678901234567890');
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBeTruthy();

      // Second attempt succeeds
      await act(async () => {
        await result.current.setApiKey(validKey);
      });

      expect(result.current.error).toBeNull();
    });
  });
});
