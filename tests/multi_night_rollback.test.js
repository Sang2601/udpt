/**
 * tests/multi_night_rollback.test.js
 * Automated test suite for Atomic Multi-Night Rollback.
 * Validates that if a multi-night reservation fails on any individual night,
 * ALL previously evaluated nights are rolled back atomically with zero inventory leakage.
 */

import { BookingDatabase } from '../services/booking/src/db.js';
import { v4 as uuidv4 } from 'uuid';

async function runMultiNightRollbackTests() {
  console.log('Running Multi-Night Atomic Rollback Tests...');
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

  const testRoomTypeId = `room-test-${Date.now()}`;
  const stayDates = ['2026-12-10', '2026-12-11', '2026-12-12']; // 3 nights

  // Pre-seed inventory: Day 1 (10 total, 0 booked), Day 2 (10 total, 10 booked -> FULL!), Day 3 (10 total, 0 booked)
  await new Promise((res, rej) => {
    db.sqliteDb.serialize(() => {
      db.sqliteDb.run('INSERT OR REPLACE INTO room_daily_inventory (room_type_id, stay_date, total_rooms, booked_rooms) VALUES (?, ?, 10, 0)', [testRoomTypeId, '2026-12-10']);
      db.sqliteDb.run('INSERT OR REPLACE INTO room_daily_inventory (room_type_id, stay_date, total_rooms, booked_rooms) VALUES (?, ?, 10, 10)', [testRoomTypeId, '2026-12-11']); // FULL
      db.sqliteDb.run('INSERT OR REPLACE INTO room_daily_inventory (room_type_id, stay_date, total_rooms, booked_rooms) VALUES (?, ?, 10, 0)', [testRoomTypeId, '2026-12-12'], err => err ? rej(err) : res());
    });
  });

  // Attempt booking spanning all 3 nights
  const bookingData = {
    id: uuidv4(),
    booking_code: `PK-${Math.floor(100000 + Math.random() * 900000)}`,
    user_id: 'user-multi-night-01',
    hotel_id: 'hotel-01',
    room_type_id: testRoomTypeId,
    hotel_name: 'Khách sạn Kiểm thử',
    room_type_name: 'Phòng Deluxe',
    check_in: '2026-12-10',
    check_out: '2026-12-13',
    rooms_count: 1,
    guests_count: 2,
    unit_price: 1000000,
    total_price: 3000000,
    customer_name: 'Trần Văn B',
    customer_email: 'tranvanb@example.com',
    customer_phone: '0987654321'
  };

  let bookingError = null;
  try {
    await db.createBookingAtomic({
      bookingData,
      stayDates,
      defaultTotalRooms: 10
    });
  } catch (err) {
    bookingError = err;
  }

  assert(bookingError !== null, 'Booking request was rejected because Night 2 was fully occupied');
  assert(bookingError.code === 'ROOM_UNAVAILABLE', 'Error code is ROOM_UNAVAILABLE');
  assert(bookingError.failedDate === '2026-12-11', 'Error correctly flagged 2026-12-11 as the failing night');

  // Verify Atomic Rollback: Day 1 and Day 3 must NOT have booked_rooms incremented!
  const rows = await new Promise((res, rej) => {
    db.sqliteDb.all(
      'SELECT stay_date, total_rooms, booked_rooms FROM room_daily_inventory WHERE room_type_id = ? ORDER BY stay_date ASC',
      [testRoomTypeId],
      (err, data) => err ? rej(err) : res(data)
    );
  });

  assert(rows.length === 3, 'Found 3 inventory records');
  assert(rows[0].stay_date === '2026-12-10' && rows[0].booked_rooms === 0, 'Night 1 (2026-12-10) remained 0 booked (rolled back)');
  assert(rows[1].stay_date === '2026-12-11' && rows[1].booked_rooms === 10, 'Night 2 (2026-12-11) remained 10 booked (untouched)');
  assert(rows[2].stay_date === '2026-12-12' && rows[2].booked_rooms === 0, 'Night 3 (2026-12-12) remained 0 booked (rolled back)');

  // Verify no orphaned booking was created in bookings table
  const orphanBooking = await db.getBookingById(bookingData.id);
  assert(orphanBooking === null, 'No phantom booking created in bookings table');

  console.log(`Multi-Night Rollback Tests Completed: ${passed}/${total} assertions passed.`);
}

runMultiNightRollbackTests().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
