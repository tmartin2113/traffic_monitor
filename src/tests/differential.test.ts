/**
 * Comprehensive Differential Update System Test
 * Tests all aspects of the differential sync with detailed error logging
 * 
 * @module tests/differential
 * @version 2.0.0
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { trafficAPI, TrafficAPIError } from '../services/api/trafficApi';
import { differentialSync, SyncResult } from '../services/sync/DifferentialSync';
import { cacheManager } from '../services/cache/CacheManager';
import { db } from '../db/TrafficDatabase';
import { useEventStore } from '../stores/eventStore';
import { rateLimiter } from '../services/rateLimit/RateLimiter';
import { EventType, EventSeverity, TrafficEvent } from '../types/api.types';

// ============================================================================
// Test Configuration
// ============================================================================

const API_KEY = process.env.VITE_511_API_KEY || process.argv[2];
const LOG_DIR = './test-logs';
const TEST_MODE = process.env.TEST_MODE || 'full'; // 'full' | 'quick' | 'differential-only'

// Create timestamped log file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE = path.join(LOG_DIR, `differential-test-${timestamp}.log`);
const ERROR_LOG_FILE = path.join(LOG_DIR, `differential-errors-${timestamp}.log`);

// Test tracking
interface TestResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  duration: number;
  details?: any;
  error?: any;
}

const testResults: TestResult[] = [];
const errorLog: any[] = [];

// ============================================================================
// Logging Utilities
// ============================================================================

class TestLogger {
  private startTime: number = 0;
  
  constructor() {
    // Create log directory
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    
    // Initialize log files
    this.initLogFile(LOG_FILE, 'DIFFERENTIAL SYNC TEST LOG');
    this.initLogFile(ERROR_LOG_FILE, 'ERROR LOG');
  }
  
  private initLogFile(file: string, title: string): void {
    const header = `
${'='.repeat(60)}
${title}
Started: ${new Date().toISOString()}
Node: ${process.version} | Platform: ${process.platform}
${'='.repeat(60)}
`;
    fs.writeFileSync(file, header);
  }
  
  startTest(name: string): void {
    this.startTime = performance.now();
    console.log(`\n🧪 ${name}`);
    this.log(LOG_FILE, `\n[TEST START] ${name}`);
  }
  
  passTest(name: string, details?: any): void {
    const duration = performance.now() - this.startTime;
    const result: TestResult = {
      name,
      status: 'PASSED',
      duration,
      details
    };
    
    testResults.push(result);
    console.log(`   ✅ PASSED (${duration.toFixed(2)}ms)`);
    
    if (details) {
      console.log(`   📊 ${JSON.stringify(details, null, 2).split('\n').join('\n      ')}`);
    }
    
    this.log(LOG_FILE, `[PASSED] ${name} - ${duration.toFixed(2)}ms`, details);
  }
  
  failTest(name: string, error: any, context?: any): void {
    const duration = performance.now() - this.startTime;
    const result: TestResult = {
      name,
      status: 'FAILED',
      duration,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    };
    
    testResults.push(result);
    errorLog.push({ test: name, error, context });
    
    console.error(`   ❌ FAILED: ${error.message}`);
    if (error.code) console.error(`      Code: ${error.code}`);
    
    this.log(LOG_FILE, `[FAILED] ${name}`, { error: error.message, context });
    this.log(ERROR_LOG_FILE, `[ERROR] ${name}`, {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        response: error.response?.data
      },
      context,
      timestamp: new Date().toISOString()
    });
  }
  
  skipTest(name: string, reason: string): void {
    testResults.push({
      name,
      status: 'SKIPPED',
      duration: 0
    });
    
    console.log(`   ⏭️  SKIPPED: ${reason}`);
    this.log(LOG_FILE, `[SKIPPED] ${name}: ${reason}`);
  }
  
  log(file: string, message: string, data?: any): void {
    let logEntry = `\n${new Date().toISOString()} - ${message}`;
    if (data) {
      logEntry += '\n' + JSON.stringify(data, null, 2);
    }
    fs.appendFileSync(file, logEntry);
  }
  
  section(title: string): void {
    const separator = '━'.repeat(50);
    console.log(`\n${separator}\n${title}\n${separator}`);
    this.log(LOG_FILE, `\n${separator}\n${title}\n${separator}`);
  }
  
  summary(): void {
    const passed = testResults.filter(r => r.status === 'PASSED').length;
    const failed = testResults.filter(r => r.status === 'FAILED').length;
    const skipped = testResults.filter(r => r.status === 'SKIPPED').length;
    const total = testResults.length;
    const successRate = total > 0 ? (passed / total * 100).toFixed(1) : '0';
    
    const summary = {
      total,
      passed,
      failed,
      skipped,
      successRate: `${successRate}%`,
      totalDuration: testResults.reduce((sum, r) => sum + r.duration, 0),
      timestamp: new Date().toISOString()
    };
    
    this.section('TEST SUMMARY');
    console.log(`
📊 Results:
   Total Tests: ${total}
   ✅ Passed: ${passed}
   ❌ Failed: ${failed}
   ⏭️  Skipped: ${skipped}
   Success Rate: ${successRate}%
   
📁 Logs:
   Main: ${LOG_FILE}
   Errors: ${ERROR_LOG_FILE}
`);
    
    this.log(LOG_FILE, 'FINAL SUMMARY', summary);
    
    if (failed > 0) {
      console.log('❌ Failed Tests:');
      testResults
        .filter(r => r.status === 'FAILED')
        .forEach(r => console.log(`   - ${r.name}: ${r.error?.message}`));
    }
    
    // Write summary JSON
    const summaryFile = path.join(LOG_DIR, `differential-summary-${timestamp}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify({
      summary,
      results: testResults,
      errors: errorLog
    }, null, 2));
    
    console.log(`\n📄 Summary saved to: ${summaryFile}`);
  }
}

// ============================================================================
// Main Test Suite
// ============================================================================

async function runDifferentialTests() {
  const logger = new TestLogger();
  
  console.log(`
╔════════════════════════════════════════════════════════╗
║     511 Traffic Monitor - Differential Sync Test      ║
║                    Mode: ${TEST_MODE.padEnd(28)}║
╚════════════════════════════════════════════════════════╝
`);

  // Validate API key
  if (!API_KEY) {
    console.error('\n❌ No API key provided!');
    console.error('Usage: npm test -- YOUR_API_KEY');
    console.error('Or set VITE_511_API_KEY in .env file\n');
    process.exit(1);
  }

  // Initialize
  trafficAPI.setApiKey(API_KEY);
  const eventStore = useEventStore.getState();
  
  try {
    // ========== Test 1: Rate Limit Check ==========
    logger.startTest('Rate Limit Check');
    try {
      const info = rateLimiter.getInfo();
      if (info.remaining < 10) {
        throw new Error(`Insufficient rate limit: ${info.remaining}/60 remaining`);
      }
      logger.passTest('Rate Limit Check', info);
    } catch (error) {
      logger.failTest('Rate Limit Check', error);
      if (TEST_MODE === 'full') return; // Stop if rate limited
    }
    
    // ========== Test 2: Initial Full Sync ==========
    logger.startTest('Initial Full Sync');
    let initialEvents: TrafficEvent[] = [];
    try {
      initialEvents = await trafficAPI.fetchGeofencedEvents({
        api_key: API_KEY,
        limit: TEST_MODE === 'quick' ? 20 : 100
      });
      
      await db.events.bulkPut(initialEvents);
      eventStore.setEvents(initialEvents);
      
      logger.passTest('Initial Full Sync', {
        eventCount: initialEvents.length,
        dbStored: await db.events.count(),
        breakdown: {
          closures: initialEvents.filter(e => e.event_type === EventType.ROAD_CLOSURE).length,
          incidents: initialEvents.filter(e => e.event_type === EventType.INCIDENT).length,
          construction: initialEvents.filter(e => e.event_type === EventType.CONSTRUCTION).length
        }
      });
    } catch (error) {
      logger.failTest('Initial Full Sync', error);
      return; // Can't continue without initial data
    }
    
    // ========== Test 3: Sync State Verification ==========
    logger.startTest('Sync State Verification');
    try {
      const syncState = trafficAPI.getSyncState();
      
      if (!syncState.lastSyncTimestamp) {
        throw new Error('Sync timestamp not set after initial sync');
      }
      
      logger.passTest('Sync State Verification', syncState);
    } catch (error) {
      logger.failTest('Sync State Verification', error);
    }
    
    // ========== Test 4: Wait and Fetch Differential ==========
    if (TEST_MODE !== 'quick') {
      logger.startTest('Differential Update Detection');
      try {
        console.log('   ⏱️  Waiting 5 seconds for potential changes...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const differential = await trafficAPI.fetchDifferentialUpdates({
          api_key: API_KEY
        });
        
        const diffStats = {
          hasChanges: differential.hasChanges,
          added: differential.added.length,
          updated: differential.updated.length,
          deleted: differential.deleted.length,
          totalChanges: differential.metadata.totalChanges,
          dataSize: JSON.stringify(differential).length,
          compression: differential.metadata.compressed
        };
        
        logger.passTest('Differential Update Detection', diffStats);
        
        // Apply differential if changes exist
        if (differential.hasChanges) {
          logger.startTest('Apply Differential to Store');
          try {
            const syncResult = await eventStore.applyDifferential(differential);
            
            logger.passTest('Apply Differential to Store', {
              success: syncResult.success,
              applied: syncResult.applied.length,
              conflicts: syncResult.conflicts.length,
              failed: syncResult.failed.length,
              processingTime: syncResult.statistics.processingTimeMs
            });
          } catch (error) {
            logger.failTest('Apply Differential to Store', error);
          }
        }
      } catch (error) {
        logger.failTest('Differential Update Detection', error);
      }
    } else {
      logger.skipTest('Differential Update Detection', 'Quick mode enabled');
    }
    
    // ========== Test 5: Cache Differential ==========
    logger.startTest('Cache Differential Computation');
    try {
      await cacheManager.set('events-v1', initialEvents, 60000);
      await cacheManager.set('events-v2', eventStore.getAllEvents(), 60000);
      
      const cacheDiff = await cacheManager.getDifferential('events-v1', 'events-v2');
      
      if (!cacheDiff) {
        throw new Error('Failed to compute cache differential');
      }
      
      logger.passTest('Cache Differential Computation', {
        added: cacheDiff.added.length,
        updated: cacheDiff.updated.length,
        deleted: cacheDiff.deleted.length,
        cacheStats: cacheManager.getStats()
      });
    } catch (error) {
      logger.failTest('Cache Differential Computation', error);
    }
    
    // ========== Test 6: Conflict Resolution ==========
    logger.startTest('Conflict Resolution');
    try {
      if (initialEvents.length > 0) {
        const testEvent = initialEvents[0];
        
        // Track local change
        eventStore.trackLocalChange(testEvent.id, {
          headline: 'LOCAL MODIFICATION TEST',
          severity: EventSeverity.MAJOR
        });
        
        // Simulate remote update
        const conflictDiff = await trafficAPI.fetchDifferentialUpdates({
          api_key: API_KEY
        });
        
        const syncResult = await eventStore.applyDifferential(conflictDiff);
        
        logger.passTest('Conflict Resolution', {
          localChangeTracked: true,
          conflictsDetected: syncResult.conflicts.length,
          conflictDetails: syncResult.conflicts[0] || null
        });
      } else {
        logger.skipTest('Conflict Resolution', 'No events to test with');
      }
    } catch (error) {
      logger.failTest('Conflict Resolution', error);
    }
    
    // ========== Test 7: Worker Processing ==========
    if (TEST_MODE === 'full') {
      logger.startTest('Web Worker Processing');
      try {
        await eventStore.initializeWorker();
        
        if (eventStore.workerReady) {
          // Test worker differential processing
          const testDiff = {
            hasChanges: true,
            added: [],
            updated: initialEvents.slice(0, 5),
            deleted: [],
            timestamp: new Date().toISOString(),
            metadata: {
              totalChanges: 5,
              syncVersion: '1.0',
              compressed: false,
              toTimestamp: new Date().toISOString()
            }
          };
          
          const result = await eventStore.applyDifferentialInWorker(testDiff);
          
          logger.passTest('Web Worker Processing', {
            workerReady: true,
            processed: result.applied.length,
            workerTime: eventStore.performanceMetrics.workerTime
          });
        } else {
          logger.skipTest('Web Worker Processing', 'Worker not available');
        }
      } catch (error) {
        logger.failTest('Web Worker Processing', error);
      }
    }
    
    // ========== Test 8: Performance Metrics ==========
    logger.startTest('Performance Analysis');
    try {
      const apiStats = trafficAPI.getStatistics();
      const cacheStats = cacheManager.getStats();
      const storeStats = eventStore.statistics;
      
      const metrics = {
        api: {
          totalEvents: apiStats.totalEvents,
          cacheHitRate: `${(apiStats.cacheHitRate * 100).toFixed(1)}%`,
          rateLimitRemaining: apiStats.rateLimitRemaining
        },
        cache: {
          size: cacheStats.size,
          hitRate: `${(cacheStats.hitRate * 100).toFixed(1)}%`,
          memoryUsage: `${(cacheStats.memoryUsage / 1024).toFixed(1)} KB`,
          differentialCount: cacheStats.differentialCount,
          compressionRatio: cacheStats.compressionRatio.toFixed(2)
        },
        store: {
          totalEvents: storeStats.total,
          activeEvents: storeStats.active,
          averageAge: `${storeStats.averageAge.toFixed(0)} minutes`,
          dataQuality: eventStore.dataQuality.score
        },
        database: {
          eventCount: await db.events.count(),
          pendingChanges: await db.pendingChanges.count()
        }
      };
      
      logger.passTest('Performance Analysis', metrics);
    } catch (error) {
      logger.failTest('Performance Analysis', error);
    }
    
    // ========== Test 9: Database Operations ==========
    logger.startTest('Database Query Performance');
    try {
      const queryStart = performance.now();
      
      // Test various queries
      const queries = [
        { test: 'All closures', result: await db.queryEvents({ eventType: EventType.ROAD_CLOSURE }) },
        { test: 'Major severity', result: await db.queryEvents({ severity: EventSeverity.MAJOR }) },
        { test: 'Recent updates', result: await db.getEventsUpdatedAfter(
          new Date(Date.now() - 3600000).toISOString()
        )},
        { test: 'Paginated', result: await db.queryEvents({ limit: 10, offset: 0 }) }
      ];
      
      const queryTime = performance.now() - queryStart;
      
      logger.passTest('Database Query Performance', {
        totalQueries: queries.length,
        totalTime: `${queryTime.toFixed(2)}ms`,
        averageTime: `${(queryTime / queries.length).toFixed(2)}ms`,
        results: queries.map(q => ({ test: q.test, count: q.result.length }))
      });
    } catch (error) {
      logger.failTest('Database Query Performance', error);
    }
    
    // ========== Test 10: Memory Usage ==========
    logger.startTest('Memory Usage Analysis');
    try {
      const memoryUsage = eventStore.getMemoryUsage();
      const processMemory = process.memoryUsage();
      
      logger.passTest('Memory Usage Analysis', {
        store: `${(memoryUsage.total / 1024).toFixed(1)} KB`,
        heap: `${(processMemory.heapUsed / 1024 / 1024).toFixed(1)} MB`,
        rss: `${(processMemory.rss / 1024 / 1024).toFixed(1)} MB`,
        eventCount: eventStore.events.size
      });
    } catch (error) {
      logger.failTest('Memory Usage Analysis', error);
    }
    
  } catch (criticalError) {
    logger.log(ERROR_LOG_FILE, 'CRITICAL ERROR', {
      error: criticalError.message,
      stack: criticalError.stack
    });
    console.error('\n💥 Critical test failure:', criticalError);
  }
  
  // Generate summary
  logger.summary();
  
  // Cleanup
  if (TEST_MODE === 'full') {
    console.log('\n🧹 Cleaning up...');
    await cacheManager.clear();
    await db.clearAllData();
  }
  
  // Exit code based on failures
  const failed = testResults.filter(r => r.status === 'FAILED').length;
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================================
// Execute Tests
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}` || require.main === module) {
  console.log('📁 Log directory:', LOG_DIR);
  console.log('📝 Main log:', LOG_FILE);
  console.log('❌ Error log:', ERROR_LOG_FILE);
  
  runDifferentialTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runDifferentialTests, TestLogger };
