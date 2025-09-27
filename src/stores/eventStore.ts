/**
 * Event Store with Differential Sync Support
 * Production-ready Zustand store for traffic event state management
 * 
 * @module stores/eventStore
 * @version 2.0.0
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { shallow } from 'zustand/shallow';
import {
  TrafficEvent,
  EventType,
  EventSeverity,
  RoadState
} from '@types/api.types';
import { DifferentialResponse } from '@services/api/trafficApi';
import { EventDiff, ConflictInfo, SyncResult } from '@services/sync/DifferentialSync';

// ============================================================================
// Type Definitions
// ============================================================================

export interface EventStoreState {
  // ===== Core Event Data =====
  events: Map<string, TrafficEvent>;
  eventOrder: string[]; // Maintain insertion order
  
  // ===== Version & Sync State =====
  eventVersions: Map<string, EventVersion>;
  lastSyncTimestamp: string | null;
  syncId: string;
  syncStatus: SyncStatus;
  syncProgress: number;
  
  // ===== Pending Changes & Conflicts =====
  pendingChanges: Map<string, EventDiff>;
  conflicts: Map<string, ConflictInfo>;
  optimisticUpdates: Map<string, OptimisticUpdate>;
  
  // ===== Selection & UI State =====
  selectedEventId: string | null;
  highlightedEventIds: Set<string>;
  favoriteEventIds: Set<string>;
  hiddenEventIds: Set<string>;
  expandedEventIds: Set<string>;
  
  // ===== Filtering & View State =====
  viewMode: 'list' | 'map' | 'timeline' | 'grid';
  groupBy: 'none' | 'type' | 'severity' | 'road' | 'time';
  sortBy: 'severity' | 'updated' | 'created' | 'distance' | 'relevance';
  sortDirection: 'asc' | 'desc';
  
  // ===== Statistics & Metadata =====
  statistics: EventStatistics;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
  dataQuality: DataQuality;
  
  // ===== Actions - Event Management =====
  setEvents: (events: TrafficEvent[]) => void;
  addEvent: (event: TrafficEvent) => void;
  updateEvent: (event: TrafficEvent) => void;
  removeEvent: (eventId: string) => boolean;
  clearEvents: () => void;
  replaceAllEvents: (events: TrafficEvent[]) => void;
  
  // ===== Actions - Differential Sync =====
  applyDifferential: (diff: DifferentialResponse) => SyncResult;
  mergeDifferential: (diff: DifferentialResponse, strategy: MergeStrategy) => void;
  trackLocalChange: (eventId: string, changes: Partial<TrafficEvent>) => void;
  resolveConflict: (eventId: string, resolution: ConflictResolution) => void;
  clearPendingChanges: () => void;
  rollbackOptimisticUpdate: (updateId: string) => void;
  
  // ===== Actions - Selection & UI =====
  selectEvent: (eventId: string | null) => void;
  toggleHighlight: (eventId: string) => void;
  toggleFavorite: (eventId: string) => void;
  hideEvent: (eventId: string) => void;
  unhideEvent: (eventId: string) => void;
  toggleExpanded: (eventId: string) => void;
  clearSelection: () => void;
  
  // ===== Actions - Batch Operations =====
  batchUpdate: (updates: BatchUpdate[]) => void;
  batchDelete: (eventIds: string[]) => void;
  applyFilter: (predicate: (event: TrafficEvent) => boolean) => void;
  
  // ===== Actions - View Management =====
  setViewMode: (mode: EventStoreState['viewMode']) => void;
  setGroupBy: (groupBy: EventStoreState['groupBy']) => void;
  setSorting: (sortBy: EventStoreState['sortBy'], direction?: EventStoreState['sortDirection']) => void;
  
  // ===== Actions - Sync Management =====
  updateSyncTimestamp: (timestamp: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncProgress: (progress: number) => void;
  resetSyncState: () => void;
  
  // ===== Actions - Statistics =====
  updateStatistics: () => void;
  calculateDataQuality: () => void;
  
  // ===== Getters =====
  getEvent: (eventId: string) => TrafficEvent | undefined;
  getAllEvents: () => TrafficEvent[];
  getVisibleEvents: () => TrafficEvent[];
  getEventsByType: (type: EventType) => TrafficEvent[];
  getEventsBySeverity: (severity: EventSeverity) => TrafficEvent[];
  getClosureEvents: () => TrafficEvent[];
  getRecentEvents: (hoursAgo: number) => TrafficEvent[];
  getNearbyEvents: (lat: number, lng: number, radiusKm: number) => TrafficEvent[];
  
  // ===== Utilities =====
  exportState: () => ExportedState;
  importState: (state: ExportedState) => void;
  validateIntegrity: () => IntegrityReport;
  optimizeStorage: () => void;
}

export type SyncStatus = 
  | 'idle' 
  | 'syncing' 
  | 'success' 
  | 'error' 
  | 'conflict' 
  | 'offline';

export interface EventVersion {
  id: string;
  version: string;
  updated: string;
  hash: string;
  source: 'remote' | 'local';
}

export interface OptimisticUpdate {
  id: string;
  originalEvent: TrafficEvent;
  optimisticEvent: TrafficEvent;
  timestamp: number;
  confirmed: boolean;
}

export interface EventStatistics {
  total: number;
  active: number;
  closures: number;
  incidents: number;
  construction: number;
  bySeverity: Record<EventSeverity, number>;
  byType: Record<EventType, number>;
  recentlyUpdated: number;
  averageAge: number;
  updateFrequency: number;
}

export interface DataQuality {
  score: number;
  completeness: number;
  accuracy: number;
  timeliness: number;
  consistency: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  eventId: string;
  type: 'missing_data' | 'stale' | 'inconsistent' | 'duplicate';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface BatchUpdate {
  eventId: string;
  changes: Partial<TrafficEvent>;
  options?: { optimistic?: boolean; validate?: boolean };
}

export type MergeStrategy = 'replace' | 'merge' | 'deep-merge' | 'custom';

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merged';
  mergedEvent?: TrafficEvent;
  timestamp: number;
}

export interface ExportedState {
  events: Array<[string, TrafficEvent]>;
  metadata: {
    exportedAt: string;
    syncId: string;
    version: string;
    eventCount: number;
  };
}

export interface IntegrityReport {
  valid: boolean;
  issues: string[];
  orphanedEvents: string[];
  missingVersions: string[];
  inconsistentData: Array<{ eventId: string; issue: string }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique sync ID
 */
