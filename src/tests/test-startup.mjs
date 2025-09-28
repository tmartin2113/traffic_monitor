/**
 * Initial Startup Test with Enhanced Error Logging
 * Creates detailed logs for each failure
 */

import fs from 'fs';
import path from 'path';
import { trafficAPI } from './dist/services/api/trafficApi.js';
import { db } from './dist/db/TrafficDatabase.js';
import { cacheManager } from './dist/services/cache/CacheManager.js';
import { rateLimiter } from './dist/services/rateLimit/RateLimiter.js';

const API_KEY = process.env.VITE_511_API_KEY || process.argv[2];
const LOG_DIR = './test-logs';
const LOG_FILE = `${LOG_DIR}/startup-test-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

// Create log directory
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Error collector
const errorLog = [];
const testResults = [];

// Enhanced logging functions
function logError(testName, error, context = {}) {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    test: testName,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data,
      statusCode: error.response?.status,
    },
    context,
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
    }
  };
  
  errorLog.push(errorEntry);
  
  // Console output with color
  console.error(`   ❌ ${testName} failed:`);
  console.error(`      Error: ${error.message}`);
  if (error.code) console.error(`      Code: ${error.code}`);
  if (error.response?.status) console.error(`      HTTP Status: ${error.response.status}`);
  console.error(`      See log file for details: ${LOG_FILE}\n`);
  
  // Write to log file immediately
  fs.appendFileSync(LOG_FILE, JSON.stringify(errorEntry, null, 2) + '\n\n');
}

function logSuccess(testName, details = {}) {
  const successEntry = {
    timestamp: new Date().toISOString(),
    test: testName,
    status: 'PASSED',
    details
  };
  
  testResults.push(successEntry);
  fs.appendFileSync(LOG_FILE, JSON.stringify(successEntry, null, 2) + '\n\n');
}

console.log(`
╔══════════════════════════════════════════════╗
║   511 Traffic Monitor - Initial Startup Test  ║
╚══════════════════════════════════════════════╝

