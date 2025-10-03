/**
 * @file hooks/useFetchWithAbort.test.ts
 * @description Tests for fetch hooks with AbortController
 * @version 1.0.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useAbortController,
  useFetchWithAbort,
  useAsyncCallback,
  useAbortWithTimeout,
  isAbortError,
  fetchWithTimeout,
} from './useFetchWithAbort';

// Mock global fetch
global.fetch = vi.fn();

describe('useFetchWithAbort', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useAbortController', () => {
    it('should create AbortSignal', () => {
      const { result } = renderHook(() => useAbortController());
      const [signal] = result.current;

      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });

    it('should provide abort function', () => {
      const { result } = renderHook(() => useAbortController());
      const [signal, abort] = result.current;

      expect(typeof abort).toBe('function');
      expect(signal.aborted).toBe(false);

      act(() => {
        abort();
      });

      expect(signal.aborted).toBe(true);
    });

    it('should abort on unmount', () => {
      const { result, unmount } = renderHook(() => useAbortController());
      const [signal] = result.current;

      expect(signal.aborted).toBe(false);

      unmount();

      expect(signal.aborted).toBe(true);
    });

    it('should create new signal on remount', () => {
      const { result, unmount, rerender } = renderHook(() => useAbortController());
      const [firstSignal] = result.current;

      unmount();

      const { result: result2 } = renderHook(() => useAbortController());
      const [secondSignal] = result2.current;

      expect(firstSignal).not.toBe(secondSignal);
      expect(firstSignal.aborted).toBe(true);
      expect(secondSignal.aborted).toBe(false);
    });
  });

  describe('useFetchWithAbort', () => {
    it('should fetch data successfully', async () => {
      const mockData = { id: 1, name: 'Test' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const { result } = renderHook(() =>
        useFetchWithAbort('/api/test', {}, [])
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(result.current.isAborted).toBe(false);
    });

    it('should handle fetch errors', async () => {
      const errorMessage = 'Network error';
      (global.fetch as any).mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() =>
        useFetchWithAbort('/api/test', {}, [])
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error?.message).toBe(errorMessage);
      expect(result.current.isAborted).toBe(false);
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() =>
        useFetchWithAbort('/api/test', {}, [])
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error?.message).toContain('404');
      expect(result.current.error?.message).toContain('Not Found');
    });

    it('should abort request on unmount', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      let rejectFetch: (error: Error) => void;
      const fetchPromise = new Promise((_, reject) => {
        rejectFetch = reject;
      });

      (global.fetch as any).mockReturnValueOnce(fetchPromise);

      const { result, unmount } = renderHook(() =>
        useFetchWithAbort('/api/test', {}, [])
      );

      expect(result.current.isLoading).toBe(true);

      unmount();

      // Simulate abort
      rejectFetch!(abortError);

      await waitFor(() => {
        expect(result.current.isAborted).toBe(true);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should not fetch if URL is null', () => {
      const { result } = renderHook(() =>
        useFetchWithAbort(null, {}, [])
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should refetch when dependencies change', async () => {
      const mockData1 = { id: 1 };
      const mockData2 = { id: 2 };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockData1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockData2,
        });

      let deps = [1];
      const { result, rerender } = renderHook(
        ({ deps }) => useFetchWithAbort('/api/test', {}, deps),
        { initialProps: { deps } }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData1);
      });

      deps = [2];
      rerender({ deps });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData2);
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('useAsyncCallback', () => {
    it('should execute async callback', async () => {
      const mockCallback = vi.fn(async (signal) => {
        return 'success';
      });

      const { result } = renderHook(() => useAsyncCallback(mockCallback, []));
      const [execute] = result.current;

      let returnValue: string | null = null;
      await act(async () => {
        returnValue = await execute();
      });

      expect(returnValue).toBe('success');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should provide AbortSignal to callback', async () => {
      let capturedSignal: AbortSignal | null = null;

      const mockCallback = vi.fn(async (signal) => {
        capturedSignal = signal;
        return 'success';
      });

      const { result } = renderHook(() => useAsyncCallback(mockCallback, []));
      const [execute] = result.current;

      await act(async () => {
        await execute();
      });

      expect(capturedSignal).toBeInstanceOf(AbortSignal);
      expect(capturedSignal?.aborted).toBe(false);
    });

    it('should abort previous request when called again', async () => {
      let firstSignal: AbortSignal | null = null;
      let secondSignal: AbortSignal | null = null;

      const mockCallback = vi.fn(async (signal) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'success';
      });

      const { result } = renderHook(() => useAsyncCallback(mockCallback, []));
      const [execute] = result.current;

      // Start first request
      act(() => {
        execute();
      });

      firstSignal = mockCallback.mock.calls[0][0];

      // Start second request before first completes
      await act(async () => {
        await execute();
      });

      secondSignal = mockCallback.mock.calls[1][0];

      expect(firstSignal?.aborted).toBe(true);
      expect(secondSignal?.aborted).toBe(false);
    });

    it('should provide manual abort function', async () => {
      const mockCallback = vi.fn(async (signal) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'success';
      });

      const { result } = renderHook(() => useAsyncCallback(mockCallback, []));
      const [execute, abort] = result.current;

      let capturedSignal: AbortSignal | null = null;

      act(() => {
        execute();
        capturedSignal = mockCallback.mock.calls[0][0];
      });

      act(() => {
        abort();
      });

      expect(capturedSignal?.aborted).toBe(true);
    });

    it('should abort on unmount', async () => {
      let capturedSignal: AbortSignal | null = null;

      const mockCallback = vi.fn(async (signal) => {
        capturedSignal = signal;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'success';
      });

      const { result, unmount } = renderHook(() =>
        useAsyncCallback(mockCallback, [])
      );
      const [execute] = result.current;

      act(() => {
        execute();
      });

      unmount();

      expect(capturedSignal?.aborted).toBe(true);
    });

    it('should return null when aborted', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      const mockCallback = vi.fn(async (signal) => {
        throw abortError;
      });

      const { result } = renderHook(() => useAsyncCallback(mockCallback, []));
      const [execute] = result.current;

      let returnValue: string | null = 'initial';
      await act(async () => {
        returnValue = await execute();
      });

      expect(returnValue).toBeNull();
    });

    it('should re-throw non-abort errors', async () => {
      const testError = new Error('Test error');

      const mockCallback = vi.fn(async (signal) => {
        throw testError;
      });

      const { result } = renderHook(() => useAsyncCallback(mockCallback, []));
      const [execute] = result.current;

      await expect(async () => {
        await act(async () => {
          await execute();
        });
      }).rejects.toThrow('Test error');
    });
  });

  describe('useAbortWithTimeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create signal with timeout', () => {
      const { result } = renderHook(() => useAbortWithTimeout(5000));
      const [signal] = result.current;

      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });

    it('should abort after timeout', () => {
      const { result } = renderHook(() => useAbortWithTimeout(5000));
      const [signal, , isTimedOut] = result.current;

      expect(signal.aborted).toBe(false);
      expect(isTimedOut).toBe(false);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(signal.aborted).toBe(true);
    });

    it('should allow manual abort before timeout', () => {
      const { result } = renderHook(() => useAbortWithTimeout(5000));
      const [signal, abort] = result.current;

      act(() => {
        abort();
      });

      expect(signal.aborted).toBe(true);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should still be aborted, not throw error
      expect(signal.aborted).toBe(true);
    });

    it('should cleanup timeout on unmount', () => {
      const { result, unmount } = renderHook(() => useAbortWithTimeout(5000));
      const [signal] = result.current;

      unmount();

      expect(signal.aborted).toBe(true);

      // Advancing timers shouldn't cause issues
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    });
  });

  describe('isAbortError', () => {
    it('should identify AbortError', () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      expect(isAbortError(abortError)).toBe(true);
    });

    it('should return false for other errors', () => {
      const normalError = new Error('Normal error');

      expect(isAbortError(normalError)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isAbortError('string')).toBe(false);
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError(undefined)).toBe(false);
      expect(isAbortError(123)).toBe(false);
    });
  });

  describe('fetchWithTimeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should fetch successfully within timeout', async () => {
      const mockResponse = { ok: true };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const responsePromise = fetchWithTimeout('/api/test', {}, 5000);

      await act(async () => {
        await responsePromise;
      });

      const response = await responsePromise;
      expect(response).toEqual(mockResponse);
    });

    it('should abort if timeout exceeds', async () => {
      const fetchPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true }), 10000);
      });

      (global.fetch as any).mockReturnValueOnce(fetchPromise);

      const responsePromise = fetchWithTimeout('/api/test', {}, 5000);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await expect(responsePromise).rejects.toThrow();
    });

    it('should use default timeout', async () => {
      const mockResponse = { ok: true };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const response = await fetchWithTimeout('/api/test');
      expect(response).toEqual(mockResponse);
    });
  });
});
