/**
 * Differential Update System Test
 * Tests the core differential sync functionality
 */

import { trafficAPI } from '../services/api/trafficApi';
import { differentialSync } from '../services/sync/DifferentialSync';
import { cacheManager } from '../services/cache/CacheManager';
import { useEventStore } from '../stores/eventStore';
import { EventType, EventSeverity } from '../types/api.types';

// Test Configuration
const TEST_API_KEY = 'your_test_api_key_here';

async function testDifferentialUpdates() {
  console.log('🧪 Starting Differential Update Test...\n');

  try {
    // 1. Initialize API with key
    trafficAPI.setApiKey(TEST_API_KEY);
    const eventStore = useEventStore.getState();
    
    console.log('📥 Step 1: Initial Full Sync');
    const initialEvents = await trafficAPI.fetchGeofencedEvents({
      api_key: TEST_API_KEY,
      limit: 50
    });
    
    console.log(`✅ Fetched ${initialEvents.length} initial events`);
    eventStore.setEvents(initialEvents);
    
    // 2. Simulate time passing and get differential
    console.log('\n⏱️  Step 2: Waiting 5 seconds before differential sync...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🔄 Step 3: Fetching Differential Updates');
    const syncState = trafficAPI.getSyncState();
    console.log(`Current sync state:`, {
      lastSync: syncState.lastSyncTimestamp,
      eventCount: syncState.totalEvents
    });
    
    const differential = await trafficAPI.fetchDifferentialUpdates({
      api_key: TEST_API_KEY,
      since: syncState.lastSyncTimestamp
    });
    
    console.log('\n📊 Differential Results:');
    console.log(`- Has Changes: ${differential.hasChanges}`);
    console.log(`- Added: ${differential.added.length} events`);
    console.log(`- Updated: ${differential.updated.length} events`);
    console.log(`- Deleted: ${differential.deleted.length} events`);
    console.log(`- Total Changes: ${differential.metadata.totalChanges}`);
    
    // 3. Apply differential to store
    if (differential.hasChanges) {
      console.log('\n🔧 Step 4: Applying Differential to Store');
      const syncResult = eventStore.applyDifferential(differential);
      
      console.log('Sync Result:');
      console.log(`- Success: ${syncResult.success}`);
      console.log(`- Applied: ${syncResult.applied.length} operations`);
      console.log(`- Conflicts: ${syncResult.conflicts.length}`);
      console.log(`- Failed: ${syncResult.failed.length}`);
      
      // Show statistics
      console.log('\n📈 Statistics:');
      const stats = eventStore.statistics;
      console.log(`- Total Events: ${stats.total}`);
      console.log(`- Active Events: ${stats.active}`);
      console.log(`- Closures: ${stats.closures}`);
      console.log(`- Average Age: ${stats.averageAge} minutes`);
    }
    
    // 4. Test cache differential
    console.log('\n💾 Step 5: Testing Cache Differential');
    await cacheManager.set('events-v1', initialEvents, 60000);
    await cacheManager.set('events-v2', eventStore.getAllEvents(), 60000);
    
    const cacheDiff = await cacheManager.getDifferential(
      'events-v1',
      'events-v2'
    );
    
    if (cacheDiff) {
      console.log('Cache Differential:');
      console.log(`- Added: ${cacheDiff.added.length}`);
      console.log(`- Updated: ${cacheDiff.updated.length}`);
      console.log(`- Deleted: ${cacheDiff.deleted.length}`);
    }
    
    // 5. Test conflict resolution
    console.log('\n⚔️  Step 6: Testing Conflict Resolution');
    
    // Simulate local change
    const testEvent = initialEvents[0];
    if (testEvent) {
      eventStore.trackLocalChange(testEvent.id, {
        headline: 'LOCAL MODIFICATION TEST',
        severity: EventSeverity.MAJOR
      });
      
      console.log(`Tracked local change for event: ${testEvent.id}`);
      
      // Apply differential again to trigger conflict
      const conflictDiff = await trafficAPI.fetchDifferentialUpdates({
        api_key: TEST_API_KEY
      });
      
      const conflictResult = eventStore.applyDifferential(conflictDiff);
      console.log(`Conflicts detected: ${conflictResult.conflicts.length}`);
      
      if (conflictResult.conflicts.length > 0) {
        console.log('Conflict details:', conflictResult.conflicts[0]);
      }
    }
    
    // 6. Performance metrics
    console.log('\n⚡ Performance Metrics:');
    const apiStats = trafficAPI.getStatistics();
    console.log(`- Cache Hit Rate: ${(apiStats.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`- Rate Limit Remaining: ${apiStats.rateLimitRemaining}/60`);
    console.log(`- Total Events in Store: ${apiStats.totalEvents}`);
    
    const cacheStats = cacheManager.getStats();
    console.log(`- Cache Size: ${cacheStats.size} entries`);
    console.log(`- Memory Usage: ${(cacheStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Differential Cache: ${cacheStats.differentialCount} entries`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDifferentialUpdates()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { testDifferentialUpdates };
