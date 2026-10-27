/**
 * tests/cancellation_idempotency.test.js
 * Automated test suite for Idempotent Booking Cancellation.
 * Validates that repeating a cancellation request does NOT repeatedly decrement inventory.
 */

import { BookingDatabase } from '../services/booking/src/db.js';
import { v4 as uuidv4 } from 'uuid';

async function runCancellationTests() {
  console.log('Running Cancellation Idempotency Automated Tests...');
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

  const testRoomTypeId = `room-cancel-${Date.now()}`;
  const stayDate = '2026-12-30';
  const bookingId = uuidv4();
  const userId = 'user-cancel-test-01';

  // Seed inventory: 5 total, 0 booked
  await new Promise((res, rej) => {
    db.sqliteDb.run(
      'INSERT OR REPLACE INTO room_daily_inventory (room_type_id, stay_date, total_rooms, booked_rooms) VALUES (?, ?, 5, 0)',
      [testRoomTypeId, stayDate],
      err => err ? rej(err) : res()
    );
  });

  // Create confirmed booking for 2 rooms
  const bookingData = {
    id: bookingId,
    booking_code: `PK-CAN${Date.now()}`,
    user_id: userId,
    hotel_id: 'hotel-cancel-01',
    room_type_id: testRoomTypeId,
    hotel_name: 'Khách sạn Hủy phòng',
    room_type_name: 'Phòng Deluxe',
    check_in: stayDate,
    check_out: '2026-12-31',
    rooms_count: 2,
    guests_count: 2,
    unit_price: 1500000,
    total_price: 3000000,
    customer_name: 'Lê Thị C',
    customer_email: 'lethic@example.com',
    customer_phone: '0912345678'
  };

  await db.createBookingAtomic({
    bookingData,
    stayDates: [stayDate],
    defaultTotalRooms: 5
  });

  // Verify booked_rooms is 2
  let inv1 = await new Promise((res, rej) => {
    db.sqliteDb.get(
      'SELECT booked_rooms FROM room_daily_inventory WHERE room_type_id = ? AND stay_date = ?',
      [testRoomTypeId, stayDate],
      (err, row) => err ? rej(err) : res(row)
    );
  });
  assert(inv1.booked_rooms === 2, 'Initial booking consumed 2 rooms (booked_rooms = 2)');

  // 1st Cancellation
  const cancel1 = await db.cancelBookingAtomic(bookingData.booking_code, 1, false);
  assert(cancel1.status === 'cancelled', 'First cancellation succeeded and status is cancelled');

  let inv2 = await new Promise((res, rej) => {
    db.sqliteDb.get(
      'SELECT booked_rooms FROM room_daily_inventory WHERE room_type_id = ? AND stay_date = ?',
      [testRoomTypeId, stayDate],
      (err, row) => err ? rej(err) : res(row)
    );
  });
  assert(inv2.booked_rooms === 0, 'First cancellation correctly restored 2 rooms (booked_rooms = 0)');

  // 2nd Cancellation (Repeated)
  const cancel2 = await db.cancelBookingAtomic(bookingData.booking_code, 1, false);
  assert(cancel2.alreadyCancelled === true, 'Second cancellation recognized order was already cancelled');

  let inv3 = await new Promise((res, rej) => {
    db.sqliteDb.get(
      'SELECT booked_rooms FROM room_daily_inventory WHERE room_type_id = ? AND stay_date = ?',
      [testRoomTypeId, stayDate],
      (err, row) => err ? rej(err) : res(row)
    );
  });
  assert(inv3.booked_rooms === 0, 'Second cancellation did NOT further decrement booked_rooms below 0 (no phantom inventory)');

  // 3rd Cancellation (Repeated)
  const cancel3 = await db.cancelBookingAtomic(bookingData.booking_code, 1, false);
  assert(cancel3.alreadyCancelled === true, 'Third cancellation recognized order was already cancelled');

  let inv4 = await new Promise((res, rej) => {
    db.sqliteDb.get(
      'SELECT booked_rooms FROM room_daily_inventory WHERE room_type_id = ? AND stay_date = ?',
      [testRoomTypeId, stayDate],
      (err, row) => err ? rej(err) : res(row)
    );
  });
  assert(inv4.booked_rooms === 0, 'Third cancellation maintained exact inventory count at 0');

  console.log(`Cancellation Tests Completed: ${passed}/${total} assertions passed.`);
}

runCancellationTests().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
