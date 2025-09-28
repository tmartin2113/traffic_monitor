/**
 * Initial Startup Test
 * Validates all systems are working correctly
 */

import { trafficAPI } from './dist/services/api/trafficApi.js';
import { db } from './dist/db/TrafficDatabase.js';
import { cacheManager } from './dist/services/cache/CacheManager.js';
import { rateLimiter } from './dist/services/rateLimit/RateLimiter.js';

const API_KEY = process.env.VITE_511_API_KEY || process.argv[2];

if (!API_KEY) {
  console.error('\n❌ No API key provided!');
  console.error('Usage: node test-startup.mjs YOUR_API_KEY');
  console.error('Or set VITE_511_API_KEY in .env file\n');
  process.exit(1);
}

console.log(`
╔══════════════════════════════════════════════╗
║   511 Traffic Monitor - Initial Startup Test  ║
╚══════════════════════════════════════════════╝
`);

async function testStartup() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: API Key Validation
  console.log('1️⃣  Testing API Key...');
  try {
    trafficAPI.setApiKey(API_KEY);
    console.log('   ✅ API key configured\n');
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Failed to set API key\n');
    testsFailed++;
  }

  // Test 2: Rate Limiter
  console.log('2️⃣  Testing Rate Limiter...');
  try {
    const info = rateLimiter.getInfo();
    console.log(`   ✅ Rate limit: ${info.remaining}/${info.limit} requests available\n`);
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Rate limiter failed\n');
    testsFailed++;
  }

  // Test 3: Initial API Call
  console.log('3️⃣  Testing 511 API Connection...');
  try {
    const events = await trafficAPI.fetchGeofencedEvents({
      api_key: API_KEY,
      limit: 10
    });
    console.log(`   ✅ Connected! Retrieved ${events.length} events`);
    console.log(`   📍 Sample event: ${events[0]?.headline || 'N/A'}\n`);
    testsPassed++;
  } catch (error) {
    console.error(`   ❌ API call failed: ${error.message}\n`);
    testsFailed++;
    return;
  }

  // Test 4: IndexedDB
  console.log('4️⃣  Testing IndexedDB...');
  try {
    await db.open();
    const count = await db.events.count();
    console.log(`   ✅ Database ready (${count} events stored)\n`);
    testsPassed++;
  } catch (error) {
    console.error('   ❌ IndexedDB failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 5: Cache Manager
  console.log('5️⃣  Testing Cache System...');
  try {
    await cacheManager.set('test-key', { test: 'data' }, 5000);
    const cached = await cacheManager.get('test-key');
    if (cached?.test === 'data') {
      console.log('   ✅ Cache working correctly\n');
      testsPassed++;
    } else {
      throw new Error('Cache retrieval failed');
    }
  } catch (error) {
    console.error('   ❌ Cache failed:', error.message, '\n');
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
    
    // Store in database
    await db.events.bulkPut(events);
    
    const syncTime = Date.now() - startTime;
    console.log(`   ✅ Synced ${events.length} events in ${syncTime}ms`);
    
    // Show event breakdown
    const closures = events.filter(e => e.event_type === 'ROAD_CLOSURE').length;
    const incidents = events.filter(e => e.event_type === 'INCIDENT').length;
    const construction = events.filter(e => e.event_type === 'CONSTRUCTION').length;
    
    console.log(`   📊 Breakdown:`);
    console.log(`      - Closures: ${closures}`);
    console.log(`      - Incidents: ${incidents}`);
    console.log(`      - Construction: ${construction}\n`);
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Initial sync failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 7: Sync State
  console.log('7️⃣  Testing Sync State...');
  try {
    const syncState = trafficAPI.getSyncState();
    console.log('   ✅ Sync state:');
    console.log(`      - Total events: ${syncState.totalEvents}`);
    console.log(`      - Last sync: ${syncState.lastSyncTimestamp || 'Never'}`);
    console.log(`      - Sync ID: ${syncState.syncId}\n`);
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Sync state failed\n');
    testsFailed++;
  }

  // Test 8: Cache Statistics
  console.log('8️⃣  Testing Cache Statistics...');
  try {
    const stats = cacheManager.getStats();
    const apiStats = trafficAPI.getStatistics();
    
    console.log('   ✅ Performance metrics:');
    console.log(`      - Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`      - Cache entries: ${stats.size}`);
    console.log(`      - Memory usage: ${(stats.memoryUsage / 1024).toFixed(1)} KB`);
    console.log(`      - API calls remaining: ${apiStats.rateLimitRemaining}/60\n`);
    testsPassed++;
  } catch (error) {
    console.error('   ❌ Statistics failed\n');
    testsFailed++;
  }

  // Summary
  console.log('═══════════════════════════════════════════════');
  console.log(`RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All systems operational! Ready for production use.');
    console.log('\n📝 Next steps:');
    console.log('   1. Run the differential sync test: npx tsx src/tests/differential.test.ts');
    console.log('   2. Start the dev server: npm run dev');
    console.log('   3. Open http://localhost:5173 in your browser');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
}

// Run the test
testStartup().catch(console.error);