📝 Log file: ${LOG_FILE}
`);

async function testStartup() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Initialize log file
  fs.writeFileSync(LOG_FILE, `Test Started: ${new Date().toISOString()}\n${'='.repeat(50)}\n\n`);

  // Test 1: API Key Validation
  console.log('1️⃣  Testing API Key...');
  try {
    if (!API_KEY) {
      throw new Error('No API key provided');
    }
    
    if (API_KEY.length < 10) {
      throw new Error(`Invalid API key format (too short: ${API_KEY.length} chars)`);
    }
    
    trafficAPI.setApiKey(API_KEY);
    console.log('   ✅ API key configured\n');
    logSuccess('API Key Validation', { keyLength: API_KEY.length });
    testsPassed++;
  } catch (error) {
    logError('API Key Validation', error, { 
      keyProvided: !!API_KEY,
      keyLength: API_KEY?.length || 0 
    });
    testsFailed++;
    
    // Critical failure - stop here
    console.error('\n⛔ Cannot proceed without valid API key\n');
    return;
  }

  // Test 2: Rate Limiter
  console.log('2️⃣  Testing Rate Limiter...');
  try {
    const info = rateLimiter.getInfo();
    
    if (info.remaining < 1) {
      throw new Error(`Rate limit exhausted. Reset at: ${new Date(info.resetTime)}`);
    }
    
    console.log(`   ✅ Rate limit: ${info.remaining}/${info.limit} requests available\n`);
    logSuccess('Rate Limiter', info);
    testsPassed++;
  } catch (error) {
    logError('Rate Limiter', error, { 
      rateLimitInfo: rateLimiter.getInfo() 
    });
    testsFailed++;
  }

  // Test 3: Initial API Call
  console.log('3️⃣  Testing 511 API Connection...');
  let apiTestEvents = null;
  try {
    const startTime = Date.now();
    const events = await trafficAPI.fetchGeofencedEvents({
      api_key: API_KEY,
      limit: 10
    });
    const responseTime = Date.now() - startTime;
    
    if (!Array.isArray(events)) {
      throw new Error(`Invalid response format: expected array, got ${typeof events}`);
    }
    
    if (events.length === 0) {
      console.warn('   ⚠️  No events returned (might be quiet period)');
    }
    
    apiTestEvents = events;
    console.log(`   ✅ Connected! Retrieved ${events.length} events in ${responseTime}ms`);
    console.log(`   📍 Sample event: ${events[0]?.headline || 'N/A'}\n`);
    
    logSuccess('API Connection', {
      eventCount: events.length,
      responseTime,
      sampleEvent: events[0]?.headline,
      endpoint: 'fetchGeofencedEvents'
    });
    testsPassed++;
  } catch (error) {
    logError('API Connection', error, {
      endpoint: '/traffic/events',
      params: { limit: 10 },
      apiKey: API_KEY.substring(0, 4) + '...' // Log partial key for debugging
    });
    testsFailed++;
    
    // Try to determine specific API issue
    if (error.response?.status === 401) {
      console.error('   🔑 API Key is invalid or expired\n');
    } else if (error.response?.status === 429) {
      console.error('   ⏱️  Rate limit exceeded\n');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   🌐 Cannot reach 511.org API (network issue)\n');
    }
  }

  // Test 4: IndexedDB
  console.log('4️⃣  Testing IndexedDB...');
  try {
    await db.open();
    const count = await db.events.count();
    const tables = db.tables.map(t => t.name);
    
    // Test write operation
    if (apiTestEvents && apiTestEvents.length > 0) {
      await db.events.put(apiTestEvents[0]);
      const retrieved = await db.events.get(apiTestEvents[0].id);
      if (!retrieved) {
        throw new Error('Failed to retrieve stored event');
      }
    }
    
    console.log(`   ✅ Database ready (${count} events stored)\n`);
    logSuccess('IndexedDB', {
      eventCount: count,
      tables,
      writeTest: 'passed'
    });
    testsPassed++;
  } catch (error) {
    logError('IndexedDB', error, {
      dbName: 'TrafficDB',
      available: 'indexedDB' in globalThis
    });
    testsFailed++;
  }

  // Test 5: Cache Manager
  console.log('5️⃣  Testing Cache System...');
  try {
    const testKey = 'test-key-' + Date.now();
    const testData = { 
      test: 'data', 
      timestamp: Date.now(),
      nested: { value: 42 }
    };
    
    // Test set
    await cacheManager.set(testKey, testData, 5000);
    
    // Test get
    const cached = await cacheManager.get(testKey);
    if (!cached || cached.test !== 'data') {
      throw new Error(`Cache retrieval mismatch: ${JSON.stringify(cached)}`);
    }
    
    // Test delete
    await cacheManager.delete(testKey);
    const deleted = await cacheManager.get(testKey);
    if (deleted !== null) {
      throw new Error('Cache deletion failed');
    }
    
    // Get stats
    const stats = cacheManager.getStats();
    
    console.log('   ✅ Cache working correctly\n');
    logSuccess('Cache System', {
      operations: ['set', 'get', 'delete'],
      stats
    });
    testsPassed++;
  } catch (error) {
    logError('Cache System', error, {
      cacheStats: cacheManager.getStats()
    });
    testsFailed++;
  }

  // Test 6: Full Initial Sync
  console.log('6️⃣  Testing Full Initial Sync...');
  try {
    const startTime = Date.now();
    const events = await trafficAPI.fetchGeofencedEvents({
      api_key: API_KEY,
      limit: 100
    });
    
    if (!events || events.length === 0) {
      throw new Error('No events returned from full sync');
    }
    
    // Store in database
    await db.events.bulkPut(events);
    
    // Verify storage
    const storedCount = await db.events.count();
    if (storedCount === 0) {
      throw new Error('Events not stored in database');
    }
    
    const syncTime = Date.now() - startTime;
    
    // Event analysis
    const analysis = {
      total: events.length,
      closures: events.filter(e => e.event_type === 'ROAD_CLOSURE').length,
      incidents: events.filter(e => e.event_type === 'INCIDENT').length,
      construction: events.filter(e => e.event_type === 'CONSTRUCTION').length,
      severities: {
        minor: events.filter(e => e.severity === 'Minor').length,
        moderate: events.filter(e => e.severity === 'Moderate').length,
        major: events.filter(e => e.severity === 'Major').length,
        severe: events.filter(e => e.severity === 'Severe').length,
      }
    };
    
    console.log(`   ✅ Synced ${events.length} events in ${syncTime}ms`);
    console.log(`   📊 Breakdown:`);
    console.log(`      - Closures: ${analysis.closures}`);
    console.log(`      - Incidents: ${analysis.incidents}`);
    console.log(`      - Construction: ${analysis.construction}\n`);
    
    logSuccess('Full Initial Sync', {
      syncTime,
      analysis,
      databaseStored: storedCount
    });
    testsPassed++;
  } catch (error) {
    logError('Full Initial Sync', error, {
      endpoint: 'fetchGeofencedEvents',
      limit: 100
    });
    testsFailed++;
  }

  // Test 7: Sync State
  console.log('7️⃣  Testing Sync State...');
  try {
    const syncState = trafficAPI.getSyncState();
    
    if (!syncState.syncId) {
      throw new Error('Sync ID not generated');
    }
    
    console.log('   ✅ Sync state:');
    console.log(`      - Total events: ${syncState.totalEvents}`);
    console.log(`      - Last sync: ${syncState.lastSyncTimestamp || 'Never'}`);
    console.log(`      - Sync ID: ${syncState.syncId}\n`);
    
    logSuccess('Sync State', syncState);
    testsPassed++;
  } catch (error) {
    logError('Sync State', error);
    testsFailed++;
  }

  // Test 8: Performance Metrics
  console.log('8️⃣  Testing Performance Metrics...');
  try {
    const cacheStats = cacheManager.getStats();
    const apiStats = trafficAPI.getStatistics();
    
    const metrics = {
      cache: {
        hitRate: (cacheStats.hitRate * 100).toFixed(1) + '%',
        entries: cacheStats.size,
        memoryUsage: (cacheStats.memoryUsage / 1024).toFixed(1) + ' KB',
        differentialCount: cacheStats.differentialCount
      },
      api: {
        rateLimitRemaining: apiStats.rateLimitRemaining,
        totalEvents: apiStats.totalEvents,
        cacheHitRate: (apiStats.cacheHitRate * 100).toFixed(1) + '%'
      }
    };
    
    console.log('   ✅ Performance metrics:');
    console.log(`      - Cache hit rate: ${metrics.cache.hitRate}`);
    console.log(`      - Cache entries: ${metrics.cache.entries}`);
    console.log(`      - Memory usage: ${metrics.cache.memoryUsage}`);
    console.log(`      - API calls remaining: ${metrics.api.rateLimitRemaining}/60\n`);
    
    logSuccess('Performance Metrics', metrics);
    testsPassed++;
  } catch (error) {
    logError('Performance Metrics', error);
    testsFailed++;
  }

  // Final Summary
  const summary = {
    testsPassed,
    testsFailed,
    totalTests: testsPassed + testsFailed,
    successRate: ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1) + '%',
    timestamp: new Date().toISOString(),
    logFile: LOG_FILE
  };

  console.log('═══════════════════════════════════════════════');
  console.log(`RESULTS: ${testsPassed} passed, ${testsFailed} failed (${summary.successRate} success rate)`);
  
  // Write summary to log
  fs.appendFileSync(LOG_FILE, '\n' + '='.repeat(50) + '\n');
  fs.appendFileSync(LOG_FILE, 'TEST SUMMARY\n');
  fs.appendFileSync(LOG_FILE, JSON.stringify(summary, null, 2));

  if (testsFailed === 0) {
    console.log('\n🎉 All systems operational! Ready for production use.');
  } else {
    console.log(`\n⚠️  ${testsFailed} test(s) failed. Check log file for details:`);
    console.log(`   ${LOG_FILE}`);
    
    // Show critical errors
    if (errorLog.length > 0) {
      console.log('\n📋 Error Summary:');
      errorLog.forEach(err => {
        console.log(`   - ${err.test}: ${err.error.message}`);
      });
    }
  }
  
  return { testsPassed, testsFailed, errorLog };
}

// Run the test
testStartup()
  .then(({ testsFailed }) => {
    process.exit(testsFailed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('\n💥 Catastrophic test failure:', error);
    fs.appendFileSync(LOG_FILE, `\nCATASTROPHIC FAILURE: ${error.stack}`);
    process.exit(1);
  });
