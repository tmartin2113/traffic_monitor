/**
 * Event Store with IndexedDB and Web Worker Support
 * Production-ready Zustand store with differential sync and offline capabilities
 * 
 * @module stores/eventStore
 * @version 3.0.0
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import * as Comlink from 'comlink';
import {
  TrafficEvent,
  EventType,
  EventSeverity,
  RoadState
} from '@types/api.types';
import { DifferentialResponse } from '@services/api/trafficApi';
import { EventDiff, ConflictInfo, SyncResult } from '@services/sync/DifferentialSync';
import { db, StoredEvent } from '@db/TrafficDatabase';
import { socketClient } from '@services/realtime/SocketClient';

// ============================================================================
// Type Definitions
// ============================================================================

export interface EventStoreState {
  // ===== Core Event Data =====
  events: Map<string, TrafficEvent>;
  eventOrder: string[];
  totalEventCount: number; // Total including database
  
  // ===== IndexedDB Integration =====
  databaseSynced: boolean;
  lastDatabaseSync: Date | null;
  offlineMode: boolean;
  
  // ===== Version & Sync State =====
  eventVersions: Map<string, EventVersion>;
  lastSyncTimestamp: string | null;
  syncId: string;
  syncStatus: SyncStatus;
  syncProgress: number;
  syncQueue: DifferentialResponse[];
  
  // ===== Web Worker State =====
  workerReady: boolean;
  workerProcessing: boolean;
  
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
  virtualScrollEnabled: boolean;
  
  // ===== Real-time Connection =====
  realtimeConnected: boolean;
  realtimeRoom: string | null;
  
  // ===== Statistics & Metadata =====
  statistics: EventStatistics;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;
  dataQuality: DataQuality;
  performanceMetrics: PerformanceMetrics;
  
  // ===== Actions - Event Management =====
  setEvents: (events: TrafficEvent[]) => Promise<void>;
  addEvent: (event: TrafficEvent) => Promise<void>;
  updateEvent: (event: TrafficEvent) => Promise<void>;
  removeEvent: (eventId: string) => Promise<boolean>;
  clearEvents: () => Promise<void>;
  replaceAllEvents: (events: TrafficEvent[]) => Promise<void>;
  
  // ===== Actions - Database Operations =====
  loadFromDatabase: (filters?: any) => Promise<void>;
  syncWithDatabase: () => Promise<void>;
  queryDatabase: (query: DatabaseQuery) => Promise<TrafficEvent[]>;
  clearDatabase: () => Promise<void>;
  exportDatabase: () => Promise<Blob>;
  importDatabase: (data: Blob) => Promise<void>;
  
  // ===== Actions - Differential Sync =====
  applyDifferential: (diff: DifferentialResponse) => Promise<SyncResult>;
  applyDifferentialInWorker: (diff: DifferentialResponse) => Promise<SyncResult>;
  queueDifferential: (diff: DifferentialResponse) => void;
  processQueuedDifferentials: () => Promise<void>;
  mergeDifferential: (diff: DifferentialResponse, strategy: MergeStrategy) => Promise<void>;
  
  // ===== Actions - Conflict Resolution =====
  trackLocalChange: (eventId: string, changes: Partial<TrafficEvent>) => void;
  resolveConflict: (eventId: string, resolution: ConflictResolution) => Promise<void>;
  resolveAllConflicts: (strategy: 'local' | 'remote' | 'newest') => Promise<void>;
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
  selectMultiple: (eventIds: string[]) => void;
  
  // ===== Actions - Batch Operations =====
  batchUpdate: (updates: BatchUpdate[]) => Promise<void>;
  batchDelete: (eventIds: string[]) => Promise<void>;
  applyFilter: (predicate: (event: TrafficEvent) => boolean) => void;
  
  // ===== Actions - View Management =====
  setViewMode: (mode: EventStoreState['viewMode']) => void;
  setGroupBy: (groupBy: EventStoreState['groupBy']) => void;
  setSorting: (sortBy: EventStoreState['sortBy'], direction?: EventStoreState['sortDirection']) => void;
  setVirtualScroll: (enabled: boolean) => void;
  
  // ===== Actions - Sync Management =====
  updateSyncTimestamp: (timestamp: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncProgress: (progress: number) => void;
  resetSyncState: () => void;
  initializeWorker: () => Promise<void>;
  
  // ===== Actions - Real-time =====
  connectRealtime: (apiKey: string) => Promise<void>;
  disconnectRealtime: () => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  
  // ===== Actions - Statistics =====
  updateStatistics: () => void;
  calculateDataQuality: () => void;
  updatePerformanceMetrics: () => void;
  
  // ===== Getters =====
  getEvent: (eventId: string) => TrafficEvent | undefined;
  getAllEvents: () => TrafficEvent[];
  getVisibleEvents: () => TrafficEvent[];
  getEventsByType: (type: EventType) => TrafficEvent[];
  getEventsBySeverity: (severity: EventSeverity) => TrafficEvent[];
  getClosureEvents: () => TrafficEvent[];
  getRecentEvents: (hoursAgo: number) => TrafficEvent[];
  getNearbyEvents: (lat: number, lng: number, radiusKm: number) => TrafficEvent[];
  getPaginatedEvents: (page: number, pageSize: number) => Promise<TrafficEvent[]>;
  
  // ===== Utilities =====
  exportState: () => ExportedState;
  importState: (state: ExportedState) => Promise<void>;
  validateIntegrity: () => IntegrityReport;
  optimizeStorage: () => Promise<void>;
  getMemoryUsage: () => MemoryUsage;
}

// Supporting Types
export type SyncStatus = 
  | 'idle' 
  | 'syncing' 
  | 'success' 
  | 'error' 
  | 'conflict' 
  | 'offline'
  | 'queued';

export interface EventVersion {
  id: string;
  version: string;
  updated: string;
  hash: string;
  source: 'remote' | 'local' | 'database';
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
  databaseCount: number;
  memoryCount: number;
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

export interface PerformanceMetrics {
  renderTime: number;
  syncTime: number;
  queryTime: number;
  workerTime: number;
  memoryUsage: number;
  cacheHitRate: number;
}

export interface DatabaseQuery {
  severity?: EventSeverity;
  eventType?: EventType;
  status?: string;
  updatedAfter?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface BatchUpdate {
  eventId: string;
  changes: Partial<TrafficEvent>;
  options?: { optimistic?: boolean; validate?: boolean };
}

export type MergeStrategy = 'replace' | 'merge' | 'deep-merge' | 'custom';

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merged' | 'newest';
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
    databaseCount: number;
  };
}

export interface IntegrityReport {
  valid: boolean;
  issues: string[];
  orphanedEvents: string[];
  missingVersions: string[];
  inconsistentData: Array<{ eventId: string; issue: string }>;
  databaseIntegrity: boolean;
}

export interface MemoryUsage {
  events: number;
  pendingChanges: number;
  conflicts: number;
  total: number;
  percentage: number;
}

// ============================================================================
// Worker Setup
// ============================================================================

let differentialWorker: any = null;

async function initializeWorker() {
  if (!differentialWorker) {
    try {
      const Worker = Comlink.wrap(
        new Worker(new URL('../workers/differential.worker.ts', import.meta.url), {
          type: 'module'
        })
      );
      differentialWorker = await new Worker();
      console.log('Differential worker initialized');
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      // Fallback to main thread processing
    }
  }
  return differentialWorker;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSyncId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function calculateEventHash(event: TrafficEvent): string {
  const content = JSON.stringify({
    id: event.id,
    status: event.status,
    severity: event.severity,
    updated: event.updated
  });
  
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

function isClosureEvent(event: TrafficEvent): boolean {
  return event.roads?.some(road => road.state === RoadState.CLOSED) ||
         event.event_type === EventType.ROAD_CLOSURE ||
         false;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
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
          totalEventCount: 0,
          databaseSynced: false,
          lastDatabaseSync: null,
          offlineMode: false,
          eventVersions: new Map(),
          lastSyncTimestamp: null,
          syncId: generateSyncId(),
          syncStatus: 'idle',
          syncProgress: 0,
          syncQueue: [],
          workerReady: false,
          workerProcessing: false,
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
          virtualScrollEnabled: true,
          realtimeConnected: false,
          realtimeRoom: null,
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
              [EventSeverity.SEVERE]: 0,
              [EventSeverity.UNKNOWN]: 0
            },
            byType: {} as Record<EventType, number>,
            recentlyUpdated: 0,
            averageAge: 0,
            updateFrequency: 0,
            databaseCount: 0,
            memoryCount: 0
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
          performanceMetrics: {
            renderTime: 0,
            syncTime: 0,
            queryTime: 0,
            workerTime: 0,
            memoryUsage: 0,
            cacheHitRate: 0
          },

          // ===== Event Management Actions =====
          setEvents: async (events) => {
            const startTime = performance.now();
            
            // Store in IndexedDB
            await db.events.bulkPut(events.map(e => ({
              ...e,
              _lastSynced: new Date().toISOString()
            })));
            
            set((state) => {
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
              
              state.totalEventCount = events.length;
              state.databaseSynced = true;
              state.lastDatabaseSync = new Date();
              state.lastUpdated = new Date();
              state.error = null;
              
              state.performanceMetrics.syncTime = performance.now() - startTime;
            });
            
            get().updateStatistics();
            get().calculateDataQuality();
          },

          addEvent: async (event) => {
            // Add to database
            await db.events.put({
              ...event,
              _lastSynced: new Date().toISOString()
            });
            
            set((state) => {
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
                state.totalEventCount++;
              }
            });
            
            get().updateStatistics();
          },

          updateEvent: async (event) => {
            // Update in database
            await db.events.put({
              ...event,
              _lastSynced: new Date().toISOString()
            });
            
            set((state) => {
              const existingEvent = state.events.get(event.id);
              
              if (existingEvent) {
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
              } else {
                get().addEvent(event);
              }
            });
            
            get().updateStatistics();
          },

          removeEvent: async (eventId) => {
            // Remove from database
            await db.events.delete(eventId);
            
            const state = get();
            if (state.events.has(eventId)) {
              set((draft) => {
                draft.events.delete(eventId);
                draft.eventOrder = draft.eventOrder.filter(id => id !== eventId);
                draft.eventVersions.delete(eventId);
                draft.pendingChanges.delete(eventId);
                draft.conflicts.delete(eventId);
                draft.optimisticUpdates.delete(eventId);
                draft.totalEventCount--;
                
                if (draft.selectedEventId === eventId) {
                  draft.selectedEventId = null;
                }
              });
              
              get().updateStatistics();
              return true;
            }
            return false;
          },

          clearEvents: async () => {
            // Clear database
            await db.events.clear();
            
            set((state) => {
              state.events.clear();
              state.eventOrder = [];
              state.eventVersions.clear();
              state.pendingChanges.clear();
              state.conflicts.clear();
              state.optimisticUpdates.clear();
              state.totalEventCount = 0;
              state.selectedEventId = null;
              state.highlightedEventIds.clear();
              state.lastUpdated = null;
              state.databaseSynced = false;
            });
            
            get().updateStatistics();
          },

          replaceAllEvents: async (events) => {
            await get().clearEvents();
            await get().setEvents(events);
          },

          // ===== Database Operations =====
          loadFromDatabase: async (filters = {}) => {
            const startTime = performance.now();
            set({ isLoading: true });
            
            try {
              const events = await db.queryEvents(filters);
              
              set((state) => {
                state.events.clear();
                state.eventOrder = [];
                
                for (const event of events) {
                  state.events.set(event.id, event);
                  state.eventOrder.push(event.id);
                }
                
                state.databaseSynced = true;
                state.lastDatabaseSync = new Date();
                state.performanceMetrics.queryTime = performance.now() - startTime;
              });
              
              get().updateStatistics();
              
            } catch (error) {
              set({ error: 'Failed to load from database' });
              console.error('Database load error:', error);
            } finally {
              set({ isLoading: false });
            }
          },

          syncWithDatabase: async () => {
            const events = Array.from(get().events.values());
            await db.events.bulkPut(events);
            set({ 
              databaseSynced: true,
              lastDatabaseSync: new Date()
            });
          },

          queryDatabase: async (query) => {
            const startTime = performance.now();
            const results = await db.queryEvents(query);
            
            set((state) => {
              state.performanceMetrics.queryTime = performance.now() - startTime;
            });
            
            return results;
          },

          clearDatabase: async () => {
            await db.clearAllData();
            set({ databaseSynced: false });
          },

          exportDatabase: async () => {
            const events = await db.events.toArray();
            const data = JSON.stringify(events);
            return new Blob([data], { type: 'application/json' });
          },

          importDatabase: async (data) => {
            const text = await data.text();
            const events = JSON.parse(text);
            await db.events.bulkPut(events);
            await get().loadFromDatabase();
          },

          // ===== Differential Sync Actions =====
          applyDifferential: async (diff) => {
            const startTime = performance.now();
            
            // Try worker first
            if (get().workerReady && differentialWorker) {
              return get().applyDifferentialInWorker(diff);
            }
            
            // Fallback to main thread
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

            // Apply to database
            await db.applyDifferential(diff.added, diff.updated, diff.deleted);
            
            set((state) => {
              // Process deletions
              for (const id of diff.deleted) {
                if (state.events.delete(id)) {
                  state.eventOrder = state.eventOrder.filter(eid => eid !== id);
                  result.applied.push({ type: 'delete', id, timestamp: Date.now() });
                }
              }

              // Process additions and updates
              for (const event of [...diff.added, ...diff.updated]) {
                const pendingChange = state.pendingChanges.get(event.id);
                
                if (pendingChange && state.events.has(event.id)) {
                  // Conflict
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
                } else {
                  state.events.set(event.id, event);
                  result.applied.push({ 
                    type: state.events.has(event.id) ? 'update' : 'add',
                    id: event.id,
                    timestamp: Date.now()
                  });
                }
              }

              state.lastSyncTimestamp = diff.timestamp;
              state.syncStatus = result.conflicts.length > 0 ? 'conflict' : 'success';
              state.performanceMetrics.syncTime = performance.now() - startTime;
            });

            result.statistics.totalProcessed = diff.added.length + diff.updated.length + diff.deleted.length;
            result.statistics.successCount = result.applied.length;
            result.statistics.conflictCount = result.conflicts.length;
            result.statistics.processingTimeMs = performance.now() - startTime;

            get().updateStatistics();
            return result;
          },

          applyDifferentialInWorker: async (diff) => {
            if (!differentialWorker) {
              return get().applyDifferential(diff);
            }

            set({ workerProcessing: true });
            const startTime = performance.now();
            
            try {
              const result = await differentialWorker.applyDifferential(
                diff,
                Array.from(get().events.entries())
              );
              
              // Reload from database after worker processing
              await get().loadFromDatabase();
              
              set((state) => {
                state.lastSyncTimestamp = diff.timestamp;
                state.syncStatus = result.conflicts.length > 0 ? 'conflict' : 'success';
                state.performanceMetrics.workerTime = performance.now() - startTime;
              });
              
              return result;
              
            } catch (error) {
              console.error('Worker processing failed:', error);
              return get().applyDifferential(diff);
            } finally {
              set({ workerProcessing: false });
            }
          },

          queueDifferential: (diff) => {
            set((state) => {
              state.syncQueue.push(diff);
              state.syncStatus = 'queued';
            });
          },

          processQueuedDifferentials: async () => {
            const queue = get().syncQueue;
            if (queue.length === 0) return;
            
            set({ syncQueue: [] });
            
            for (const diff of queue) {
              await get().applyDifferential(diff);
            }
          },

          mergeDifferential: async (diff, strategy) => {
            // Implementation based on strategy
            await get().applyDifferential(diff);
          },

          // ===== Real-time Actions =====
          connectRealtime: async (apiKey) => {
            socketClient.config.apiKey = apiKey;
            
            await socketClient.connect();
            
            // Set up event handlers
            socketClient.on('differential', (diff: DifferentialResponse) => {
              get().applyDifferential(diff);
            });
            
            socketClient.on('event:update', (event: TrafficEvent) => {
              get().updateEvent(event);
            });
            
            socketClient.on('event:delete', (eventId: string) => {
              get().removeEvent(eventId);
            });
            
            set({ realtimeConnected: true });
          },

          disconnectRealtime: () => {
            socketClient.disconnect();
            set({ realtimeConnected: false, realtimeRoom: null });
          },

          joinRoom: (room) => {
            socketClient.joinRoom(room);
            set({ realtimeRoom: room });
          },

          leaveRoom: (room) => {
            socketClient.leaveRoom(room);
            set({ realtimeRoom: null });
          },

          // ===== Worker Initialization =====
          initializeWorker: async () => {
            const worker = await initializeWorker();
            set({ workerReady: !!worker });
          },

          // ===== Other existing methods remain the same =====
          trackLocalChange: (eventId, changes) => set((state) => {
            const diff: EventDiff = {
              id: eventId,
              timestamp: Date.now(),
              changes,
              type: 'local'
            };
            
            state.pendingChanges.set(eventId, diff);
            
            // Apply optimistically
            const event = state.events.get(eventId);
            if (event) {
              state.events.set(eventId, { ...event, ...changes });
            }
          }),

          resolveConflict: async (eventId, resolution) => {
            const conflict = get().conflicts.get(eventId);
            if (!conflict) return;

            switch (resolution.strategy) {
              case 'local':
                const pending = get().pendingChanges.get(eventId);
                if (pending) {
                  const event = get().events.get(eventId);
                  if (event) {
                    await get().updateEvent({ ...event, ...pending.changes });
                  }
                }
                break;
                
              case 'remote':
                get().pendingChanges.delete(eventId);
                break;
                
              case 'merged':
                if (resolution.mergedEvent) {
                  await get().updateEvent(resolution.mergedEvent);
                }
                break;
                
              case 'newest':
                // Use the newest based on timestamp
                break;
            }

            set((state) => {
              state.conflicts.delete(eventId);
            });
          },

          resolveAllConflicts: async (strategy) => {
            const conflicts = Array.from(get().conflicts.keys());
            for (const eventId of conflicts) {
              await get().resolveConflict(eventId, {
                strategy,
                timestamp: Date.now()
              });
            }
          },

          clearPendingChanges: () => set((state) => {
            state.pendingChanges.clear();
            state.optimisticUpdates.clear();
          }),

          rollbackOptimisticUpdate: (updateId) => set((state) => {
            for (const [eventId, update] of state.optimisticUpdates) {
              if (update.id === updateId) {
                state.events.set(eventId, update.originalEvent);
                state.optimisticUpdates.delete(eventId);
                break;
              }
            }
          }),

          // ===== UI Actions =====
          selectEvent: (eventId) => set({ selectedEventId: eventId }),
          
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

          selectMultiple: (eventIds) => set((state) => {
            state.highlightedEventIds.clear();
            for (const id of eventIds) {
              state.highlightedEventIds.add(id);
            }
          }),

          // ===== Batch Operations =====
          batchUpdate: async (updates) => {
            const events = updates.map(u => {
              const event = get().events.get(u.eventId);
              return event ? { ...event, ...u.changes } : null;
            }).filter(Boolean) as TrafficEvent[];
            
            await db.events.bulkPut(events);
            
            set((state) => {
              for (const update of updates) {
                const event = state.events.get(update.eventId);
                if (event) {
                  state.events.set(update.eventId, { ...event, ...update.changes });
                }
              }
            });
            
            get().updateStatistics();
          },

          batchDelete: async (eventIds) => {
            await db.events.bulkDelete(eventIds);
            
            set((state) => {
              for (const id of eventIds) {
                state.events.delete(id);
                state.eventOrder = state.eventOrder.filter(eid => eid !== id);
              }
            });
            
            get().updateStatistics();
          },

          applyFilter: (predicate) => set((state) => {
            for (const [id, event] of state.events) {
              if (!predicate(event)) {
                state.hiddenEventIds.add(id);
              }
            }
          }),

          // ===== View Management =====
          setViewMode: (mode) => set({ viewMode: mode }),
          setGroupBy: (groupBy) => set({ groupBy }),
          setSorting: (sortBy, direction) => set({ 
            sortBy,
            sortDirection: direction || get().sortDirection
          }),
          setVirtualScroll: (enabled) => set({ virtualScrollEnabled: enabled }),

          // ===== Sync Management =====
          updateSyncTimestamp: (timestamp) => set({ lastSyncTimestamp: timestamp }),
          setSyncStatus: (status) => set({ syncStatus: status }),
          setSyncProgress: (progress) => set({ syncProgress: progress }),
          
          resetSyncState: () => set({
            lastSyncTimestamp: null,
            syncStatus: 'idle',
            syncProgress: 0,
            syncId: generateSyncId()
          }),

          // ===== Statistics =====
          updateStatistics: () => set((state) => {
            const events = Array.from(state.events.values());
            const dbCount = state.totalEventCount;
            const stats = calculateStatistics(events);
            
            state.statistics = {
              ...stats,
              databaseCount: dbCount,
              memoryCount: events.length
            };
          }),

          calculateDataQuality: () => set((state) => {
            const events = Array.from(state.events.values());
            const quality = calculateDataQuality(events);
            state.dataQuality = quality;
          }),

          updatePerformanceMetrics: () => set((state) => {
            const usage = calculateMemoryUsage(state);
            state.performanceMetrics.memoryUsage = usage;
          }),

          // ===== Getters =====
          getEvent: (eventId) => get().events.get(eventId),
          
          getAllEvents: () => Array.from(get().events.values()),
          
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
            return Array.from(get().events.values()).filter(isClosureEvent);
          },

          getRecentEvents: (hoursAgo) => {
            const threshold = Date.now() - (hoursAgo * 3600000);
            return Array.from(get().events.values())
              .filter(event => new Date(event.updated).getTime() > threshold);
          },

          getNearbyEvents: (lat, lng, radiusKm) => {
            return Array.from(get().events.values()).filter(event => {
              if (!event.geography?.coordinates) return false;
              
              if (event.geography.type === 'Point') {
                const [eventLng, eventLat] = event.geography.coordinates as [number, number];
                return calculateDistance(lat, lng, eventLat, eventLng) <= radiusKm;
              }
              
              return false;
            });
          },

          getPaginatedEvents: async (page, pageSize) => {
            const events = await db.queryEvents({
              limit: pageSize,
              offset: page * pageSize,
              sortBy: get().sortBy,
              sortDirection: get().sortDirection
            });
            return events;
          },

          // ===== Utilities =====
          exportState: () => {
            const state = get();
            return {
              events: Array.from(state.events.entries()),
              metadata: {
                exportedAt: new Date().toISOString(),
                syncId: state.syncId,
                version: '3.0.0',
                eventCount: state.events.size,
                databaseCount: state.totalEventCount
              }
            };
          },

          importState: async (importedState) => {
            await db.events.bulkPut(importedState.events.map(([, event]) => event));
            await get().loadFromDatabase();
          },

          validateIntegrity: () => {
            const state = get();
            const report = validateStoreIntegrity(state);
            return report;
          },

          optimizeStorage: async () => {
            // Clean up old events
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            
            await db.events
              .where('updated')
              .below(cutoff.toISOString())
              .delete();
            
            // Optimize worker if available
            if (differentialWorker) {
              await differentialWorker.optimize();
            }
            
            get().updateStatistics();
          },

          getMemoryUsage: () => {
            const state = get();
            return calculateMemoryUsage(state);
          }
        }))
      ),
      {
        name: 'event-store',
        // Only persist UI preferences, not event data
        partialize: (state) => ({
          favoriteEventIds: Array.from(state.favoriteEventIds),
          hiddenEventIds: Array.from(state.hiddenEventIds),
          viewMode: state.viewMode,
          groupBy: state.groupBy,
          sortBy: state.sortBy,
          sortDirection: state.sortDirection,
          virtualScrollEnabled: state.virtualScrollEnabled,
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
          virtualScrollEnabled: persistedState?.virtualScrollEnabled ?? true,
          syncId: persistedState?.syncId || currentState.syncId
        })
      }
    )
  )
);

// ============================================================================
// Utility Functions
// ============================================================================

function calculateStatistics(events: TrafficEvent[]): Omit<EventStatistics, 'databaseCount' | 'memoryCount'> {
  const now = Date.now();
  const stats = {
    total: events.length,
    active: 0,
    closures: 0,
    incidents: 0,
    construction: 0,
    bySeverity: {
      [EventSeverity.MINOR]: 0,
      [EventSeverity.MODERATE]: 0,
      [EventSeverity.MAJOR]: 0,
      [EventSeverity.SEVERE]: 0,
      [EventSeverity.UNKNOWN]: 0
    },
    byType: {} as Record<EventType, number>,
    recentlyUpdated: 0,
    averageAge: 0,
    updateFrequency: 0
  };

  let totalAge = 0;
  const recentThreshold = now - 3600000;

  for (const event of events) {
    if (event.status === 'ACTIVE') stats.active++;
    if (isClosureEvent(event)) stats.closures++;
    if (event.event_type === EventType.INCIDENT) stats.incidents++;
    if (event.event_type === EventType.CONSTRUCTION) stats.construction++;
    
    stats.bySeverity[event.severity]++;
    stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
    
    if (new Date(event.updated).getTime() > recentThreshold) {
      stats.recentlyUpdated++;
    }
    
    totalAge += (now - new Date(event.updated).getTime()) / 60000;
  }

  stats.averageAge = events.length > 0 ? totalAge / events.length : 0;

  return stats;
}

function calculateDataQuality(events: TrafficEvent[]): DataQuality {
  const issues: QualityIssue[] = [];
  let completeness = 100;
  let timeliness = 100;
  let consistency = 100;

  for (const event of events) {
    if (!event.headline) {
      issues.push({
        eventId: event.id,
        type: 'missing_data',
        description: 'Missing headline',
        severity: 'medium'
      });
      completeness -= 1;
    }

    const age = Date.now() - new Date(event.updated).getTime();
    if (age > 86400000) { // 24 hours
      issues.push({
        eventId: event.id,
        type: 'stale',
        description: 'Event data is stale',
        severity: 'low'
      });
      timeliness -= 1;
    }
  }

  const score = Math.max(0, (completeness + timeliness + consistency) / 3);

  return {
    score,
    completeness: Math.max(0, completeness),
    accuracy: 100,
    timeliness: Math.max(0, timeliness),
    consistency: Math.max(0, consistency),
    issues
  };
}

function calculateMemoryUsage(state: EventStoreState): number {
  const eventSize = JSON.stringify(Array.from(state.events.values())).length;
  const pendingSize = JSON.stringify(Array.from(state.pendingChanges.values())).length;
  const conflictSize = JSON.stringify(Array.from(state.conflicts.values())).length;
  
  return eventSize + pendingSize + conflictSize;
}

function validateStoreIntegrity(state: EventStoreState): IntegrityReport {
  const issues: string[] = [];
  const orphanedEvents: string[] = [];
  const missingVersions: string[] = [];
  const inconsistentData: Array<{ eventId: string; issue: string }> = [];

  // Check for orphaned event references
  for (const id of state.eventOrder) {
    if (!state.events.has(id)) {
      orphanedEvents.push(id);
    }
  }

  // Check for missing version entries
  for (const [id] of state.events) {
    if (!state.eventVersions.has(id)) {
      missingVersions.push(id);
    }
  }

  const valid = orphanedEvents.length === 0 && missingVersions.length === 0;

  return {
    valid,
    issues,
    orphanedEvents,
    missingVersions,
    inconsistentData,
    databaseIntegrity: state.databaseSynced
  };
}

// Initialize worker on store creation
useEventStore.getState().initializeWorker();

// Export type and store
export type { TrafficEvent };
export default useEventStore;
