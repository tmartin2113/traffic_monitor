/**
 * Filter Store - Zustand State Management
 * Manages filter state and presets for traffic events
 * 
 * @module src/stores/filterStore
 * @version 1.0.0
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { EventType, EventSeverity, EventStatus } from '@/types/api.types';
import { FilterState, FilterPreset, SavedFilter, SortOption, FILTER_PRESETS } from '@/types/filter.types';
import { MapCenter } from '@/types/map.types';

/**
 * Advanced filter options
 */
interface AdvancedFilters {
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | 'all';
  dayOfWeek?: number[]; // 0-6, Sunday to Saturday
  impactLevel?: 'critical' | 'high' | 'moderate' | 'low' | 'all';
  dataSource?: string[];
  hasAlternateRoute?: boolean;
  hasPhotos?: boolean;
  verifiedOnly?: boolean;
  excludeScheduled?: boolean;
}

/**
 * Filter history entry
 */
interface FilterHistoryEntry {
  id: string;
  timestamp: Date;
  filters: FilterState;
  resultCount: number;
  label?: string;
}

/**
 * Filter validation result
 */
interface FilterValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Filter store state interface
 */
interface FilterStoreState {
  // Current filters
  filters: FilterState;
  
  // Advanced filters
  advancedFilters: AdvancedFilters;
  advancedMode: boolean;
  
  // Saved filters and presets
  savedFilters: SavedFilter[];
  customPresets: FilterPreset[];
  activePresetId: string | null;
  
  // Filter history
  filterHistory: FilterHistoryEntry[];
  maxHistorySize: number;
  
  // Quick filters (toggleable badges)
  quickFilters: {
    closures: boolean;
    severe: boolean;
    recent: boolean;
    favorites: boolean;
  };
  
  // Search
  searchHistory: string[];
  searchSuggestions: string[];
  
  // UI State
  isFilterPanelOpen: boolean;
  isAdvancedPanelOpen: boolean;
  hasUnsavedChanges: boolean;
  
  // Statistics
  lastAppliedTime: Date | null;
  filterApplicationCount: number;
}

/**
 * Filter store actions interface
 */
interface FilterStoreActions {
  // Basic filter operations
  setFilters: (filters: Partial<FilterState>) => void;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  clearAllFilters: () => void;
  
  // Advanced filter operations
  setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void;
  toggleAdvancedMode: () => void;
  resetAdvancedFilters: () => void;
  
  // Preset management
  applyPreset: (presetId: string) => void;
  createCustomPreset: (name: string, description?: string) => void;
  updateCustomPreset: (presetId: string, updates: Partial<FilterPreset>) => void;
  deleteCustomPreset: (presetId: string) => void;
  
  // Saved filter management
  saveCurrentFilters: (name: string) => void;
  loadSavedFilter: (filterId: string) => void;
  updateSavedFilter: (filterId: string, updates: Partial<SavedFilter>) => void;
  deleteSavedFilter: (filterId: string) => void;
  setDefaultFilter: (filterId: string | null) => void;
  
  // Quick filter toggles
  toggleQuickFilter: (filter: keyof FilterStoreState['quickFilters']) => void;
  applyQuickFilters: () => void;
  
  // Search operations
  setSearchTerm: (term: string) => void;
  addSearchToHistory: (term: string) => void;
  clearSearchHistory: () => void;
  generateSearchSuggestions: (events: any[]) => void;
  
  // History management
  addToHistory: (resultCount: number, label?: string) => void;
  clearHistory: () => void;
  applyHistoryEntry: (entryId: string) => void;
  
  // Validation
  validateFilters: () => FilterValidation;
  hasActiveFilters: () => boolean;
  getActiveFilterCount: () => number;
  
  // Import/Export
  exportFilters: () => string;
  importFilters: (json: string) => boolean;
  
  // UI State
  toggleFilterPanel: () => void;
  toggleAdvancedPanel: () => void;
  markUnsavedChanges: (hasChanges: boolean) => void;
  
  // Utility
  getFilterSummary: () => string;
  compareFilters: (filters1: FilterState, filters2: FilterState) => boolean;
  mergeFilters: (base: FilterState, override: Partial<FilterState>) => FilterState;
}

/**
 * Default filter state
 */
const defaultFilterState: FilterState = {
  eventType: '',
  severity: '',
  closuresOnly: false,
  activeOnly: true,
  searchTerm: '',
  includeWzdx: false,
  sortBy: 'severity',
  sortOrder: 'desc'
};

/**
 * Default advanced filters
 */
