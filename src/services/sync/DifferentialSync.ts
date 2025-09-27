/**
 * Differential Synchronization Engine
 * Manages incremental updates, conflict resolution, and state synchronization
 * 
 * @module services/sync/DifferentialSync
 * @version 2.0.0
 */

import { 
  TrafficEvent, 
  EventType, 
  EventSeverity,
  RoadState 
} from '@types/api.types';
import { DifferentialResponse, EventVersion, SyncState } from '@services/api/trafficApi';
import { cacheManager } from '@services/cache/CacheManager';
import { EventStore } from '@stores/eventStore';

// ============================================================================
// Type Definitions
// ============================================================================

export interface EventDiff {
  id: string;
  timestamp: number;
  changes: Partial<TrafficEvent>;
  type: 'local' | 'remote';
  conflictStrategy?: ConflictStrategy;
  metadata?: {
    source: string;
    userId?: string;
    deviceId?: string;
    sessionId: string;
  };
}

export type ConflictStrategy = 
  | 'local-wins' 
  | 'remote-wins' 
  | 'merge' 
  | 'prompt-user'
  | 'custom';

export interface ConflictResolutionResult {
  resolved: boolean;
  event?: TrafficEvent;
  strategy: ConflictStrategy;
  conflicts: FieldConflict[];
  requiresUserIntervention: boolean;
}

export interface FieldConflict {
  field: string;
  localValue: any;
  remoteValue: any;
  resolution: 'local' | 'remote' | 'merged' | 'pending';
  mergedValue?: any;
}

export interface SyncResult {
  success: boolean;
  applied: SyncOperation[];
  conflicts: ConflictInfo[];
  failed: FailedOperation[];
  rollback: RollbackInfo | null;
  statistics: SyncStatistics;
}

export interface SyncOperation {
  type: 'add' | 'update' | 'delete';
  id: string;
  timestamp: number;
  version?: string;
}

export interface ConflictInfo {
  id: string;
  reason: string;
  localChanges: Partial<TrafficEvent>;
  remoteChanges: Partial<TrafficEvent>;
  resolution?: ConflictResolutionResult;
}

export interface FailedOperation {
  id: string;
  operation: 'add' | 'update' | 'delete';
  error: Error;
  retryable: boolean;
}

export interface RollbackInfo {
  triggered: boolean;
  reason: string;
  restoredState: TrafficEvent[];
  timestamp: number;
}

export interface SyncStatistics {
  totalProcessed: number;
  successCount: number;
  conflictCount: number;
  failureCount: number;
  processingTimeMs: number;
  dataSizeBytes: number;
}

export interface DifferentialSyncOptions {
  conflictStrategy?: ConflictStrategy;
  enableOptimisticUpdates?: boolean;
  maxRetries?: number;
  batchSize?: number;
  validateIntegrity?: boolean;
  persistPendingChanges?: boolean;
  mergeableFields?: string[];
  customResolver?: ConflictResolver;
  onConflict?: (conflict: ConflictInfo) => Promise<ConflictStrategy>;
  onProgress?: (progress: SyncProgress) => void;
}

export interface SyncProgress {
  phase: 'preparing' | 'deleting' | 'adding' | 'updating' | 'resolving' | 'finalizing';
  current: number;
  total: number;
  percentage: number;
}

export interface MergeStrategy {
  fields: string[];
  resolver: (local: any, remote: any) => any;
}

// ============================================================================
// Conflict Resolver Class
// ============================================================================

export class ConflictResolver {
  private mergeStrategies: Map<string, MergeStrategy>;
  private resolutionHistory: Map<string, ConflictResolutionResult>;

