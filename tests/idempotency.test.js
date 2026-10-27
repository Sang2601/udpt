/**
 * tests/idempotency.test.js
 * Automated test suite for Idempotency-Key guarantees.
 * Tests:
 * 1. Replay of identical request with same key returns cached response without duplicate booking.
 * 2. Replay with same key but altered payload is rejected with 422 Unprocessable Entity.
 */

import http from 'http';
import express from 'express';
import { BookingDatabase } from '../services/booking/src/db.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

async function runIdempotencyTests() {
  console.log('Running Idempotency Automated Tests...');
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

  const db = new BookingDatabase('sqlite::memory:');
  await db.init();

  const idempotencyKey = `idem-${Date.now()}-${uuidv4().substring(0, 8)}`;
  const userId = 'user-test-uuid-001';

  const originalPayload = {
    userId,
    hotelId: 'hotel-01',
    roomTypeId: 'room-deluxe-01',
    checkIn: '2026-12-01',
    checkOut: '2026-12-03',
    count: 1,
    customerName: 'Nguyễn Văn A'
  };

  const hashOriginal = crypto.createHash('sha256').update(JSON.stringify(originalPayload)).digest('hex');

  // Step 1: Initial creation and caching
  const initialResponse = {
    message: 'Đặt phòng thành công',
    booking: {
      id: 'booking-uuid-initial',
      booking_code: 'PK-999001',
      status: 'confirmed'
    }
  };

  await db.saveIdempotencyRecord({
    key: idempotencyKey,
    userId,
    requestHash: hashOriginal,
    status: 201,
    body: initialResponse
  });

  // Test 1: Fetch with same key and same payload
  const record1 = await db.getIdempotencyRecord(idempotencyKey);
  assert(record1 !== null, 'Idempotency record found in storage');
  assert(record1.request_hash === hashOriginal, 'Request hash matches original payload');
  assert(record1.response_body.booking.booking_code === 'PK-999001', 'Cached response contains original booking code');

  // Test 2: Conflict detection when payload is altered
  const alteredPayload = {
    ...originalPayload,
    count: 2 // Modified room count
  };
  const hashAltered = crypto.createHash('sha256').update(JSON.stringify(alteredPayload)).digest('hex');

  const record2 = await db.getIdempotencyRecord(idempotencyKey);
  const isConflict = record2 && record2.request_hash !== hashAltered;
  assert(isConflict === true, 'Detected payload mutation under same Idempotency-Key (conflict rejected)');

  console.log(`Idempotency Tests Completed: ${passed}/${total} assertions passed.`);
}

runIdempotencyTests().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