const defaultAdvancedFilters: AdvancedFilters = {
  timeOfDay: 'all',
  dayOfWeek: [],
  impactLevel: 'all',
  dataSource: [],
  hasAlternateRoute: undefined,
  hasPhotos: undefined,
  verifiedOnly: false,
  excludeScheduled: false
};

/**
 * Initial state factory
 */
const createInitialState = (): FilterStoreState => ({
  filters: { ...defaultFilterState },
  advancedFilters: { ...defaultAdvancedFilters },
  advancedMode: false,
  savedFilters: [],
  customPresets: [],
  activePresetId: null,
  filterHistory: [],
  maxHistorySize: 20,
  quickFilters: {
    closures: false,
    severe: false,
    recent: false,
    favorites: false
  },
  searchHistory: [],
  searchSuggestions: [],
  isFilterPanelOpen: true,
  isAdvancedPanelOpen: false,
  hasUnsavedChanges: false,
  lastAppliedTime: null,
  filterApplicationCount: 0
});

/**
 * Generate filter summary text
 */
const generateFilterSummary = (filters: FilterState, advanced: AdvancedFilters): string => {
  const parts: string[] = [];
  
  if (filters.eventType) {
    parts.push(`Type: ${filters.eventType}`);
  }
  if (filters.severity) {
    parts.push(`Severity: ${filters.severity}`);
  }
  if (filters.closuresOnly) {
    parts.push('Closures only');
  }
  if (filters.searchTerm) {
    parts.push(`Search: "${filters.searchTerm}"`);
  }
  if (advanced.timeOfDay && advanced.timeOfDay !== 'all') {
    parts.push(`Time: ${advanced.timeOfDay}`);
  }
  if (advanced.impactLevel && advanced.impactLevel !== 'all') {
    parts.push(`Impact: ${advanced.impactLevel}`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No filters applied';
};

/**
 * Validate filter configuration
 */
const validateFilterConfiguration = (
  filters: FilterState,
  advanced: AdvancedFilters
): FilterValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate date range if present
  if (filters.dateRange) {
    if (filters.dateRange.start && filters.dateRange.end) {
      if (filters.dateRange.start > filters.dateRange.end) {
        errors.push('Start date must be before end date');
      }
      const daysDiff = Math.abs(
        (filters.dateRange.end.getTime() - filters.dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff > 30) {
        warnings.push('Date range spans more than 30 days, which may affect performance');
      }
    }
  }
  
  // Validate radius if location-based filtering
  if (filters.radius && filters.radius > 50000) {
    warnings.push('Large search radius may return many results and affect performance');
  }
  
  // Validate conflicting filters
  if (filters.closuresOnly && filters.eventType && filters.eventType !== EventType.INCIDENT) {
    warnings.push('Closures filter may conflict with selected event type');
  }
  
  // Validate advanced filters
  if (advanced.dayOfWeek && advanced.dayOfWeek.length === 0) {
    warnings.push('No days selected in day of week filter');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Create the filter store with Zustand
 */
export const useFilterStore = create<FilterStoreState & FilterStoreActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...createInitialState(),

          // Basic filter operations
          setFilters: (filters) => set(state => {
            Object.assign(state.filters, filters);
            state.hasUnsavedChanges = true;
            state.activePresetId = null;
          }),

          updateFilter: (key, value) => set(state => {
            (state.filters as any)[key] = value;
            state.hasUnsavedChanges = true;
            state.activePresetId = null;
          }),

          resetFilters: () => set(state => {
            state.filters = { ...defaultFilterState };
            state.advancedFilters = { ...defaultAdvancedFilters };
            state.quickFilters = {
              closures: false,
              severe: false,
              recent: false,
              favorites: false
            };
            state.activePresetId = null;
            state.hasUnsavedChanges = false;
          }),

          clearAllFilters: () => set(state => {
            state.filters = { ...defaultFilterState };
            state.advancedFilters = { ...defaultAdvancedFilters };
            state.activePresetId = null;
            state.hasUnsavedChanges = false;
          }),

          // Advanced filter operations
          setAdvancedFilters: (filters) => set(state => {
            Object.assign(state.advancedFilters, filters);
            state.hasUnsavedChanges = true;
          }),

          toggleAdvancedMode: () => set(state => {
            state.advancedMode = !state.advancedMode;
            state.isAdvancedPanelOpen = state.advancedMode;
          }),

          resetAdvancedFilters: () => set(state => {
            state.advancedFilters = { ...defaultAdvancedFilters };
            state.hasUnsavedChanges = true;
          }),

          // Preset management
          applyPreset: (presetId) => set(state => {
            const preset = [...FILTER_PRESETS, ...state.customPresets]
              .find(p => p.id === presetId);
            
            if (preset) {
              state.filters = { ...defaultFilterState, ...preset.filters };
              state.activePresetId = presetId;
              state.hasUnsavedChanges = false;
              state.lastAppliedTime = new Date();
              state.filterApplicationCount++;
            }
          }),

          createCustomPreset: (name, description) => set(state => {
            const newPreset: FilterPreset = {
              id: `custom-${Date.now()}`,
              name,
              description,
              filters: { ...state.filters }
            };
            state.customPresets.push(newPreset);
          }),

          updateCustomPreset: (presetId, updates) => set(state => {
            const index = state.customPresets.findIndex(p => p.id === presetId);
            if (index !== -1) {
              Object.assign(state.customPresets[index], updates);
            }
          }),

          deleteCustomPreset: (presetId) => set(state => {
            state.customPresets = state.customPresets.filter(p => p.id !== presetId);
            if (state.activePresetId === presetId) {
              state.activePresetId = null;
            }
          }),

          // Saved filter management
          saveCurrentFilters: (name) => set(state => {
            const savedFilter: SavedFilter = {
              id: `saved-${Date.now()}`,
              name,
              filters: { ...state.filters },
              createdAt: new Date(),
              updatedAt: new Date()
            };
            state.savedFilters.push(savedFilter);
            state.hasUnsavedChanges = false;
          }),

          loadSavedFilter: (filterId) => set(state => {
            const saved = state.savedFilters.find(f => f.id === filterId);
            if (saved) {
              state.filters = { ...saved.filters };
              state.hasUnsavedChanges = false;
              state.lastAppliedTime = new Date();
              state.filterApplicationCount++;
            }
          }),

          updateSavedFilter: (filterId, updates) => set(state => {
            const index = state.savedFilters.findIndex(f => f.id === filterId);
            if (index !== -1) {
              Object.assign(state.savedFilters[index], updates);
              state.savedFilters[index].updatedAt = new Date();
            }
          }),

          deleteSavedFilter: (filterId) => set(state => {
            state.savedFilters = state.savedFilters.filter(f => f.id !== filterId);
          }),

          setDefaultFilter: (filterId) => set(state => {
            state.savedFilters.forEach(filter => {
              filter.isDefault = filter.id === filterId;
            });
          }),

          // Quick filter toggles
          toggleQuickFilter: (filter) => set(state => {
            state.quickFilters[filter] = !state.quickFilters[filter];
            state.hasUnsavedChanges = true;
          }),

          applyQuickFilters: () => set(state => {
            const filters: Partial<FilterState> = {};
            
            if (state.quickFilters.closures) {
              filters.closuresOnly = true;
            }
            if (state.quickFilters.severe) {
              filters.severityLevels = [EventSeverity.SEVERE, EventSeverity.MAJOR];
            }
            if (state.quickFilters.recent) {
              filters.dateRange = {
                start: new Date(Date.now() - 3600000),
                end: null
              };
            }
            
            Object.assign(state.filters, filters);
            state.hasUnsavedChanges = true;
            state.lastAppliedTime = new Date();
            state.filterApplicationCount++;
          }),

          // Search operations
          setSearchTerm: (term) => set(state => {
            state.filters.searchTerm = term;
            state.hasUnsavedChanges = true;
          }),

          addSearchToHistory: (term) => set(state => {
            if (term && !state.searchHistory.includes(term)) {
              state.searchHistory = [term, ...state.searchHistory].slice(0, 10);
            }
          }),

          clearSearchHistory: () => set(state => {
            state.searchHistory = [];
          }),

          generateSearchSuggestions: (events) => set(state => {
            const suggestions = new Set<string>();
            
            events.forEach(event => {
              // Add road names
              event.roads?.forEach(road => {
                if (road.name) suggestions.add(road.name);
              });
              // Add area names
              event.areas?.forEach(area => {
                if (area.name) suggestions.add(area.name);
              });
              // Add common terms from headlines
              const words = event.headline?.split(/\s+/) || [];
              words.forEach(word => {
                if (word.length > 4 && !['from', 'with', 'that', 'this'].includes(word.toLowerCase())) {
                  suggestions.add(word);
                }
              });
            });
            
            state.searchSuggestions = Array.from(suggestions).slice(0, 20);
          }),

          // History management
          addToHistory: (resultCount, label) => set(state => {
            const entry: FilterHistoryEntry = {
              id: `history-${Date.now()}`,
              timestamp: new Date(),
              filters: { ...state.filters },
              resultCount,
              label
            };
            
            state.filterHistory = [entry, ...state.filterHistory]
              .slice(0, state.maxHistorySize);
          }),

          clearHistory: () => set(state => {
            state.filterHistory = [];
          }),

          applyHistoryEntry: (entryId) => set(state => {
            const entry = state.filterHistory.find(h => h.id === entryId);
            if (entry) {
              state.filters = { ...entry.filters };
              state.hasUnsavedChanges = false;
              state.lastAppliedTime = new Date();
              state.filterApplicationCount++;
            }
          }),

          // Validation
          validateFilters: () => {
            const state = get();
            return validateFilterConfiguration(state.filters, state.advancedFilters);
          },

          hasActiveFilters: () => {
            const { filters, advancedFilters } = get();
            
            // Check basic filters
            const hasBasic = (
              filters.eventType !== '' ||
              filters.severity !== '' ||
              filters.closuresOnly ||
              filters.searchTerm !== '' ||
              filters.dateRange !== undefined ||
              filters.areas?.length ||
              filters.roads?.length
            );
            
            // Check advanced filters
            const hasAdvanced = (
              advancedFilters.timeOfDay !== 'all' ||
              advancedFilters.dayOfWeek?.length ||
              advancedFilters.impactLevel !== 'all' ||
              advancedFilters.dataSource?.length ||
              advancedFilters.hasAlternateRoute !== undefined ||
              advancedFilters.hasPhotos !== undefined ||
              advancedFilters.verifiedOnly ||
              advancedFilters.excludeScheduled
            );
            
            return hasBasic || hasAdvanced;
          },

          getActiveFilterCount: () => {
            const { filters, advancedFilters } = get();
            let count = 0;
            
            if (filters.eventType) count++;
            if (filters.severity) count++;
            if (filters.closuresOnly) count++;
            if (filters.searchTerm) count++;
            if (filters.dateRange) count++;
            if (filters.areas?.length) count++;
            if (filters.roads?.length) count++;
            
            if (advancedFilters.timeOfDay !== 'all') count++;
            if (advancedFilters.dayOfWeek?.length) count++;
            if (advancedFilters.impactLevel !== 'all') count++;
            if (advancedFilters.verifiedOnly) count++;
            
            return count;
          },

          // Import/Export
          exportFilters: () => {
            const state = get();
            const exportData = {
              version: '1.0.0',
              timestamp: new Date().toISOString(),
              currentFilters: state.filters,
              advancedFilters: state.advancedFilters,
              savedFilters: state.savedFilters,
              customPresets: state.customPresets
            };
            return JSON.stringify(exportData, null, 2);
          },

          importFilters: (json) => {
            try {
              const data = JSON.parse(json);
              set(state => {
                if (data.currentFilters) state.filters = data.currentFilters;
                if (data.advancedFilters) state.advancedFilters = data.advancedFilters;
                if (data.savedFilters) state.savedFilters = data.savedFilters;
                if (data.customPresets) state.customPresets = data.customPresets;
              });
              return true;
            } catch (error) {
              console.error('Failed to import filters:', error);
              return false;
            }
          },

          // UI State
          toggleFilterPanel: () => set(state => {
            state.isFilterPanelOpen = !state.isFilterPanelOpen;
          }),

          toggleAdvancedPanel: () => set(state => {
            state.isAdvancedPanelOpen = !state.isAdvancedPanelOpen;
          }),

          markUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

          // Utility
          getFilterSummary: () => {
            const state = get();
            return generateFilterSummary(state.filters, state.advancedFilters);
          },

          compareFilters: (filters1, filters2) => {
            return JSON.stringify(filters1) === JSON.stringify(filters2);
          },

          mergeFilters: (base, override) => {
            return { ...base, ...override };
          }
        }))
      ),
      {
        name: 'filter-store',
        partialize: (state) => ({
          filters: state.filters,
          advancedFilters: state.advancedFilters,
          savedFilters: state.savedFilters,
          customPresets: state.customPresets,
          searchHistory: state.searchHistory,
          quickFilters: state.quickFilters,
          isFilterPanelOpen: state.isFilterPanelOpen
        })
      }
    ),
    {
      name: 'FilterStore'
    }
  )
);

// Selector hooks for optimized re-renders
export const useFilters = () => useFilterStore(state => state.filters);
export const useAdvancedFilters = () => useFilterStore(state => state.advancedFilters);
export const useQuickFilters = () => useFilterStore(state => state.quickFilters);
export const useSavedFilters = () => useFilterStore(state => state.savedFilters);
export const useFilterPresets = () => useFilterStore(state => [...FILTER_PRESETS, ...state.customPresets]);
export const useActiveFilterCount = () => useFilterStore(state => state.getActiveFilterCount());
export const useFilterSummary = () => useFilterStore(state => state.getFilterSummary());
export const useHasActiveFilters = () => useFilterStore(state => state.hasActiveFilters());