  constructor(
    private defaultStrategy: ConflictStrategy = 'remote-wins',
    private mergeableFields: string[] = []
  ) {
    this.mergeStrategies = new Map();
    this.resolutionHistory = new Map();
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default merge strategies for common fields
   */
  private initializeDefaultStrategies(): void {
    // Merge arrays by union
    this.addMergeStrategy(['roads', 'areas', 'event_subtypes'], (local, remote) => {
      if (Array.isArray(local) && Array.isArray(remote)) {
        return [...new Set([...local, ...remote])];
      }
      return remote;
    });

    // Take most severe severity
    this.addMergeStrategy(['severity'], (local, remote) => {
      const severityOrder: EventSeverity[] = [
        EventSeverity.MINOR,
        EventSeverity.MODERATE,
        EventSeverity.MAJOR,
        EventSeverity.SEVERE
      ];
      const localIndex = severityOrder.indexOf(local);
      const remoteIndex = severityOrder.indexOf(remote);
      return localIndex > remoteIndex ? local : remote;
    });

    // Take most recent timestamp
    this.addMergeStrategy(['updated', 'created'], (local, remote) => {
      const localTime = new Date(local).getTime();
      const remoteTime = new Date(remote).getTime();
      return localTime > remoteTime ? local : remote;
    });

    // Concatenate descriptions
    this.addMergeStrategy(['description'], (local, remote) => {
      if (local === remote) return local;
      if (!local) return remote;
      if (!remote) return local;
      return `${local}\n\n[Updated]: ${remote}`;
    });
  }

  /**
   * Add a custom merge strategy for specific fields
   */
  addMergeStrategy(fields: string[], resolver: (local: any, remote: any) => any): void {
    for (const field of fields) {
      this.mergeStrategies.set(field, { fields: [field], resolver });
    }
  }

  /**
   * Resolve conflicts between local and remote events
   */
  async resolve(
    local: TrafficEvent,
    remote: TrafficEvent,
    localDiff?: EventDiff,
    options: { strategy?: ConflictStrategy; interactive?: boolean } = {}
  ): Promise<ConflictResolutionResult> {
    const strategy = options.strategy || this.defaultStrategy;
    const conflicts: FieldConflict[] = [];
    let resolved = true;
    let requiresUserIntervention = false;

    // Check cache for previous resolution
    const cacheKey = `${local.id}-${local.updated}-${remote.updated}`;
    const cachedResolution = this.resolutionHistory.get(cacheKey);
    if (cachedResolution) {
      return cachedResolution;
    }

    // Detect field-level conflicts
    const fieldConflicts = this.detectFieldConflicts(local, remote, localDiff);

    // Apply resolution strategy
    let resolvedEvent: TrafficEvent;

    switch (strategy) {
      case 'local-wins':
        resolvedEvent = { ...remote, ...local };
        fieldConflicts.forEach(fc => {
          fc.resolution = 'local';
          conflicts.push(fc);
        });
        break;

      case 'remote-wins':
        resolvedEvent = { ...local, ...remote };
        fieldConflicts.forEach(fc => {
          fc.resolution = 'remote';
          conflicts.push(fc);
        });
        break;

      case 'merge':
        resolvedEvent = await this.mergeEvents(local, remote, fieldConflicts);
        conflicts.push(...fieldConflicts);
        break;

      case 'prompt-user':
        resolvedEvent = remote; // Default to remote until user decides
        requiresUserIntervention = true;
        resolved = false;
        fieldConflicts.forEach(fc => {
          fc.resolution = 'pending';
          conflicts.push(fc);
        });
        break;

      case 'custom':
        if (this.customResolver) {
          resolvedEvent = await this.customResolver(local, remote, localDiff);
        } else {
          resolvedEvent = remote;
        }
        break;

      default:
        resolvedEvent = remote;
    }

    const result: ConflictResolutionResult = {
      resolved,
      event: resolvedEvent,
      strategy,
      conflicts,
      requiresUserIntervention
    };

    // Cache the resolution
    this.resolutionHistory.set(cacheKey, result);

    return result;
  }

  /**
   * Detect field-level conflicts between events
   */
  private detectFieldConflicts(
    local: TrafficEvent,
    remote: TrafficEvent,
    localDiff?: EventDiff
  ): FieldConflict[] {
    const conflicts: FieldConflict[] = [];
    const checkedFields = new Set<string>();

    // Check fields that were locally modified
    if (localDiff?.changes) {
      for (const [field, localValue] of Object.entries(localDiff.changes)) {
        const remoteValue = (remote as any)[field];
        if (!this.areValuesEqual(localValue, remoteValue)) {
          conflicts.push({
            field,
            localValue,
            remoteValue,
            resolution: 'pending'
          });
        }
        checkedFields.add(field);
      }
    }

    // Check all other fields for conflicts
    const allFields = new Set([
      ...Object.keys(local),
      ...Object.keys(remote)
    ]);

    for (const field of allFields) {
      if (checkedFields.has(field)) continue;

      const localValue = (local as any)[field];
      const remoteValue = (remote as any)[field];

      if (!this.areValuesEqual(localValue, remoteValue)) {
        conflicts.push({
          field,
          localValue,
          remoteValue,
          resolution: 'pending'
        });
      }
    }

    return conflicts;
  }

  /**
   * Merge two events field by field
   */
  private async mergeEvents(
    local: TrafficEvent,
    remote: TrafficEvent,
    conflicts: FieldConflict[]
  ): Promise<TrafficEvent> {
    const merged = { ...remote };

    for (const conflict of conflicts) {
      const strategy = this.mergeStrategies.get(conflict.field);

      if (strategy) {
        // Use custom merge strategy
        const mergedValue = strategy.resolver(conflict.localValue, conflict.remoteValue);
        (merged as any)[conflict.field] = mergedValue;
        conflict.resolution = 'merged';
        conflict.mergedValue = mergedValue;
      } else if (this.mergeableFields.includes(conflict.field)) {
        // Simple merge - concatenate or combine
        const mergedValue = this.simpleFieldMerge(
          conflict.field,
          conflict.localValue,
          conflict.remoteValue
        );
        (merged as any)[conflict.field] = mergedValue;
        conflict.resolution = 'merged';
        conflict.mergedValue = mergedValue;
      } else {
        // Default to remote value
        conflict.resolution = 'remote';
      }
    }

    return merged;
  }

  /**
   * Simple field merge for common types
   */
  private simpleFieldMerge(field: string, local: any, remote: any): any {
    // Handle null/undefined
    if (local == null) return remote;
    if (remote == null) return local;
    if (local === remote) return local;

    // Arrays - union
    if (Array.isArray(local) && Array.isArray(remote)) {
      return [...new Set([...local, ...remote])];
    }

    // Objects - deep merge
    if (typeof local === 'object' && typeof remote === 'object') {
      return { ...local, ...remote };
    }

    // Strings - concatenate if descriptions/notes
    if (typeof local === 'string' && typeof remote === 'string') {
      if (field.includes('description') || field.includes('note')) {
        return `${local}\n${remote}`;
      }
    }

    // Numbers - take maximum for counts/limits
    if (typeof local === 'number' && typeof remote === 'number') {
      if (field.includes('count') || field.includes('limit')) {
        return Math.max(local, remote);
      }
    }

    // Default to remote
    return remote;
  }

  /**
   * Check if two values are equal
   */
  private areValuesEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    
    return false;
  }

