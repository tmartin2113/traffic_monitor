/**
 * @file stores/filterStore.ts
 * @description Filter Store with proper subscription handling
 * @version 2.0.0
 * 
 * FIXES BUG #9: Corrected middleware order to prevent stale closures
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { EventType, EventSeverity } from '@types/api.types';
import { FilterPreset, FILTER_PRESETS } from '@types/filter.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Basic filter state
 */
export interface FilterState {
  eventType: string;
  severity: string;
  closuresOnly: boolean;
  activeOnly: boolean;
  searchTerm: string;
  includeWzdx: boolean;
  sortBy: 'severity' | 'created' | 'updated' | 'distance';
  sortOrder: 'asc' | 'desc';
  dateRange?: {
    start: Date;
    end: Date;
  };
  radius?: number;
  location?: {
    lat: number;
    lng: number;
  };
}

/**
 * Advanced filter options
 */
interface AdvancedFilters {
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'all';
  dayOfWeek?: number[];
  impactLevel?: 'critical' | 'high' | 'moderate' | 'low' | 'all';
  dataSource?: string[];
  hasAlternateRoute?: boolean;
  verifiedOnly?: boolean;
  excludeScheduled?: boolean;
}

/**
 * Saved filter
 */
interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  advancedFilters?: AdvancedFilters;
  createdAt: Date;
}

/**
 * Filter store state
 */
interface FilterStoreState {
  filters: FilterState;
  advancedFilters: AdvancedFilters;
  advancedMode: boolean;
  savedFilters: SavedFilter[];
  customPresets: FilterPreset[];
  activePresetId: string | null;
  quickFilters: {
    closures: boolean;
    severe: boolean;
    recent: boolean;
    favorites: boolean;
  };
  searchHistory: string[];
  isFilterPanelOpen: boolean;
  hasUnsavedChanges: boolean;
  filterApplicationCount: number;
}

/**
 * Filter store actions
 */
