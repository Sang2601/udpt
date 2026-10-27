/**
 * tests/concurrency_overbooking.test.js
 * Automated test suite for High Concurrency Anti-Overbooking Guarantees.
 * Simulates 25 concurrent requests competing for the last 2 available rooms.
 * Asserts:
 * - Exactly 2 requests succeed.
 * - Exactly 23 requests are rejected with ROOM_UNAVAILABLE.
 * - Zero overbooking occurs.
 */

import { BookingDatabase } from '../services/booking/src/db.js';
import { v4 as uuidv4 } from 'uuid';

async function runConcurrencyOverbookingTests() {
  console.log('Running High-Concurrency Anti-Overbooking Tests (25 concurrent workers vs 2 available rooms)...');
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

  const db = new BookingDatabase();
  await db.init();

  const testRoomTypeId = `room-concurrency-${Date.now()}`;
  const stayDate = '2026-12-25';
  const totalCapacity = 2; // Only 2 rooms exist!

  // Seed initial capacity: total = 2, booked = 0
  await new Promise((res, rej) => {
    db.sqliteDb.run(
      'INSERT OR REPLACE INTO room_daily_inventory (room_type_id, stay_date, total_rooms, booked_rooms) VALUES (?, ?, ?, 0)',
      [testRoomTypeId, stayDate, totalCapacity],
      err => err ? rej(err) : res()
    );
  });

  const concurrentCount = 25;
  console.log(`Dispatched ${concurrentCount} concurrent booking requests simultaneously...`);

  const promises = [];
  for (let i = 0; i < concurrentCount; i++) {
    const bookingData = {
      id: uuidv4(),
      booking_code: `PK-C${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`,
      user_id: `user-concurrent-${i}`,
      hotel_id: 'hotel-hn-01',
      room_type_id: testRoomTypeId,
      hotel_name: 'Khách sạn Hà Nội',
      room_type_name: 'Phòng VIP',
      check_in: stayDate,
      check_out: '2026-12-26',
      rooms_count: 1,
      guests_count: 2,
      unit_price: 2000000,
      total_price: 2000000,
      customer_name: `Khách hàng ${i}`,
      customer_email: `user${i}@example.com`,
      customer_phone: '0900000000'
    };

    promises.push(
      db.createBookingAtomic({
        bookingData,
        stayDates: [stayDate],
        defaultTotalRooms: totalCapacity
      }).then(
        result => ({ success: true, booking: result }),
        error => ({ success: false, error: error.message, code: error.code })
      )
    );
  }

  const results = await Promise.all(promises);

  const successful = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  console.log(`Results: ${successful.length} successful, ${rejected.length} rejected.`);
  if (rejected.length > 0) {
    console.log('Sample error:', rejected[0]);
  }

  assert(successful.length === totalCapacity, `Exactly ${totalCapacity} bookings succeeded`);
  assert(rejected.length === (concurrentCount - totalCapacity), `Exactly ${concurrentCount - totalCapacity} bookings rejected`);
  assert(rejected.every(r => r.code === 'ROOM_UNAVAILABLE'), 'All rejected requests received ROOM_UNAVAILABLE error');

  // Verify DB state
  const invRecord = await new Promise((res, rej) => {
    db.sqliteDb.get(
      'SELECT total_rooms, booked_rooms FROM room_daily_inventory WHERE room_type_id = ? AND stay_date = ?',
      [testRoomTypeId, stayDate],
      (err, row) => err ? rej(err) : res(row)
    );
  });

  assert(invRecord.booked_rooms === totalCapacity, `Inventory booked_rooms equals ${totalCapacity}`);
  assert(invRecord.booked_rooms <= invRecord.total_rooms, 'Capacity constraint strictly respected (booked <= total)');

  console.log(`Concurrency Overbooking Tests Completed: ${passed}/${total} assertions passed.`);
}

runConcurrencyOverbookingTests().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