  private customResolver?: (
    local: TrafficEvent,
    remote: TrafficEvent,
    diff?: EventDiff
  ) => Promise<TrafficEvent>;
}

// ============================================================================
// Main Differential Sync Class
// ============================================================================

export class DifferentialSync {
  private pendingChanges: Map<string, EventDiff> = new Map();
  private syncInProgress: boolean = false;
  private syncQueue: DifferentialResponse[] = [];
  private conflictResolver: ConflictResolver;
  private transactionLog: SyncOperation[] = [];
  private backupState: Map<string, TrafficEvent> | null = null;
  private syncId: string;
  private retryMap: Map<string, number> = new Map();

  constructor(
    private eventStore: EventStore,
    private options: DifferentialSyncOptions = {}
  ) {
    this.conflictResolver = new ConflictResolver(
      options.conflictStrategy || 'remote-wins',
      options.mergeableFields || []
    );

    if (options.customResolver) {
      this.conflictResolver['customResolver'] = options.customResolver;
    }

    this.syncId = this.generateSyncId();
    
    if (options.persistPendingChanges) {
      this.loadPendingChanges();
    }
  }

  /**
   * Apply differential updates to local state
   */
  async applyDifferential(
    diff: DifferentialResponse,
    options: { atomic?: boolean; validateFirst?: boolean } = {}
  ): Promise<SyncResult> {
    // Queue if sync already in progress
    if (this.syncInProgress) {
      return this.queueDifferential(diff);
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    const result: SyncResult = this.initializeSyncResult();

    try {
      // Validate differential if requested
      if (options.validateFirst || this.options.validateIntegrity) {
        const isValid = await this.validateDifferential(diff);
        if (!isValid) {
          throw new Error('Differential validation failed');
        }
      }

      // Create backup for potential rollback
      if (options.atomic) {
        this.backupState = this.createStateBackup();
      }

      // Start transaction logging
      this.transactionLog = [];

      // Phase 1: Process deletions
      await this.processDeletions(diff.deleted, result);
      this.reportProgress('deleting', diff.deleted.length, diff.deleted.length);

      // Phase 2: Process additions
      await this.processAdditions(diff.added, result);
      this.reportProgress('adding', diff.added.length, diff.added.length);

      // Phase 3: Process updates with conflict resolution
      await this.processUpdates(diff.updated, result);
      this.reportProgress('updating', diff.updated.length, diff.updated.length);

      // Phase 4: Resolve remaining conflicts
      if (result.conflicts.length > 0) {
        await this.resolveRemainingConflicts(result);
      }

      // Phase 5: Finalize and persist
      await this.finalizeSynchronization(diff, result);

      // Calculate statistics
      result.statistics = {
        totalProcessed: diff.added.length + diff.updated.length + diff.deleted.length,
        successCount: result.applied.length,
        conflictCount: result.conflicts.length,
        failureCount: result.failed.length,
        processingTimeMs: Date.now() - startTime,
        dataSizeBytes: this.calculateDataSize(diff)
      };

      // Clear backup if successful
      this.backupState = null;

    } catch (error) {
      // Rollback if atomic mode and error occurred
      if (options.atomic && this.backupState) {
        result.rollback = await this.performRollback(error as Error);
      }

      result.success = false;
      result.failed.push({
        id: 'sync-operation',
        operation: 'update',
        error: error as Error,
        retryable: true
      });

    } finally {
      this.syncInProgress = false;
      
      // Process queued differentials
      if (this.syncQueue.length > 0) {
        const nextDiff = this.syncQueue.shift()!;
        setTimeout(() => this.applyDifferential(nextDiff), 0);
      }
    }

    return result;
  }

  /**
   * Process deletion operations
   */
  private async processDeletions(
    deletedIds: string[],
    result: SyncResult
  ): Promise<void> {
    const batchSize = this.options.batchSize || 50;
    
    for (let i = 0; i < deletedIds.length; i += batchSize) {
      const batch = deletedIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (id) => {
        try {
          const success = await this.eventStore.removeEvent(id);
          
          if (success) {
            const operation: SyncOperation = {
              type: 'delete',
              id,
              timestamp: Date.now()
            };
            
            result.applied.push(operation);
            this.transactionLog.push(operation);
            
            // Remove from pending changes
            this.pendingChanges.delete(id);
          } else {
            throw new Error('Failed to delete event');
          }
        } catch (error) {
          result.failed.push({
            id,
            operation: 'delete',
            error: error as Error,
            retryable: true
          });
        }
      }));
      
      this.reportProgress('deleting', i + batch.length, deletedIds.length);
    }
  }

  /**
   * Process addition operations
   */
  private async processAdditions(
    addedEvents: TrafficEvent[],
    result: SyncResult
  ): Promise<void> {
    const batchSize = this.options.batchSize || 50;
    
    for (let i = 0; i < addedEvents.length; i += batchSize) {
      const batch = addedEvents.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (event) => {
        try {
          // Check for local pending changes (rare for new events)
          if (this.pendingChanges.has(event.id)) {
            const localDiff = this.pendingChanges.get(event.id)!;
            const merged = { ...event, ...localDiff.changes };
            await this.eventStore.addEvent(merged);
          } else {
            await this.eventStore.addEvent(event);
          }
          
          const operation: SyncOperation = {
            type: 'add',
            id: event.id,
            timestamp: Date.now(),
            version: this.getEventVersion(event)
          };
          
          result.applied.push(operation);
          this.transactionLog.push(operation);
          
        } catch (error) {
          result.failed.push({
            id: event.id,
            operation: 'add',
            error: error as Error,
            retryable: true
          });
        }
      }));
      
      this.reportProgress('adding', i + batch.length, addedEvents.length);
    }
  }

  /**
   * Process update operations with conflict resolution
   */
  private async processUpdates(
    updatedEvents: TrafficEvent[],
    result: SyncResult
  ): Promise<void> {
    const batchSize = this.options.batchSize || 25;
    
    for (let i = 0; i < updatedEvents.length; i += batchSize) {
      const batch = updatedEvents.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (remoteEvent) => {
        try {
          const localEvent = this.eventStore.getEvent(remoteEvent.id);
          
          if (!localEvent) {
            // Event doesn't exist locally, add it
            await this.eventStore.addEvent(remoteEvent);
            result.applied.push({
              type: 'add',
              id: remoteEvent.id,
              timestamp: Date.now()
            });
            return;
          }
          
          // Check for local modifications
          const localDiff = this.pendingChanges.get(remoteEvent.id);
          
          if (localDiff && this.hasLocalChanges(localEvent, remoteEvent)) {
            // Conflict detected - resolve it
            const resolution = await this.resolveConflict(
              localEvent,
              remoteEvent,
              localDiff,
              result
            );
            
            if (resolution.resolved && resolution.event) {
              await this.eventStore.updateEvent(resolution.event);
              
              const operation: SyncOperation = {
                type: 'update',
                id: remoteEvent.id,
                timestamp: Date.now(),
                version: this.getEventVersion(resolution.event)
              };
              
              result.applied.push(operation);
              this.transactionLog.push(operation);
            } else {
              result.conflicts.push({
                id: remoteEvent.id,
                reason: 'unresolved-conflict',
                localChanges: localDiff.changes,
                remoteChanges: this.extractChanges(localEvent, remoteEvent),
                resolution
              });
            }
          } else {
            // No conflict, apply remote update
            await this.eventStore.updateEvent(remoteEvent);
            
            const operation: SyncOperation = {
              type: 'update',
              id: remoteEvent.id,
              timestamp: Date.now(),
              version: this.getEventVersion(remoteEvent)
            };
            
            result.applied.push(operation);
            this.transactionLog.push(operation);
          }
          
          // Clear pending changes after successful update
          this.pendingChanges.delete(remoteEvent.id);
          
        } catch (error) {
          const retryCount = this.retryMap.get(remoteEvent.id) || 0;
          
          if (retryCount < (this.options.maxRetries || 3)) {
            this.retryMap.set(remoteEvent.id, retryCount + 1);
            result.failed.push({
              id: remoteEvent.id,
              operation: 'update',
              error: error as Error,
              retryable: true
            });
          } else {
            result.failed.push({
              id: remoteEvent.id,
              operation: 'update',
              error: error as Error,
              retryable: false
            });
          }
        }
      }));
      
      this.reportProgress('updating', i + batch.length, updatedEvents.length);
    }
  }

  /**
   * Resolve a conflict between local and remote events
   */
  private async resolveConflict(
    local: TrafficEvent,
    remote: TrafficEvent,
    localDiff: EventDiff,
    result: SyncResult
  ): Promise<ConflictResolutionResult> {
    // Use custom conflict handler if provided
    if (this.options.onConflict) {
      const conflictInfo: ConflictInfo = {
        id: local.id,
        reason: 'concurrent-modification',
        localChanges: localDiff.changes,
        remoteChanges: this.extractChanges(local, remote)
      };
      
      const strategy = await this.options.onConflict(conflictInfo);
      return this.conflictResolver.resolve(local, remote, localDiff, { strategy });
    }
    
    // Use default conflict resolver
    return this.conflictResolver.resolve(local, remote, localDiff);
  }

  /**
   * Track local changes for conflict detection
   */
  trackLocalChange(eventId: string, changes: Partial<TrafficEvent>): void {
    const diff: EventDiff = {
      id: eventId,
      timestamp: Date.now(),
      changes,
      type: 'local',
      metadata: {
        source: 'user-edit',
        sessionId: this.syncId
      }
    };
    
    this.pendingChanges.set(eventId, diff);
    
    if (this.options.persistPendingChanges) {
      this.savePendingChanges();
    }
  }

  /**
   * Queue differential for later processing
   */
  private async queueDifferential(diff: DifferentialResponse): Promise<SyncResult> {
    this.syncQueue.push(diff);
    
    return {
      success: false,
      applied: [],
      conflicts: [],
      failed: [{
        id: 'sync-queued',
        operation: 'update',
        error: new Error('Sync queued for later processing'),
        retryable: true
      }],
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
  }

  /**
   * Resolve remaining conflicts after main processing
   */
  private async resolveRemainingConflicts(result: SyncResult): Promise<void> {
    if (!this.options.onConflict) return;
    
    for (const conflict of result.conflicts) {
      if (conflict.resolution?.requiresUserIntervention) {
        // Will be handled by UI
        continue;
      }
      
      try {
        const strategy = await this.options.onConflict(conflict);
        const localEvent = this.eventStore.getEvent(conflict.id);
        
        if (localEvent && conflict.resolution?.event) {
          const resolved = await this.conflictResolver.resolve(
            localEvent,
            conflict.resolution.event,
            undefined,
            { strategy }
          );
          
          if (resolved.resolved && resolved.event) {
            await this.eventStore.updateEvent(resolved.event);
            conflict.resolution = resolved;
          }
        }
      } catch (error) {
        console.error(`Failed to resolve conflict for ${conflict.id}:`, error);
      }
    }
  }

  /**
   * Finalize synchronization and cleanup
   */
  private async finalizeSynchronization(
    diff: DifferentialResponse,
    result: SyncResult
  ): Promise<void> {
    // Update sync timestamp
    await this.eventStore.updateSyncTimestamp(diff.timestamp);
    
    // Clear processed pending changes
    for (const operation of result.applied) {
      this.pendingChanges.delete(operation.id);
    }
    
    // Save remaining pending changes
    if (this.options.persistPendingChanges) {
      this.savePendingChanges();
    }
    
    // Clear retry map for successful operations
    for (const operation of result.applied) {
      this.retryMap.delete(operation.id);
    }
    
    // Report completion
    this.reportProgress('finalizing', 1, 1);
    
    result.success = result.failed.length === 0;
  }

  /**
   * Perform rollback to previous state
   */
  private async performRollback(error: Error): Promise<RollbackInfo> {
    if (!this.backupState) {
      return {
        triggered: false,
        reason: 'No backup available',
        restoredState: [],
        timestamp: Date.now()
      };
    }
    
    const events = Array.from(this.backupState.values());
    await this.eventStore.replaceAllEvents(events);
    
    return {
      triggered: true,
      reason: error.message,
      restoredState: events,
      timestamp: Date.now()
    };
  }

  /**
   * Create a backup of current state
   */
  private createStateBackup(): Map<string, TrafficEvent> {
    const events = this.eventStore.getAllEvents();
    return new Map(events.map(e => [e.id, { ...e }]));
  }

  /**
   * Check if event has local changes
   */
  private hasLocalChanges(local: TrafficEvent, remote: TrafficEvent): boolean {
    return local.updated !== remote.updated ||
           JSON.stringify(local) !== JSON.stringify(remote);
  }

  /**
   * Extract changes between two events
   */
  private extractChanges(
    oldEvent: TrafficEvent,
    newEvent: TrafficEvent
  ): Partial<TrafficEvent> {
    const changes: Partial<TrafficEvent> = {};
    
    for (const key of Object.keys(newEvent) as Array<keyof TrafficEvent>) {
      if (JSON.stringify(oldEvent[key]) !== JSON.stringify(newEvent[key])) {
        (changes as any)[key] = newEvent[key];
      }
    }
    
    return changes;
  }

  /**
   * Validate differential integrity
   */
  private async validateDifferential(diff: DifferentialResponse): Promise<boolean> {
    // Check for required fields
    if (!diff.timestamp || !diff.metadata) {
      return false;
    }
    
    // Validate event IDs are unique
    const allIds = new Set<string>();
    for (const event of [...diff.added, ...diff.updated]) {
      if (allIds.has(event.id)) {
        return false;
      }
      allIds.add(event.id);
    }
    
    // Validate no overlap between operations
    const deletedSet = new Set(diff.deleted);
    for (const event of [...diff.added, ...diff.updated]) {
      if (deletedSet.has(event.id)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate data size of differential
   */
  private calculateDataSize(diff: DifferentialResponse): number {
    const data = JSON.stringify(diff);
    return new Blob([data]).size;
  }

  /**
   * Report sync progress
   */
  private reportProgress(phase: SyncProgress['phase'], current: number, total: number): void {
    if (this.options.onProgress) {
      this.options.onProgress({
        phase,
        current,
        total,
        percentage: total > 0 ? (current / total) * 100 : 0
      });
    }
  }

  /**
   * Get event version string
   */
  private getEventVersion(event: TrafficEvent): string {
    return `${event.updated}-${event.status}`;
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Initialize empty sync result
   */
  private initializeSyncResult(): SyncResult {
    return {
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
  }

  /**
   * Save pending changes to localStorage
   */
  private savePendingChanges(): void {
    try {
      const changes = Array.from(this.pendingChanges.entries());
      localStorage.setItem(
        `differential-sync-pending-${this.syncId}`,
        JSON.stringify(changes)
      );
    } catch (error) {
      console.warn('Failed to save pending changes:', error);
    }
  }

  /**
   * Load pending changes from localStorage
   */
  private loadPendingChanges(): void {
    try {
      const saved = localStorage.getItem(`differential-sync-pending-${this.syncId}`);
      if (saved) {
        const changes = JSON.parse(saved) as Array<[string, EventDiff]>;
        this.pendingChanges = new Map(changes);
      }
    } catch (error) {
      console.warn('Failed to load pending changes:', error);
    }
  }

  /**
   * Get current sync state
   */
  getSyncState(): {
    syncId: string;
    pendingChanges: number;
    queuedDifferentials: number;
    syncInProgress: boolean;
    conflicts: number;
  } {
    return {
      syncId: this.syncId,
      pendingChanges: this.pendingChanges.size,
      queuedDifferentials: this.syncQueue.length,
      syncInProgress: this.syncInProgress,
      conflicts: Array.from(this.pendingChanges.values())
        .filter(diff => diff.conflictStrategy === 'prompt-user').length
    };
  }

  /**
   * Clear all pending changes
   */
  clearPendingChanges(): void {
    this.pendingChanges.clear();
    if (this.options.persistPendingChanges) {
      localStorage.removeItem(`differential-sync-pending-${this.syncId}`);
    }
  }

  /**
   * Export pending changes for debugging
   */
  exportPendingChanges(): EventDiff[] {
    return Array.from(this.pendingChanges.values());
  }
}

// Export singleton instance with default configuration
export const differentialSync = new DifferentialSync(
  {} as EventStore, // Will be injected
  {
    conflictStrategy: 'merge',
    enableOptimisticUpdates: true,
    maxRetries: 3,
    batchSize: 50,
    validateIntegrity: true,
    persistPendingChanges: true,
    mergeableFields: ['description', 'roads', 'areas']
  }
);