function generateSyncId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate event hash for version tracking
 */
function calculateEventHash(event: TrafficEvent): string {
  const content = JSON.stringify({
    id: event.id,
    status: event.status,
    severity: event.severity,
    updated: event.updated,
    headline: event.headline
  });
  
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Check if event is a closure
 */
function isClosureEvent(event: TrafficEvent): boolean {
  return event.roads?.some(road => road.state === RoadState.CLOSED) ||
         event.event_type === EventType.ROAD_CLOSURE ||
         event.event_subtypes?.includes('road-closure') ||
         false;
}

/**
 * Calculate distance between two points
 */
function calculateDistance(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useEventStore = create<EventStoreState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // ===== Initial State =====
          events: new Map(),
          eventOrder: [],
          eventVersions: new Map(),
          lastSyncTimestamp: null,
          syncId: generateSyncId(),
          syncStatus: 'idle',
          syncProgress: 0,
          pendingChanges: new Map(),
          conflicts: new Map(),
          optimisticUpdates: new Map(),
          selectedEventId: null,
          highlightedEventIds: new Set(),
          favoriteEventIds: new Set(),
          hiddenEventIds: new Set(),
          expandedEventIds: new Set(),
          viewMode: 'map',
          groupBy: 'none',
          sortBy: 'severity',
          sortDirection: 'desc',
          statistics: {
            total: 0,
            active: 0,
            closures: 0,
            incidents: 0,
            construction: 0,
            bySeverity: {
              [EventSeverity.MINOR]: 0,
              [EventSeverity.MODERATE]: 0,
              [EventSeverity.MAJOR]: 0,
              [EventSeverity.SEVERE]: 0
            },
            byType: {} as Record<EventType, number>,
            recentlyUpdated: 0,
            averageAge: 0,
            updateFrequency: 0
          },
          lastUpdated: null,
          isLoading: false,
          error: null,
          dataQuality: {
            score: 100,
            completeness: 100,
            accuracy: 100,
            timeliness: 100,
            consistency: 100,
            issues: []
          },

          // ===== Event Management Actions =====
          setEvents: (events) => set((state) => {
            state.events.clear();
            state.eventOrder = [];
            state.eventVersions.clear();
            
            for (const event of events) {
              state.events.set(event.id, event);
              state.eventOrder.push(event.id);
              state.eventVersions.set(event.id, {
                id: event.id,
                version: calculateEventHash(event),
                updated: event.updated,
                hash: calculateEventHash(event),
                source: 'remote'
              });
            }
            
            state.lastUpdated = new Date();
            state.error = null;
            get().updateStatistics();
            get().calculateDataQuality();
          }),

          addEvent: (event) => set((state) => {
            if (!state.events.has(event.id)) {
              state.events.set(event.id, event);
              state.eventOrder.push(event.id);
              state.eventVersions.set(event.id, {
                id: event.id,
                version: calculateEventHash(event),
                updated: event.updated,
                hash: calculateEventHash(event),
                source: 'remote'
              });
              get().updateStatistics();
            }
          }),

          updateEvent: (event) => set((state) => {
            const existingEvent = state.events.get(event.id);
            
            if (existingEvent) {
              // Check for conflicts if there are pending changes
              const pendingChange = state.pendingChanges.get(event.id);
              if (pendingChange) {
                state.conflicts.set(event.id, {
                  id: event.id,
                  reason: 'concurrent-modification',
                  localChanges: pendingChange.changes,
                  remoteChanges: event
                });
              }
              
              state.events.set(event.id, event);
              state.eventVersions.set(event.id, {
                id: event.id,
                version: calculateEventHash(event),
                updated: event.updated,
                hash: calculateEventHash(event),
                source: 'remote'
              });
              
              get().updateStatistics();
            } else {
              get().addEvent(event);
            }
          }),

          removeEvent: (eventId) => {
            const state = get();
            if (state.events.has(eventId)) {
              set((draft) => {
                draft.events.delete(eventId);
                draft.eventOrder = draft.eventOrder.filter(id => id !== eventId);
                draft.eventVersions.delete(eventId);
                draft.pendingChanges.delete(eventId);
                draft.conflicts.delete(eventId);
                draft.optimisticUpdates.delete(eventId);
                draft.hiddenEventIds.delete(eventId);
                draft.favoriteEventIds.delete(eventId);
                draft.highlightedEventIds.delete(eventId);
                draft.expandedEventIds.delete(eventId);
                
                if (draft.selectedEventId === eventId) {
                  draft.selectedEventId = null;
                }
              });
              
              get().updateStatistics();
              return true;
            }
            return false;
          },

          clearEvents: () => set((state) => {
            state.events.clear();
            state.eventOrder = [];
            state.eventVersions.clear();
            state.pendingChanges.clear();
            state.conflicts.clear();
            state.optimisticUpdates.clear();
            state.selectedEventId = null;
            state.highlightedEventIds.clear();
            state.lastUpdated = null;
            get().updateStatistics();
          }),

          replaceAllEvents: (events) => {
            get().clearEvents();
            get().setEvents(events);
          },

          // ===== Differential Sync Actions =====
          applyDifferential: (diff) => {
            const result: SyncResult = {
              success: true,
              applied: [],
              conflicts: [],
              failed: [],
              rollback: null,
              statistics: {
                totalProcessed: 0,
                successCount: 0,
                conflictCount: 0,
                failureCount: 0,
                processingTimeMs: 0,
                dataSizeBytes: 0
              }
            };

            const startTime = Date.now();

            set((state) => {
              // Process deletions
              for (const id of diff.deleted) {
                if (state.events.delete(id)) {
                  state.eventOrder = state.eventOrder.filter(eid => eid !== id);
                  state.eventVersions.delete(id);
                  result.applied.push({ type: 'delete', id, timestamp: Date.now() });
                }
              }

              // Process additions
              for (const event of diff.added) {
                state.events.set(event.id, event);
                if (!state.eventOrder.includes(event.id)) {
                  state.eventOrder.push(event.id);
                }
                state.eventVersions.set(event.id, {
                  id: event.id,
                  version: calculateEventHash(event),
                  updated: event.updated,
                  hash: calculateEventHash(event),
                  source: 'remote'
                });
                result.applied.push({ type: 'add', id: event.id, timestamp: Date.now() });
              }

              // Process updates
              for (const event of diff.updated) {
                const existingEvent = state.events.get(event.id);
                const pendingChange = state.pendingChanges.get(event.id);
                
                if (pendingChange && existingEvent) {
                  // Conflict detected
                  state.conflicts.set(event.id, {
                    id: event.id,
                    reason: 'concurrent-modification',
                    localChanges: pendingChange.changes,
                    remoteChanges: event
                  });
                  result.conflicts.push({
                    id: event.id,
                    reason: 'concurrent-modification',
                    localChanges: pendingChange.changes,
                    remoteChanges: event
                  });
                  result.statistics.conflictCount++;
                } else {
                  // No conflict, apply update
                  state.events.set(event.id, event);
                  state.eventVersions.set(event.id, {
                    id: event.id,
                    version: calculateEventHash(event),
                    updated: event.updated,
                    hash: calculateEventHash(event),
                    source: 'remote'
                  });
                  result.applied.push({ 
                    type: 'update', 
                    id: event.id, 
                    timestamp: Date.now() 
                  });
                }
              }

              state.lastSyncTimestamp = diff.timestamp;
              state.syncStatus = result.conflicts.length > 0 ? 'conflict' : 'success';
              state.lastUpdated = new Date();
            });

            result.statistics = {
              totalProcessed: diff.added.length + diff.updated.length + diff.deleted.length,
              successCount: result.applied.length,
              conflictCount: result.conflicts.length,
              failureCount: result.failed.length,
              processingTimeMs: Date.now() - startTime,
              dataSizeBytes: JSON.stringify(diff).length
            };

            get().updateStatistics();
            get().calculateDataQuality();

            return result;
          },

          mergeDifferential: (diff, strategy) => set((state) => {
            // Implementation depends on merge strategy
            switch (strategy) {
              case 'replace':
                // Replace with remote version
                for (const event of [...diff.added, ...diff.updated]) {
                  state.events.set(event.id, event);
                  state.pendingChanges.delete(event.id);
                  state.conflicts.delete(event.id);
                }
                break;

              case 'merge':
                // Simple merge - combine fields
                for (const event of [...diff.added, ...diff.updated]) {
                  const existing = state.events.get(event.id);
                  if (existing) {
                    state.events.set(event.id, { ...existing, ...event });
                  } else {
                    state.events.set(event.id, event);
                  }
                }
                break;

              case 'deep-merge':
                // Deep merge - recursive merge
                for (const event of [...diff.added, ...diff.updated]) {
                  const existing = state.events.get(event.id);
                  if (existing) {
                    // Deep merge logic here
                    const merged = deepMerge(existing, event);
                    state.events.set(event.id, merged);
                  } else {
                    state.events.set(event.id, event);
                  }
                }
                break;

              default:
                break;
            }

            // Remove deleted events
            for (const id of diff.deleted) {
              state.events.delete(id);
              state.eventOrder = state.eventOrder.filter(eid => eid !== id);
            }

            state.lastSyncTimestamp = diff.timestamp;
            get().updateStatistics();
          }),

          trackLocalChange: (eventId, changes) => set((state) => {
            const existing = state.pendingChanges.get(eventId) || {
              id: eventId,
              timestamp: Date.now(),
              changes: {},
              type: 'local' as const
            };
            
            state.pendingChanges.set(eventId, {
              ...existing,
              changes: { ...existing.changes, ...changes },
              timestamp: Date.now()
            });

            // Apply optimistically if enabled
            const event = state.events.get(eventId);
            if (event) {
              const optimisticEvent = { ...event, ...changes };
              
              state.optimisticUpdates.set(eventId, {
                id: `opt-${eventId}-${Date.now()}`,
                originalEvent: event,
                optimisticEvent,
                timestamp: Date.now(),
                confirmed: false
              });
              
              state.events.set(eventId, optimisticEvent);
              state.eventVersions.set(eventId, {
                ...state.eventVersions.get(eventId)!,
                source: 'local'
              });
            }
          }),

          resolveConflict: (eventId, resolution) => set((state) => {
            const conflict = state.conflicts.get(eventId);
            if (!conflict) return;

            switch (resolution.strategy) {
              case 'local':
                // Keep local version
                const pending = state.pendingChanges.get(eventId);
                if (pending) {
                  const event = state.events.get(eventId);
                  if (event) {
                    state.events.set(eventId, { ...event, ...pending.changes });
                  }
                }
                break;

              case 'remote':
                // Use remote version
                state.pendingChanges.delete(eventId);
                state.optimisticUpdates.delete(eventId);
                // Event should already be updated from differential
                break;

              case 'merged':
                // Use provided merged version
                if (resolution.mergedEvent) {
                  state.events.set(eventId, resolution.mergedEvent);
                  state.pendingChanges.delete(eventId);
                }
                break;
            }

            state.conflicts.delete(eventId);
            get().updateStatistics();
          }),

          clearPendingChanges: () => set((state) => {
            state.pendingChanges.clear();
            state.optimisticUpdates.clear();
            
            // Revert optimistic updates
            for (const [eventId, update] of state.optimisticUpdates) {
              if (!update.confirmed) {
                state.events.set(eventId, update.originalEvent);
              }
            }
          }),

          rollbackOptimisticUpdate: (updateId) => set((state) => {
            for (const [eventId, update] of state.optimisticUpdates) {
              if (update.id === updateId && !update.confirmed) {
                state.events.set(eventId, update.originalEvent);
                state.optimisticUpdates.delete(eventId);
                break;
              }
            }
          }),

          // ===== Selection & UI Actions =====
          selectEvent: (eventId) => set((state) => {
            state.selectedEventId = eventId;
          }),

          toggleHighlight: (eventId) => set((state) => {
            if (state.highlightedEventIds.has(eventId)) {
              state.highlightedEventIds.delete(eventId);
            } else {
              state.highlightedEventIds.add(eventId);
            }
          }),

          toggleFavorite: (eventId) => set((state) => {
            if (state.favoriteEventIds.has(eventId)) {
              state.favoriteEventIds.delete(eventId);
            } else {
              state.favoriteEventIds.add(eventId);
            }
          }),

          hideEvent: (eventId) => set((state) => {
            state.hiddenEventIds.add(eventId);
          }),

          unhideEvent: (eventId) => set((state) => {
            state.hiddenEventIds.delete(eventId);
          }),

          toggleExpanded: (eventId) => set((state) => {
            if (state.expandedEventIds.has(eventId)) {
              state.expandedEventIds.delete(eventId);
            } else {
              state.expandedEventIds.add(eventId);
            }
          }),

          clearSelection: () => set((state) => {
            state.selectedEventId = null;
            state.highlightedEventIds.clear();
          }),

          // ===== Batch Operations =====
          batchUpdate: (updates) => set((state) => {
            for (const update of updates) {
              const event = state.events.get(update.eventId);
              if (event) {
                const updatedEvent = { ...event, ...update.changes };
                
                if (update.options?.optimistic) {
                  state.optimisticUpdates.set(update.eventId, {
                    id: `batch-${update.eventId}-${Date.now()}`,
                    originalEvent: event,
                    optimisticEvent: updatedEvent,
                    timestamp: Date.now(),
                    confirmed: false
                  });
                }
                
                state.events.set(update.eventId, updatedEvent);
                state.eventVersions.set(update.eventId, {
                  id: update.eventId,
                  version: calculateEventHash(updatedEvent),
                  updated: updatedEvent.updated,
                  hash: calculateEventHash(updatedEvent),
                  source: 'local'
                });
              }
            }
            
            get().updateStatistics();
          }),

          batchDelete: (eventIds) => {
            for (const id of eventIds) {
              get().removeEvent(id);
            }
          },

          applyFilter: (predicate) => set((state) => {
            const eventsToHide: string[] = [];
            
            for (const [id, event] of state.events) {
              if (!predicate(event)) {
                eventsToHide.push(id);
              }
            }
            
            for (const id of eventsToHide) {
              state.hiddenEventIds.add(id);
            }
          }),

          // ===== View Management =====
          setViewMode: (mode) => set((state) => {
            state.viewMode = mode;
          }),

          setGroupBy: (groupBy) => set((state) => {
            state.groupBy = groupBy;
          }),

          setSorting: (sortBy, direction) => set((state) => {
            state.sortBy = sortBy;
            if (direction) {
              state.sortDirection = direction;
            }
          }),

          // ===== Sync Management =====
          updateSyncTimestamp: (timestamp) => set((state) => {
            state.lastSyncTimestamp = timestamp;
          }),

          setSyncStatus: (status) => set((state) => {
            state.syncStatus = status;
          }),

          setSyncProgress: (progress) => set((state) => {
            state.syncProgress = Math.min(100, Math.max(0, progress));
          }),

          resetSyncState: () => set((state) => {
            state.lastSyncTimestamp = null;
            state.syncStatus = 'idle';
            state.syncProgress = 0;
            state.pendingChanges.clear();
            state.conflicts.clear();
            state.optimisticUpdates.clear();
            state.syncId = generateSyncId();
          }),

          // ===== Statistics =====
          updateStatistics: () => set((state) => {
            const events = Array.from(state.events.values());
            const now = Date.now();
            const recentThreshold = now - 3600000; // 1 hour
            
            const stats: EventStatistics = {
              total: events.length,
              active: 0,
              closures: 0,
              incidents: 0,
              construction: 0,
              bySeverity: {
                [EventSeverity.MINOR]: 0,
                [EventSeverity.MODERATE]: 0,
                [EventSeverity.MAJOR]: 0,
                [EventSeverity.SEVERE]: 0
              },
              byType: {} as Record<EventType, number>,
              recentlyUpdated: 0,
              averageAge: 0,
              updateFrequency: 0
            };

            let totalAge = 0;

            for (const event of events) {
              if (event.status === 'ACTIVE') stats.active++;
              if (isClosureEvent(event)) stats.closures++;
              if (event.event_type === EventType.INCIDENT) stats.incidents++;
              if (event.event_type === EventType.CONSTRUCTION) stats.construction++;
              
              stats.bySeverity[event.severity]++;
              stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
              
              const updatedTime = new Date(event.updated).getTime();
              if (updatedTime > recentThreshold) {
                stats.recentlyUpdated++;
              }
              
              totalAge += (now - updatedTime) / 60000; // Convert to minutes
            }

            stats.averageAge = events.length > 0 ? Math.floor(totalAge / events.length) : 0;
            
            // Calculate update frequency (updates per hour)
            const updateTimes = events
              .map(e => new Date(e.updated).getTime())
              .sort((a, b) => b - a);
            
            if (updateTimes.length > 1) {
              const timeDiff = updateTimes[0] - updateTimes[updateTimes.length - 1];
              const hours = timeDiff / 3600000;
              stats.updateFrequency = hours > 0 ? updateTimes.length / hours : 0;
            }

            state.statistics = stats;
          }),

          calculateDataQuality: () => set((state) => {
            const events = Array.from(state.events.values());
            const issues: QualityIssue[] = [];
            let completenessScore = 100;
            let accuracyScore = 100;
            let timelinessScore = 100;
            let consistencyScore = 100;
            
            const now = Date.now();
            const staleThreshold = 24 * 3600000; // 24 hours
            
            for (const event of events) {
              let eventIssues = 0;
              
              // Completeness checks
              if (!event.headline) {
                issues.push({
                  eventId: event.id,
                  type: 'missing_data',
                  description: 'Missing headline',
                  severity: 'medium'
                });
                eventIssues++;
              }
              
              if (!event.description) {
                issues.push({
                  eventId: event.id,
                  type: 'missing_data',
                  description: 'Missing description',
                  severity: 'low'
                });
                eventIssues++;
              }
              
              if (!event.geography) {
                issues.push({
                  eventId: event.id,
                  type: 'missing_data',
                  description: 'Missing location data',
                  severity: 'high'
                });
                eventIssues++;
              }
              
              // Timeliness checks
              const age = now - new Date(event.updated).getTime();
              if (age > staleThreshold) {
                issues.push({
                  eventId: event.id,
                  type: 'stale',
                  description: `Data is ${Math.floor(age / 3600000)} hours old`,
                  severity: 'medium'
                });
                timelinessScore -= 2;
              }
              
              // Deduct from completeness score
              completenessScore -= eventIssues * 2;
            }
            
            // Check for duplicates (consistency)
            const seenEvents = new Map<string, string>();
            for (const event of events) {
              const key = `${event.headline}-${event.event_type}-${event.severity}`;
              if (seenEvents.has(key)) {
                issues.push({
                  eventId: event.id,
                  type: 'duplicate',
                  description: `Possible duplicate of ${seenEvents.get(key)}`,
                  severity: 'low'
                });
                consistencyScore -= 5;
              } else {
                seenEvents.set(key, event.id);
              }
            }
            
            // Calculate overall score
            const score = Math.max(0, Math.min(100,
              (completenessScore + accuracyScore + timelinessScore + consistencyScore) / 4
            ));
            
            state.dataQuality = {
              score,
              completeness: Math.max(0, completenessScore),
              accuracy: accuracyScore,
              timeliness: Math.max(0, timelinessScore),
              consistency: Math.max(0, consistencyScore),
              issues
            };
          }),

          // ===== Getters =====
          getEvent: (eventId) => {
            return get().events.get(eventId);
          },

          getAllEvents: () => {
            return Array.from(get().events.values());
          },

          getVisibleEvents: () => {
            const state = get();
            return Array.from(state.events.values())
              .filter(event => !state.hiddenEventIds.has(event.id));
          },

          getEventsByType: (type) => {
            return Array.from(get().events.values())
              .filter(event => event.event_type === type);
          },

          getEventsBySeverity: (severity) => {
            return Array.from(get().events.values())
              .filter(event => event.severity === severity);
          },

          getClosureEvents: () => {
            return Array.from(get().events.values())
              .filter(isClosureEvent);
          },

          getRecentEvents: (hoursAgo) => {
            const threshold = Date.now() - (hoursAgo * 3600000);
            return Array.from(get().events.values())
              .filter(event => new Date(event.updated).getTime() > threshold);
          },

          getNearbyEvents: (lat, lng, radiusKm) => {
            return Array.from(get().events.values())
              .filter(event => {
                if (!event.geography?.coordinates) return false;
                
                if (event.geography.type === 'Point') {
                  const [eventLng, eventLat] = event.geography.coordinates as [number, number];
                  const distance = calculateDistance(lat, lng, eventLat, eventLng);
                  return distance <= radiusKm;
                }
                
                // For LineString, check if any point is within radius
                if (event.geography.type === 'LineString') {
                  const coordinates = event.geography.coordinates as number[][];
                  return coordinates.some(coord => {
                    const [eventLng, eventLat] = coord;
                    const distance = calculateDistance(lat, lng, eventLat, eventLng);
                    return distance <= radiusKm;
                  });
                }
                
                return false;
              });
          },

          // ===== Utilities =====
          exportState: () => {
            const state = get();
            return {
              events: Array.from(state.events.entries()),
              metadata: {
                exportedAt: new Date().toISOString(),
                syncId: state.syncId,
                version: '2.0.0',
                eventCount: state.events.size
              }
            };
          },

          importState: (importedState) => set((state) => {
            state.events = new Map(importedState.events);
            state.eventOrder = importedState.events.map(([id]) => id);
            state.syncId = importedState.metadata.syncId;
            state.lastUpdated = new Date(importedState.metadata.exportedAt);
            
            // Rebuild versions
            for (const [id, event] of state.events) {
              state.eventVersions.set(id, {
                id,
                version: calculateEventHash(event),
                updated: event.updated,
                hash: calculateEventHash(event),
                source: 'remote'
              });
            }
            
            get().updateStatistics();
            get().calculateDataQuality();
          }),

          validateIntegrity: () => {
            const state = get();
            const issues: string[] = [];
            const orphanedEvents: string[] = [];
            const missingVersions: string[] = [];
            const inconsistentData: Array<{ eventId: string; issue: string }> = [];
            
            // Check for orphaned events in order array
            for (const id of state.eventOrder) {
              if (!state.events.has(id)) {
                orphanedEvents.push(id);
              }
            }
            
            // Check for missing versions
            for (const [id] of state.events) {
              if (!state.eventVersions.has(id)) {
                missingVersions.push(id);
              }
            }
            
            // Check for data inconsistencies
            for (const [id, event] of state.events) {
              if (!event.id) {
                inconsistentData.push({ eventId: id, issue: 'Missing ID field' });
              }
              if (event.id !== id) {
                inconsistentData.push({ 
                  eventId: id, 
                  issue: `ID mismatch: ${event.id} !== ${id}` 
                });
              }
            }
            
            const valid = orphanedEvents.length === 0 && 
                         missingVersions.length === 0 && 
                         inconsistentData.length === 0;
            
            return {
              valid,
              issues,
              orphanedEvents,
              missingVersions,
              inconsistentData
            };
          },

          optimizeStorage: () => set((state) => {
            // Remove orphaned references
            const validIds = new Set(state.events.keys());
            
            state.eventOrder = state.eventOrder.filter(id => validIds.has(id));
            
            for (const id of state.eventVersions.keys()) {
              if (!validIds.has(id)) {
                state.eventVersions.delete(id);
              }
            }
            
            for (const id of state.pendingChanges.keys()) {
              if (!validIds.has(id)) {
                state.pendingChanges.delete(id);
              }
            }
            
            for (const id of state.conflicts.keys()) {
              if (!validIds.has(id)) {
                state.conflicts.delete(id);
              }
            }
            
            // Clear invalid selections
            if (state.selectedEventId && !validIds.has(state.selectedEventId)) {
              state.selectedEventId = null;
            }
            
            // Clean up sets
            for (const id of state.highlightedEventIds) {
              if (!validIds.has(id)) {
                state.highlightedEventIds.delete(id);
              }
            }
            
            for (const id of state.favoriteEventIds) {
              if (!validIds.has(id)) {
                state.favoriteEventIds.delete(id);
              }
            }
            
            for (const id of state.hiddenEventIds) {
              if (!validIds.has(id)) {
                state.hiddenEventIds.delete(id);
              }
            }
            
            for (const id of state.expandedEventIds) {
              if (!validIds.has(id)) {
                state.expandedEventIds.delete(id);
              }
            }
          })
        }))
      ),
      {
        name: 'event-store',
        partialize: (state) => ({
          favoriteEventIds: Array.from(state.favoriteEventIds),
          hiddenEventIds: Array.from(state.hiddenEventIds),
          viewMode: state.viewMode,
          groupBy: state.groupBy,
          sortBy: state.sortBy,
          sortDirection: state.sortDirection,
          syncId: state.syncId,
          lastSyncTimestamp: state.lastSyncTimestamp
        }),
        merge: (persistedState, currentState) => ({
          ...currentState,
          favoriteEventIds: new Set(persistedState?.favoriteEventIds || []),
          hiddenEventIds: new Set(persistedState?.hiddenEventIds || []),
          viewMode: persistedState?.viewMode || currentState.viewMode,
          groupBy: persistedState?.groupBy || currentState.groupBy,
          sortBy: persistedState?.sortBy || currentState.sortBy,
          sortDirection: persistedState?.sortDirection || currentState.sortDirection,
          syncId: persistedState?.syncId || currentState.syncId,
          lastSyncTimestamp: persistedState?.lastSyncTimestamp || currentState.lastSyncTimestamp
        })
      }
    )
  )
);

// ============================================================================
// Helper Functions
// ============================================================================

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Export type and store
export type { TrafficEvent };
export default useEventStore;
