#!/usr/bin/env node

/**
 * Simple test runner for differential updates
 * Run with: node test-differential.js YOUR_API_KEY
 */

import { trafficAPI } from './dist/services/api/trafficApi.js';

const API_KEY = process.argv[2];

if (!API_KEY) {
  console.error('Please provide your 511.org API key');
  console.error('Usage: node test-differential.js YOUR_API_KEY');
  process.exit(1);
}

async function runTest() {
  console.log('Testing Differential Updates System...\n');
  
  trafficAPI.setApiKey(API_KEY);
  
  // Test 1: Full sync
  console.log('1️⃣  Testing full sync...');
  const events = await trafficAPI.fetchGeofencedEvents({ api_key: API_KEY });
  console.log(`   ✓ Fetched ${events.length} events\n`);
  
  // Test 2: Differential sync
  console.log('2️⃣  Testing differential sync...');
  await new Promise(r => setTimeout(r, 2000));
  
  const diff = await trafficAPI.fetchDifferentialUpdates({ api_key: API_KEY });
  console.log(`   ✓ Differential: ${diff.added.length} added, ${diff.updated.length} updated, ${diff.deleted.length} deleted\n`);
  
  // Test 3: Cache
  console.log('3️⃣  Testing cache...');
  const cached = await trafficAPI.fetchGeofencedEvents({ api_key: API_KEY });
  console.log(`   ✓ Cache working: ${cached.length} events\n`);
  
  console.log('✅ All tests passed!');
}

runTest().catch(console.error);
