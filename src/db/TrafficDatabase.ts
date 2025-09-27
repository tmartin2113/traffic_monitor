/**
 * IndexedDB Database Schema using Dexie
 * Provides offline storage and efficient querying
 */

import Dexie, { Table } from 'dexie';
import { TrafficEvent, EventSeverity, EventType } from '@types/api.types';
import { EventDiff } from '@services/sync/DifferentialSync';

export interface StoredEvent extends TrafficEvent {
  _localModified?: boolean;
  _syncVersion?: number;
  _lastSynced?: string;
}

export interface SyncState {
  id: string;
  lastSyncTimestamp: string;
  eventCount: number;
  syncVersion: string;
}

export interface PendingChange {
  id: string;
  eventId: string;
  changes: Partial<TrafficEvent>;
  timestamp: number;
  synced: boolean;
}

export class TrafficDatabase extends Dexie {
  events!: Table<StoredEvent>;
  syncState!: Table<SyncState>;
  pendingChanges!: Table<PendingChange>;
  eventDiffs!: Table<EventDiff>;

  constructor() {
    super('TrafficDB');
    
    this.version(1).stores({
      // Indexes for efficient querying
      events: `
        id,
        severity,
        event_type,
        status,
        updated,
        created,
        [severity+status],
        [event_type+status],
        [severity+updated]
      `,
      syncState: 'id',
      pendingChanges: 'id, eventId, timestamp, synced',
      eventDiffs: 'id, timestamp, type'
    });
  }

  /**
   * Bulk update events with differential
   */
  async applyDifferential(
    added: TrafficEvent[],
    updated: TrafficEvent[],
    deleted: string[]
  ): Promise<void> {
    await this.transaction('rw', this.events, async () => {
      // Delete removed events
      if (deleted.length > 0) {
        await this.events.bulkDelete(deleted);
      }

      // Add new events
      if (added.length > 0) {
        await this.events.bulkPut(added.map(e => ({
          ...e,
          _lastSynced: new Date().toISOString()
        })));
      }

      // Update existing events
      if (updated.length > 0) {
        await this.events.bulkPut(updated.map(e => ({
          ...e,
          _lastSynced: new Date().toISOString()
        })));
      }
    });
  }

  /**
   * Query events with filters
   */
  async queryEvents(filters: {
    severity?: EventSeverity;
    eventType?: EventType;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<StoredEvent[]> {
    let collection = this.events.toCollection();

    if (filters.severity && filters.status) {
      collection = this.events
        .where('[severity+status]')
        .equals([filters.severity, filters.status]);
    } else if (filters.severity) {
      collection = this.events.where('severity').equals(filters.severity);
    } else if (filters.eventType) {
      collection = this.events.where('event_type').equals(filters.eventType);
    }

    if (filters.offset) {
      collection = collection.offset(filters.offset);
    }

    if (filters.limit) {
      collection = collection.limit(filters.limit);
    }

    return collection.toArray();
  }

  /**
   * Get events updated after timestamp
   */
  async getEventsUpdatedAfter(timestamp: string): Promise<StoredEvent[]> {
    return this.events
      .where('updated')
      .above(timestamp)
      .toArray();
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', 
      this.events, 
      this.syncState, 
      this.pendingChanges,
      this.eventDiffs,
      async () => {
        await this.events.clear();
        await this.syncState.clear();
        await this.pendingChanges.clear();
        await this.eventDiffs.clear();
      }
    );
  }
}

export const db = new TrafficDatabase();
