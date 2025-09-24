/**
 * Filter Type Definitions
 * Types for event filtering functionality
 */

import { EventType, EventSeverity, EventStatus } from './api.types';

// Main filter state
export interface FilterState {
  // Event filters
  eventType: EventType | null;
  severity: EventSeverity | null;
  status: EventStatus;
  
  // Location filters
  areas: string[];
  roads: string[];
  searchTerm: string;
  radius?: number; // In meters
  center?: { lat: number; lng: number };
  
  // Special filters
  showClosuresOnly: boolean;
  showActiveOnly: boolean;
  showWithDetours: boolean;
  showRecurringOnly: boolean;
  
  // Time filters
  dateRange: DateRange | null;
  inEffectNow: boolean;
  updatedWithin: TimeFilter | null;
}

// Date range interface
export interface DateRange {
  start: Date;
  end: Date;
}

// Time filter options
export interface TimeFilter {
  value: number;
  unit: 'minutes' | 'hours' | 'days';
}

// Filter preset
export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  filters: Partial<FilterState>;
  isDefault?: boolean;
  isCustom?: boolean;
}

// Filter statistics
export interface FilterStats {
  totalEvents: number;
  filteredEvents: number;
  closures: number;
  incidents: number;
  construction: number;
  byArea: Map<string, number>;
  byRoad: Map<string, number>;
  bySeverity: Map<EventSeverity, number>;
  byType: Map<EventType, number>;
}

// Filter change event
export interface FilterChangeEvent {
  previous: FilterState;
  current: FilterState;
  changed: (keyof FilterState)[];
  timestamp: Date;
  source: 'user' | 'preset' | 'reset' | 'auto';
}

// Filter validation result
export interface FilterValidationResult {
  isValid: boolean;
  errors: FilterValidationError[];
  warnings: string[];
}

// Filter validation error
export interface FilterValidationError {
  field: keyof FilterState;
  message: string;
  value?: any;
}

// Advanced filter options
export interface AdvancedFilterOptions {
  // Logic operators
  operator: 'AND' | 'OR';
  
  // Multiple selections
  eventTypes: EventType[];
  severities: EventSeverity[];
  
  // Complex conditions
  conditions: FilterCondition[];
  
  // Exclusions
  excludeEventTypes: EventType[];
  excludeSeverities: EventSeverity[];
  excludeAreas: string[];
  excludeRoads: string[];
}

// Filter condition
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
  caseSensitive?: boolean;
}

// Filter operators
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull';

// Saved filter
export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filters: FilterState;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  useCount: number;
  isShared?: boolean;
  tags?: string[];
}

// Filter history entry
export interface FilterHistoryEntry {
  id: string;
  filters: FilterState;
  timestamp: Date;
  results: number;
  action: 'applied' | 'cleared' | 'preset' | 'saved';
}

// Quick filter option
export interface QuickFilter {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  filters: Partial<FilterState>;
  badge?: string | number;
  isActive?: boolean;
}

// Default filter presets
export const DEFAULT_FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'all',
    name: 'All Events',
    description: 'Show all traffic events',
    icon: '📍',
    filters: {
      eventType: null,
      severity: null,
      showClosuresOnly: false,
      showActiveOnly: false,
    },
    isDefault: true,
  },
  {
    id: 'closures',
    name: 'Road Closures',
    description: 'Only show road closures',
    icon: '🚫',
    filters: {
      showClosuresOnly: true,
      showActiveOnly: true,
    },
  },
  {
    id: 'severe',
    name: 'High Impact',
    description: 'Severe and major events only',
    icon: '⚠️',
    filters: {
      severity: EventSeverity.SEVERE,
      showActiveOnly: true,
    },
  },
  {
    id: 'incidents',
    name: 'Incidents',
    description: 'Accidents and incidents only',
    icon: '🚨',
    filters: {
      eventType: EventType.INCIDENT,
      showActiveOnly: true,
    },
  },
  {
    id: 'construction',
    name: 'Construction',
    description: 'Construction and road work',
    icon: '🚧',
    filters: {
      eventType: EventType.CONSTRUCTION,
      showActiveOnly: true,
    },
  },
];

// Quick filter options
export const QUICK_FILTERS: QuickFilter[] = [
  {
    id: 'closures',
    label: 'Closures',
    icon: '🚫',
    color: '#DC2626',
    filters: {
      showClosuresOnly: true,
    },
  },
  {
    id: 'highImpact',
    label: 'High Impact',
    icon: '⚠️',
    color: '#EA580C',
    filters: {
      severity: EventSeverity.SEVERE,
    },
  },
  {
    id: 'incidents',
    label: 'Incidents',
    icon: '🚨',
    color: '#DC2626',
    filters: {
      eventType: EventType.INCIDENT,
    },
  },
  {
    id: 'construction',
    label: 'Construction',
    icon: '🚧',
    color: '#F59E0B',
    filters: {
      eventType: EventType.CONSTRUCTION,
    },
  },
  {
    id: 'recent',
    label: 'Recent',
    icon: '🕐',
    color: '#3B82F6',
    filters: {
      updatedWithin: {
        value: 30,
        unit: 'minutes',
      },
    },
  },
];

// Time filter presets
export const TIME_FILTER_PRESETS: TimeFilter[] = [
  { value: 15, unit: 'minutes' },
  { value: 30, unit: 'minutes' },
  { value: 1, unit: 'hours' },
  { value: 3, unit: 'hours' },
  { value: 6, unit: 'hours' },
  { value: 12, unit: 'hours' },
  { value: 24, unit: 'hours' },
  { value: 3, unit: 'days' },
  { value: 7, unit: 'days' },
];

// Helper functions
export function createDefaultFilterState(): FilterState {
  return {
    eventType: null,
    severity: null,
    status: EventStatus.ACTIVE,
    areas: [],
    roads: [],
    searchTerm: '',
    radius: undefined,
    center: undefined,
    showClosuresOnly: false,
    showActiveOnly: true,
    showWithDetours: false,
    showRecurringOnly: false,
    dateRange: null,
    inEffectNow: true,
    updatedWithin: null,
  };
}

export function isFilterEmpty(filters: FilterState): boolean {
  const defaultFilters = createDefaultFilterState();
  
  return (
    filters.eventType === defaultFilters.eventType &&
    filters.severity === defaultFilters.severity &&
    filters.areas.length === 0 &&
    filters.roads.length === 0 &&
    filters.searchTerm === '' &&
    !filters.showClosuresOnly &&
    !filters.dateRange &&
    !filters.updatedWithin
  );
}

export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  
  if (filters.eventType) count++;
  if (filters.severity) count++;
  if (filters.areas.length > 0) count++;
  if (filters.roads.length > 0) count++;
  if (filters.searchTerm) count++;
  if (filters.showClosuresOnly) count++;
  if (filters.dateRange) count++;
  if (filters.updatedWithin) count++;
  if (filters.radius && filters.center) count++;
  if (filters.showWithDetours) count++;
  if (filters.showRecurringOnly) count++;
  
  return count;
}

export function mergeFilters(
  base: FilterState,
  updates: Partial<FilterState>
): FilterState {
  return {
    ...base,
    ...updates,
    areas: updates.areas || base.areas,
    roads: updates.roads || base.roads,
    center: updates.center || base.center,
    dateRange: updates.dateRange || base.dateRange,
    updatedWithin: updates.updatedWithin || base.updatedWithin,
  };
}
