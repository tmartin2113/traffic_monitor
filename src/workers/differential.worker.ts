/**
 * Web Worker for Differential Sync Processing
 * Offloads heavy computation from main thread
 */

import * as Comlink from 'comlink';
import { DifferentialSync, SyncResult } from '@services/sync/DifferentialSync';
import { DifferentialResponse } from '@services/api/trafficApi';
import { db } from '@db/TrafficDatabase';

class DifferentialWorker {
  private differentialSync: DifferentialSync;

  constructor() {
    // Initialize sync engine
    this.differentialSync = new DifferentialSync(
      {} as any, // Event store will be proxied
      {
        conflictStrategy: 'merge',
        enableOptimisticUpdates: true,
        maxRetries: 3,
        batchSize: 50,
        validateIntegrity: true
      }
    );
  }

  /**
   * Apply differential in worker thread
   */
  async applyDifferential(
    differential: DifferentialResponse,
    currentEvents: Map<string, any>
  ): Promise<SyncResult> {
    console.log('[Worker] Processing differential with', differential.metadata.totalChanges, 'changes');
    
    // Apply to IndexedDB
    await db.applyDifferential(
      differential.added,
      differential.updated,
      differential.deleted
    );

    // Process sync
    const result = await this.differentialSync.applyDifferential(differential, {
      atomic: true,
      validateFirst: true
    });

    console.log('[Worker] Differential applied:', result.statistics);
    
    return result;
  }

  /**
   * Calculate differential between two datasets
   */
  async calculateDifferential(
    oldEvents: any[],
    newEvents: any[]
  ): Promise<DifferentialResponse> {
    const oldMap = new Map(oldEvents.map(e => [e.id, e]));
    const newMap = new Map(newEvents.map(e => [e.id, e]));
    
    const added: any[] = [];
    const updated: any[] = [];
    const deleted: string[] = [];

    // Find additions and updates
    for (const [id, newEvent] of newMap) {
      const oldEvent = oldMap.get(id);
      if (!oldEvent) {
        added.push(newEvent);
      } else if (this.hasChanged(oldEvent, newEvent)) {
        updated.push(newEvent);
      }
    }

    // Find deletions
    for (const [id] of oldMap) {
      if (!newMap.has(id)) {
        deleted.push(id);
      }
    }

    return {
      hasChanges: added.length + updated.length + deleted.length > 0,
      added,
      updated,
      deleted,
      timestamp: new Date().toISOString(),
      metadata: {
        totalChanges: added.length + updated.length + deleted.length,
        syncVersion: '1.0',
        compressed: false,
        toTimestamp: new Date().toISOString()
      }
    };
  }

  private hasChanged(oldEvent: any, newEvent: any): boolean {
    return oldEvent.updated !== newEvent.updated ||
           oldEvent.version !== newEvent.version;
  }

  /**
   * Cleanup and optimize
   */
  async optimize(): Promise<void> {
    // Cleanup old diffs
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    await db.eventDiffs
      .where('timestamp')
      .below(cutoff)
      .delete();
  }
}

// Expose worker API via Comlink
Comlink.expose(new DifferentialWorker());
