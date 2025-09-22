/**
 * Filter Type Definitions
 * Types for filtering and sorting traffic events
 */

import { EventType, EventSeverity } from './api.types';

export interface FilterState {
  // Event Type Filters
  eventType: EventType | '';
  
  // Severity Filters
  severity: EventSeverity | '';
  severityLevels?: EventSeverity[];
  
  // Status Filters
  closuresOnly: boolean;
  activeOnly: boolean;
  
  // Search
  searchTerm?: string;
  
  // Date Range
  dateRange?: {
    start: Date | null;
    end: Date | null;
  };
  
  // Location Filters
  areas?: string[];
  roads?: string[];
  radius?: number; // In meters
  centerPoint?: {
    lat: number;
    lng: number;
  };
  
  // Advanced Filters
  includeWzdx: boolean;
  includeScheduled?: boolean;
  hasDetour?: boolean;
  hasDescription?: boolean;
  
  // Sorting
  sortBy?: SortOption;
  sortOrder?: 'asc' | 'desc';
}

export type SortOption = 
  | 'severity'
  | 'recent'
  | 'type'
  | 'location'
  | 'duration'
  | 'impact';

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: Partial<FilterState>;
  icon?: string;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'closures',
    name: 'Road Closures',
    description: 'Show only full and partial road closures',
    filters: {
      closuresOnly: true,
      activeOnly: true,
    },
    icon: '🚫',
  },
  {
    id: 'severe',
    name: 'Severe Events',
    description: 'Show only severe and major events',
    filters: {
      severityLevels: [EventSeverity.SEVERE, EventSeverity.MAJOR],
      activeOnly: true,
    },
    icon: '⚠️',
  },
  {
    id: 'incidents',
    name: 'Accidents',
    description: 'Show only accidents and incidents',
    filters: {
      eventType: EventType.INCIDENT,
      activeOnly: true,
    },
    icon: '💥',
  },
  {
    id: 'construction',
    name: 'Construction',
    description: 'Show only construction and roadwork',
    filters: {
      eventType: EventType.CONSTRUCTION,
      activeOnly: true,
    },
    icon: '🚧',
  },
  {
    id: 'recent',
    name: 'Recent Events',
    description: 'Show events from the last hour',
    filters: {
      dateRange: {
        start: new Date(Date.now() - 3600000),
        end: null,
      },
      activeOnly: true,
      sortBy: 'recent',
    },
    icon: '🕐',
  },
];

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
}

export interface FilterStatistics {
  total: number;
  filtered: number;
  closures: number;
  incidents: number;
  construction: number;
  severe: number;
  recent: number;
}
