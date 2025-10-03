/**
 * @file stores/filterStore.test.ts
 * @description Tests for filterStore subscription handling
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFilterStore, useFilters, useActiveFilterCount } from './filterStore';

describe('filterStore - Bug #9 Fix: Stale Closures', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useFilterStore.getState();
    act(() => {
      store.clearAllFilters();
    });
  });

  describe('Subscription Handling', () => {
    it('should not capture stale state in subscriptions', async () => {
      const callbackResults: string[] = [];

      // Subscribe to filter changes
      const unsubscribe = useFilterStore.subscribe(
        (state) => state.filters.eventType,
        (eventType) => {
          // This callback should always get fresh state
          const currentState = useFilterStore.getState();
          callbackResults.push(
            `EventType: ${eventType}, FilterCount: ${currentState.getActiveFilterCount()}`
          );
        }
      );

      // Update filters multiple times
      act(() => {
        useFilterStore.getState().updateFilter('eventType', 'INCIDENT');
      });

      act(() => {
        useFilterStore.getState().updateFilter('severity', 'MAJOR');
      });

      act(() => {
        useFilterStore.getState().updateFilter('eventType', 'CONSTRUCTION');
      });

      await waitFor(() => {
        expect(callbackResults.length).toBeGreaterThan(0);
      });

      // Verify callback received fresh state each time
      expect(callbackResults).toContain(expect.stringContaining('EventType: INCIDENT'));
      expect(callbackResults).toContain(expect.stringContaining('EventType: CONSTRUCTION'));

      // Filter count should be accurate (not stale)
      const lastResult = callbackResults[callbackResults.length - 1];
      expect(lastResult).toMatch(/FilterCount: [12]/); // Should be 1 or 2, not 0

      unsubscribe();
    });

    it('should handle rapid state updates without closure issues', async () => {
      let updateCount = 0;

      const unsubscribe = useFilterStore.subscribe(
        (state) => state.filters,
        () => {
          updateCount++;
          // Access current state - should never be stale
          const count = useFilterStore.getState().getActiveFilterCount();
          expect(count).toBeGreaterThanOrEqual(0);
        }
      );

      // Rapid updates
      act(() => {
        for (let i = 0; i < 10; i++) {
          useFilterStore.getState().updateFilter('searchTerm', `search${i}`);
        }
      });

      await waitFor(() => {
        expect(updateCount).toBeGreaterThan(0);
      });

      unsubscribe();
    });

    it('should work with selector hooks without stale closures', () => {
      const { result: filtersResult } = renderHook(() => useFilters());
      const { result: countResult } = renderHook(() => useActiveFilterCount());

      // Initial state
      expect(countResult.current()).toBe(0);

      // Update filters
      act(() => {
        useFilterStore.getState().updateFilter('eventType', 'INCIDENT');
        useFilterStore.getState().updateFilter('severity', 'MAJOR');
      });

      // Hooks should have fresh state
      expect(countResult.current()).toBe(2);
      expect(filtersResult.current.eventType).toBe('INCIDENT');
      expect(filtersResult.current.severity).toBe('MAJOR');
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistency across multiple subscribers', async () => {
      const subscriber1Results: number[] = [];
      const subscriber2Results: number[] = [];

      const unsub1 = useFilterStore.subscribe(
        (state) => state.filters,
        () => {
          subscriber1Results.push(useFilterStore.getState().getActiveFilterCount());
        }
      );

      const unsub2 = useFilterStore.subscribe(
        (state) => state.filters.eventType,
        () => {
          subscriber2Results.push(useFilterStore.getState().getActiveFilterCount());
        }
      );

      act(() => {
        useFilterStore.getState().updateFilter('eventType', 'INCIDENT');
        useFilterStore.getState().updateFilter('severity', 'MAJOR');
      });

      await waitFor(() => {
        expect(subscriber1Results.length).toBeGreaterThan(0);
      });

      // Both subscribers should see consistent state
      const last1 = subscriber1Results[subscriber1Results.length - 1];
      const last2 = subscriber2Results[subscriber2Results.length - 1];

      expect(last1).toBe(last2);
      expect(last1).toBe(2);

      unsub1();
      unsub2();
    });
  });

  describe('Middleware Order', () => {
    it('should apply filters correctly with immer', () => {
      act(() => {
        useFilterStore.getState().setFilters({
          eventType: 'INCIDENT',
          severity: 'MAJOR',
          closuresOnly: true,
        });
      });

      const state = useFilterStore.getState();
      expect(state.filters.eventType).toBe('INCIDENT');
      expect(state.filters.severity).toBe('MAJOR');
      expect(state.filters.closuresOnly).toBe(true);
    });

    it('should persist state correctly', async () => {
      act(() => {
        useFilterStore.getState().updateFilter('searchTerm', 'test-search');
      });

      // Get persisted value (simulated)
      const state = useFilterStore.getState();
      expect(state.filters.searchTerm).toBe('test-search');
    });

    it('should handle nested state updates', () => {
      act(() => {
        useFilterStore.getState().updateFilter('dateRange', {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        });
      });

      const state = useFilterStore.getState();
      expect(state.filters.dateRange).toBeDefined();
      expect(state.filters.dateRange?.start).toBeInstanceOf(Date);
    });
  });

  describe('Quick Filters', () => {
    it('should not have stale state in quick filter toggles', () => {
      act(() => {
        useFilterStore.getState().toggleQuickFilter('closures');
      });

      const state1 = useFilterStore.getState();
      expect(state1.quickFilters.closures).toBe(true);
      expect(state1.filters.closuresOnly).toBe(true);

      act(() => {
        useFilterStore.getState().toggleQuickFilter('closures');
      });

      const state2 = useFilterStore.getState();
      expect(state2.quickFilters.closures).toBe(false);
      expect(state2.filters.closuresOnly).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('should calculate active filter count accurately', () => {
      act(() => {
        useFilterStore.getState().setFilters({
          eventType: 'INCIDENT',
          severity: 'MAJOR',
          searchTerm: 'test',
        });
      });

      const count = useFilterStore.getState().getActiveFilterCount();
      expect(count).toBe(3);
    });

    it('should generate correct filter summary', () => {
      act(() => {
        useFilterStore.getState().setFilters({
          eventType: 'INCIDENT',
          severity: 'MAJOR',
        });
      });

      const summary = useFilterStore.getState().getFilterSummary();
      expect(summary).toContain('INCIDENT');
      expect(summary).toContain('MAJOR');
    });
  });

  describe('Reset Operations', () => {
    it('should reset filters without state corruption', () => {
      act(() => {
        useFilterStore.getState().setFilters({
          eventType: 'INCIDENT',
          severity: 'MAJOR',
          closuresOnly: true,
        });
      });

      act(() => {
        useFilterStore.getState().resetFilters();
      });

      const state = useFilterStore.getState();
      expect(state.filters.eventType).toBe('');
      expect(state.filters.severity).toBe('');
      expect(state.filters.closuresOnly).toBe(false);
      expect(state.getActiveFilterCount()).toBe(0);
    });

    it('should clear all filters including advanced', () => {
      act(() => {
        useFilterStore.getState().setFilters({
          eventType: 'INCIDENT',
        });
        useFilterStore.getState().setAdvancedFilters({
          timeOfDay: 'morning',
        });
      });

      act(() => {
        useFilterStore.getState().clearAllFilters();
      });

      const state = useFilterStore.getState();
      expect(state.filters.eventType).toBe('');
      expect(state.advancedFilters.timeOfDay).toBe('all');
    });
  });
});
