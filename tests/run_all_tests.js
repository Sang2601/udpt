/**
 * tests/run_all_tests.js
 * Unified Test Suite Runner for PhenikaaHotel Distributed System.
 * Runs all unit, concurrency, idempotency, RPC, WorkerPool, and Chord tests.
 *
 * Usage:
 *   node tests/run_all_tests.js
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  { name: 'Bài 4: Chord DHT Algorithm Simulation', file: 'chord.test.js' },
  { name: 'Bài 2: Bounded Worker Pool (worker_threads)', file: 'worker_pool.test.js' },
  { name: 'Bài 3: JSON-RPC 2.0 Authoritative Pricing', file: 'json_rpc.test.js' },
  { name: 'Idempotency: Replay & Fingerprint Conflict', file: 'idempotency.test.js' },
  { name: 'Concurrency: 25-Client Anti-Overbooking', file: 'concurrency_overbooking.test.js' },
  { name: 'Transactions: Atomic Multi-Night Rollback', file: 'multi_night_rollback.test.js' },
  { name: 'Cancellation: Idempotent Inventory Return', file: 'cancellation_idempotency.test.js' }
];

console.log('='.repeat(75));
console.log('  PHENIKAAHOTEL DISTRIBUTED SYSTEM - AUTOMATED VERIFICATION SUITE');
console.log('='.repeat(75));

async function runTest(testItem) {
  return new Promise((resolve) => {
    const fullPath = path.resolve(__dirname, testItem.file);
    const child = spawn('node', [fullPath], { stdio: 'inherit' });

    child.on('close', (code) => {
      resolve({ name: testItem.name, file: testItem.file, passed: code === 0 });
    });
  });
}

async function main() {
  const results = [];
  for (const item of testFiles) {
    console.log(`\n>>> [RUNNING] ${item.name} (${item.file})`);
    const res = await runTest(item);
    results.push(res);
  }

  console.log('\n' + '='.repeat(75));
  console.log('  TEST EXECUTION SUMMARY');
  console.log('='.repeat(75));
  let allPass = true;
  for (const r of results) {
    const statusStr = r.passed ? '[PASS] ' : '[FAIL] ';
    if (!r.passed) allPass = false;
    console.log(`  ${statusStr.padEnd(8)} ${r.name.padEnd(48)} (${r.file})`);
  }
  console.log('='.repeat(75));
  console.log(`Overall Status: ${allPass ? 'ALL TEST SUITES PASSED (100%)' : 'SOME TESTS FAILED'}\n`);

  if (!allPass) process.exit(1);
}

main();