interface FilterStoreActions {
  setFilters: (filters: Partial<FilterState>) => void;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  clearAllFilters: () => void;
  setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void;
  toggleAdvancedMode: () => void;
  resetAdvancedFilters: () => void;
  applyPreset: (presetId: string) => void;
  createCustomPreset: (name: string, description?: string) => void;
  deleteCustomPreset: (presetId: string) => void;
  saveFilter: (name: string) => void;
  loadSavedFilter: (filterId: string) => void;
  deleteSavedFilter: (filterId: string) => void;
  toggleQuickFilter: (filter: keyof FilterStoreState['quickFilters']) => void;
  addSearchHistory: (term: string) => void;
  clearSearchHistory: () => void;
  toggleFilterPanel: () => void;
  markUnsavedChanges: (hasChanges: boolean) => void;
  getActiveFilterCount: () => number;
  hasActiveFilters: () => boolean;
  getFilterSummary: () => string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const defaultFilterState: FilterState = {
  eventType: '',
  severity: '',
  closuresOnly: false,
  activeOnly: true,
  searchTerm: '',
  includeWzdx: false,
  sortBy: 'severity',
  sortOrder: 'desc',
};

const defaultAdvancedFilters: AdvancedFilters = {
  timeOfDay: 'all',
  dayOfWeek: [],
  impactLevel: 'all',
  dataSource: [],
  hasAlternateRoute: undefined,
  verifiedOnly: false,
  excludeScheduled: false,
};

const createInitialState = (): FilterStoreState => ({
  filters: { ...defaultFilterState },
  advancedFilters: { ...defaultAdvancedFilters },
  advancedMode: false,
  savedFilters: [],
  customPresets: [],
  activePresetId: null,
  quickFilters: {
    closures: false,
    severe: false,
    recent: false,
    favorites: false,
  },
  searchHistory: [],
  isFilterPanelOpen: true,
  hasUnsavedChanges: false,
  filterApplicationCount: 0,
});

// ============================================================================
// STORE CREATION WITH FIXED MIDDLEWARE ORDER
// ============================================================================

/**
 * CRITICAL FIX FOR BUG #9:
 * 
 * Middleware order matters! The correct order is:
 * 1. subscribeWithSelector (outermost) - enables selective subscriptions
 * 2. devtools - for Redux DevTools
 * 3. persist - for localStorage
 * 4. immer (innermost) - for immutable updates
 * 
 * This order prevents stale closures because:
 * - subscribeWithSelector wraps everything, so subscriptions get fresh state
 * - immer is innermost, so draft state doesn't leak to subscriptions
 */
export const useFilterStore = create<FilterStoreState & FilterStoreActions>()(
  subscribeWithSelector(  // MOVED TO OUTERMOST
    devtools(
      persist(
        immer((set, get) => ({
          ...createInitialState(),

          // ===== Basic Filter Operations =====

          setFilters: (filters) =>
            set((state) => {
              Object.assign(state.filters, filters);
              state.hasUnsavedChanges = true;
              state.activePresetId = null;
            }),

          updateFilter: (key, value) =>
            set((state) => {
              state.filters[key] = value;
              state.hasUnsavedChanges = true;
              state.activePresetId = null;
            }),

          resetFilters: () =>
            set((state) => {
              state.filters = { ...defaultFilterState };
              state.hasUnsavedChanges = false;
              state.activePresetId = null;
            }),

          clearAllFilters: () =>
            set((state) => {
              state.filters = { ...defaultFilterState };
              state.advancedFilters = { ...defaultAdvancedFilters };
              state.quickFilters = {
                closures: false,
                severe: false,
                recent: false,
                favorites: false,
              };
              state.hasUnsavedChanges = false;
              state.activePresetId = null;
            }),

          // ===== Advanced Filters =====

          setAdvancedFilters: (filters) =>
            set((state) => {
              Object.assign(state.advancedFilters, filters);
              state.hasUnsavedChanges = true;
            }),

          toggleAdvancedMode: () =>
            set((state) => {
              state.advancedMode = !state.advancedMode;
            }),

          resetAdvancedFilters: () =>
            set((state) => {
              state.advancedFilters = { ...defaultAdvancedFilters };
              state.hasUnsavedChanges = true;
            }),

          // ===== Presets =====

          applyPreset: (presetId) =>
            set((state) => {
              const preset =
                [...FILTER_PRESETS, ...state.customPresets].find(
                  (p) => p.id === presetId
                );

              if (preset) {
                state.filters = { ...preset.filters } as FilterState;
                state.activePresetId = presetId;
                state.hasUnsavedChanges = false;
              }
            }),

          createCustomPreset: (name, description) =>
            set((state) => {
              // Use get() safely within the setter
              const currentState = get();
              const newPreset: FilterPreset = {
                id: `custom-${Date.now()}`,
                name,
                description: description || '',
                filters: { ...currentState.filters } as any,
                icon: '⭐',
              };
              state.customPresets.push(newPreset);
            }),

          deleteCustomPreset: (presetId) =>
            set((state) => {
              state.customPresets = state.customPresets.filter(
                (p) => p.id !== presetId
              );
              if (state.activePresetId === presetId) {
                state.activePresetId = null;
              }
            }),

          // ===== Saved Filters =====

          saveFilter: (name) =>
            set((state) => {
              // Use get() safely
              const currentState = get();
              const newFilter: SavedFilter = {
                id: `filter-${Date.now()}`,
                name,
                filters: { ...currentState.filters },
                advancedFilters: { ...currentState.advancedFilters },
                createdAt: new Date(),
              };
              state.savedFilters.push(newFilter);
              state.hasUnsavedChanges = false;
            }),

          loadSavedFilter: (filterId) =>
            set((state) => {
              const filter = state.savedFilters.find((f) => f.id === filterId);
              if (filter) {
                state.filters = { ...filter.filters };
                if (filter.advancedFilters) {
                  state.advancedFilters = { ...filter.advancedFilters };
                }
                state.hasUnsavedChanges = false;
              }
            }),

          deleteSavedFilter: (filterId) =>
            set((state) => {
              state.savedFilters = state.savedFilters.filter(
                (f) => f.id !== filterId
              );
            }),

          // ===== Quick Filters =====

          toggleQuickFilter: (filter) =>
            set((state) => {
              state.quickFilters[filter] = !state.quickFilters[filter];

              // Apply quick filter logic
              if (filter === 'closures') {
                state.filters.closuresOnly = state.quickFilters.closures;
              } else if (filter === 'severe') {
                state.filters.severity = state.quickFilters.severe ? 'MAJOR' : '';
              }

              state.hasUnsavedChanges = true;
            }),

          // ===== Search History =====

          addSearchHistory: (term) =>
            set((state) => {
              const trimmed = term.trim();
              if (trimmed) {
                state.searchHistory = [
                  trimmed,
                  ...state.searchHistory.filter((t) => t !== trimmed),
                ].slice(0, 10);
              }
            }),

          clearSearchHistory: () =>
            set((state) => {
              state.searchHistory = [];
            }),

          // ===== UI State =====

          toggleFilterPanel: () =>
            set((state) => {
              state.isFilterPanelOpen = !state.isFilterPanelOpen;
            }),

          markUnsavedChanges: (hasChanges) =>
            set((state) => {
              state.hasUnsavedChanges = hasChanges;
            }),

          // ===== Utility Functions =====
          // IMPORTANT: These use get() but are called synchronously by components,
          // not as subscription callbacks, so they're safe

          getActiveFilterCount: () => {
            const state = get();
            let count = 0;

            if (state.filters.eventType) count++;
            if (state.filters.severity) count++;
            if (state.filters.closuresOnly) count++;
            if (state.filters.searchTerm) count++;
            if (state.filters.dateRange) count++;
            if (state.filters.radius) count++;

            return count;
          },

          hasActiveFilters: () => {
            return get().getActiveFilterCount() > 0;
          },

          getFilterSummary: () => {
            const state = get();
            const parts: string[] = [];

            if (state.filters.eventType) {
              parts.push(`Type: ${state.filters.eventType}`);
            }
            if (state.filters.severity) {
              parts.push(`Severity: ${state.filters.severity}`);
            }
            if (state.filters.closuresOnly) {
              parts.push('Closures only');
            }
            if (state.filters.searchTerm) {
              parts.push(`"${state.filters.searchTerm}"`);
            }

            return parts.length > 0 ? parts.join(', ') : 'No filters applied';
          },
        })),
        {
          name: 'filter-store',
          partialize: (state) => ({
            filters: state.filters,
            advancedFilters: state.advancedFilters,
            savedFilters: state.savedFilters,
            customPresets: state.customPresets,
            searchHistory: state.searchHistory,
            quickFilters: state.quickFilters,
            isFilterPanelOpen: state.isFilterPanelOpen,
          }),
        }
      ),
      {
        name: 'FilterStore',
      }
    )
  )
);

// ============================================================================
// OPTIMIZED SELECTORS (PREVENT UNNECESSARY RE-RENDERS)
// ============================================================================

/**
 * CRITICAL: Use these selectors in components instead of direct access
 * to prevent stale closures and unnecessary re-renders
 */

export const useFilters = () => useFilterStore((state) => state.filters);
export const useAdvancedFilters = () => useFilterStore((state) => state.advancedFilters);
export const useQuickFilters = () => useFilterStore((state) => state.quickFilters);
export const useSavedFilters = () => useFilterStore((state) => state.savedFilters);
export const useActiveFilterCount = () => useFilterStore((state) => state.getActiveFilterCount());
export const useFilterSummary = () => useFilterStore((state) => state.getFilterSummary());
export const useHasActiveFilters = () => useFilterStore((state) => state.hasActiveFilters());

/**
 * Combined preset selector
 */
export const useFilterPresets = () =>
  useFilterStore((state) => [...FILTER_PRESETS, ...state.customPresets]);

/**
 * Specific filter selectors for fine-grained subscriptions
 */
export const useEventTypeFilter = () =>
  useFilterStore((state) => state.filters.eventType);

export const useSeverityFilter = () =>
  useFilterStore((state) => state.filters.severity);

export const useSearchTerm = () =>
  useFilterStore((state) => state.filters.searchTerm);

export const useClosuresOnlyFilter = () =>
  useFilterStore((state) => state.filters.closuresOnly);

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useFilterStore;
