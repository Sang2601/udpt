/**
 * tests/chord.test.js
 * Automated unit test for Chord DHT algorithm simulation (Bài 4).
 * Validates:
 * 1. Finger table of Node 8
 * 2. Key distribution for keys 10, 24, 30, 38, 54
 * 3. Node 26 join and key 24 migration from Node 32 to Node 26
 * 4. Multi-hop lookup resolution
 */

import { ChordRing } from '../examples/chord/ChordRing.js';

function runChordTests() {
  console.log('Running Chord DHT Unit Tests...');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`  FAIL: ${message}`);
      throw new Error(`Test failed: ${message}`);
    }
    passed++;
    console.log(`  PASS: ${message}`);
  }

  const ring = new ChordRing(6);
  const initialNodes = [1, 8, 14, 21, 32, 38, 42, 48, 51, 56];
  for (const id of initialNodes) ring.addNode(id);

  // Test 1: Node 8 Finger Table matching Lecture 4
  const node8 = ring.getNode(8);
  const ft = node8.fingerTable.getTable();
  const expectedFT = [
    { i: 0, start: 9, successor: 14 },
    { i: 1, start: 10, successor: 14 },
    { i: 2, start: 12, successor: 14 },
    { i: 3, start: 16, successor: 21 },
    { i: 4, start: 24, successor: 32 },
    { i: 5, start: 40, successor: 42 }
  ];

  for (let idx = 0; idx < expectedFT.length; idx++) {
    const exp = expectedFT[idx];
    const actual = ft[idx];
    assert(
      actual.start === exp.start && actual.successor === exp.successor,
      `Finger ${idx} at Node 8 has start=${exp.start}, successor=${exp.successor}`
    );
  }

  // Test 2: Initial key placement
  ring.putKey(10, 'Val 10');
  ring.putKey(24, 'Val 24');
  ring.putKey(30, 'Val 30');
  ring.putKey(38, 'Val 38');
  ring.putKey(54, 'Val 54');

  assert(ring.getNode(14).get(10) === 'Val 10', 'Key 10 assigned to Node 14');
  assert(ring.getNode(32).get(24) === 'Val 24', 'Key 24 assigned to Node 32');
  assert(ring.getNode(32).get(30) === 'Val 30', 'Key 30 assigned to Node 32');
  assert(ring.getNode(38).get(38) === 'Val 38', 'Key 38 assigned to Node 38');
  assert(ring.getNode(56).get(54) === 'Val 54', 'Key 54 assigned to Node 56');

  // Test 3: Hop lookup
  const lookup54 = ring.lookupKey(54, 8);
  assert(lookup54.responsibleNodeId === 56, 'Lookup key 54 from Node 8 finds Node 56');
  assert(lookup54.trace.length > 0, 'Lookup trace is recorded');

  // Test 4: Node 26 Join & Key 24 Migration
  ring.addNode(26);
  assert(ring.getNode(26).get(24) === 'Val 24', 'Key 24 migrated from Node 32 to Node 26 upon join');
  assert(!ring.getNode(32).keys.has(24), 'Node 32 no longer holds key 24');
  assert(ring.getNode(32).get(30) === 'Val 30', 'Node 32 retains key 30');

  // Test 5: Node departure
  ring.removeNode(26);
  assert(ring.getNode(32).get(24) === 'Val 24', 'Key 24 migrated back to Node 32 when Node 26 left');

  console.log(`Chord DHT Tests Completed: ${passed}/${total} assertions passed.`);
}

runChordTests();
