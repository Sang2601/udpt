/**
 * services/booking/src/db.js
 * High-Concurrency Database Adapter for Booking Service.
 * Implements:
 * 1. CockroachDB Serializable transaction retry loop (SQLSTATE 40001).
 * 2. Atomic multi-night inventory updates in room_daily_inventory.
 * 3. Idempotency storage and retrieval.
 * 4. Transactional Outbox pattern for RabbitMQ event publishing.
 * 5. Local SQLite fallback for native local developer execution.
 */

import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteFallbackPath = path.resolve(__dirname, '../../../server/database/hotelbooking.sqlite');

export class BookingDatabase {
  constructor(connectionString) {
    this.connectionString = connectionString || process.env.DATABASE_URL;
    this.pgPool = null;
    this.sqliteDb = null;
    this.mode = 'uninitialized';
    this._sqliteMutex = Promise.resolve();
  }

  async init() {
    if (this.connectionString && !this.connectionString.startsWith('sqlite')) {
      try {
        const pool = new pg.Pool({
          connectionString: this.connectionString,
          connectionTimeoutMillis: 3000,
          max: 20
        });
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        this.pgPool = pool;
        this.mode = 'cockroachdb';
        console.log(`[BookingService DB] Connected to CockroachDB cluster (${this.connectionString.replace(/:[^:]*@/, ':****@')})`);
        return;
      } catch (err) {
        console.warn(`[BookingService DB] CockroachDB unreachable (${err.message}). Falling back to local SQLite adapter.`);
      }
    }

    this.mode = 'sqlite';
    this.sqliteDb = new sqlite3.Database(sqliteFallbackPath);
    await this._initSqliteTables();
    console.log(`[BookingService DB] Operating in local SQLite mode at ${sqliteFallbackPath}`);
  }

  async _initSqliteTables() {
    return new Promise((resolve, reject) => {
      this.sqliteDb.serialize(() => {
        // Daily inventory table for SQLite
        this.sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS room_daily_inventory (
            room_type_id TEXT NOT NULL,
            stay_date TEXT NOT NULL,
            total_rooms INTEGER NOT NULL,
            booked_rooms INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (room_type_id, stay_date)
          )
        `);
        // Idempotency table
        this.sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS idempotency_keys (
            idempotency_key TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            request_hash TEXT NOT NULL,
            response_status INTEGER NOT NULL,
            response_body TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Ensure SQLite bookings table has modern distributed columns
        this.sqliteDb.all('PRAGMA table_info(bookings)', (pErr, cols) => {
          if (!pErr && cols && cols.length > 0) {
            const colNames = new Set(cols.map(c => c.name));
            const needed = [
              ['room_type_id', 'TEXT'],
              ['unit_price', 'REAL'],
              ['total_price', 'REAL'],
              ['customer_name', 'TEXT'],
              ['customer_email', 'TEXT'],
              ['customer_phone', 'TEXT'],
              ['hotel_name', 'TEXT'],
              ['room_type_name', 'TEXT']
            ];
            for (const [col, colType] of needed) {
              if (!colNames.has(col)) {
                this.sqliteDb.run(`ALTER TABLE bookings ADD COLUMN ${col} ${colType}`, () => {});
              }
            }
          }
        });

        // Outbox table
        this.sqliteDb.run(`
          CREATE TABLE IF NOT EXISTS outbox_events (
            id TEXT PRIMARY KEY,
            aggregate_type TEXT NOT NULL,
            aggregate_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            published INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  /**
   * Helper: Runs a transaction with automatic retry on CockroachDB serialization errors (code 40001).
   */
  async runWithRetry(fn, maxRetries = 5) {
    if (this.mode !== 'cockroachdb') {
      return fn(null);
    }

    let attempts = 0;
    while (attempts < maxRetries) {
      attempts++;
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        const result = await fn(client);
        await client.query('COMMIT');
        client.release();
        return result;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* ignore */ }
        client.release();

        // CockroachDB code 40001: serialization_failure (concurrency retry)
        if (err.code === '40001' && attempts < maxRetries) {
          const backoff = Math.floor(Math.random() * (Math.pow(2, attempts) * 20));
          console.warn(`[CockroachDB Retry] Serialization failure (40001). Retrying transaction attempt ${attempts}/${maxRetries} after ${backoff}ms...`);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Transaction failed after ${maxRetries} serialization retry attempts.`);
  }

  /**
   * Idempotency Check: returns cached response if idempotency key was previously processed
   */
  async getIdempotencyRecord(key) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query(
        'SELECT * FROM idempotency_keys WHERE idempotency_key = $1 LIMIT 1',
        [key]
      );
      if (!res.rows[0]) return null;
      return {
        ...res.rows[0],
        response_body: typeof res.rows[0].response_body === 'string'
          ? JSON.parse(res.rows[0].response_body)
          : res.rows[0].response_body
      };
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT * FROM idempotency_keys WHERE idempotency_key = ? LIMIT 1', [key], (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          resolve({
            ...row,
            response_body: JSON.parse(row.response_body)
          });
        });
      });
    }
  }

  async saveIdempotencyRecord({ key, userId, requestHash, status, body }, client = null) {
    const bodyStr = JSON.stringify(body);
    if (this.mode === 'cockroachdb') {
      const queryRunner = client || this.pgPool;
      await queryRunner.query(
        'INSERT INTO idempotency_keys (idempotency_key, user_id, request_hash, response_status, response_body) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [key, userId, requestHash, status, body]
      );
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'INSERT OR IGNORE INTO idempotency_keys (idempotency_key, user_id, request_hash, response_status, response_body) VALUES (?, ?, ?, ?, ?)',
          [key, userId, requestHash, status, bodyStr],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  /**
   * Checks room availability for a given room type across date range [checkIn, checkOut).
   * @returns {{ available: boolean, remainingRooms: number, maxBooked: number }}
   */
  async checkAvailability(roomTypeId, checkIn, checkOut, requestedRooms = 1, defaultTotalRooms = 10) {
    const dates = this._generateDateRange(checkIn, checkOut);
    if (dates.length === 0) return { available: false, remainingRooms: 0 };

    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query(
        'SELECT stay_date::text, total_rooms, booked_rooms FROM room_daily_inventory WHERE room_type_id = $1 AND stay_date = ANY($2::date[])',
        [roomTypeId, dates]
      );

      const invMap = new Map();
      for (const row of res.rows) {
        invMap.set(row.stay_date.substring(0, 10), row);
      }

      let minAvailable = defaultTotalRooms;
      for (const d of dates) {
        const item = invMap.get(d);
        const total = item ? item.total_rooms : defaultTotalRooms;
        const booked = item ? item.booked_rooms : 0;
        const available = total - booked;
        if (available < minAvailable) minAvailable = available;
        if (available < requestedRooms) {
          return { available: false, remainingRooms: available, failedDate: d };
        }
      }
      return { available: true, remainingRooms: minAvailable };
    } else {
      return new Promise((resolve, reject) => {
        const placeholders = dates.map(() => '?').join(',');
        this.sqliteDb.all(
          `SELECT stay_date, total_rooms, booked_rooms FROM room_daily_inventory WHERE room_type_id = ? AND stay_date IN (${placeholders})`,
          [roomTypeId, ...dates],
          (err, rows) => {
            if (err) return reject(err);
            const invMap = new Map();
            for (const row of (rows || [])) invMap.set(row.stay_date, row);

            let minAvailable = defaultTotalRooms;
            for (const d of dates) {
              const item = invMap.get(d);
              const total = item ? item.total_rooms : defaultTotalRooms;
              const booked = item ? item.booked_rooms : 0;
              const available = total - booked;
              if (available < minAvailable) minAvailable = available;
              if (available < requestedRooms) {
                return resolve({ available: false, remainingRooms: available, failedDate: d });
              }
            }
            resolve({ available: true, remainingRooms: minAvailable });
          }
        );
      });
    }
  }

  /**
   * ATOMIC MULTI-NIGHT BOOKING CREATION
   * Validates and increments daily inventory for all stay dates in a single transaction.
   * If any single night is short of rooms, transaction rollbacks automatically.
   */
  async createBookingAtomic({ bookingData, stayDates, defaultTotalRooms = 10 }) {
    if (this.mode === 'cockroachdb') {
      return this.runWithRetry(async (client) => {
        // 1. Lock and update inventory for all stay dates
        for (const dateStr of stayDates) {
          // Upsert default inventory record if missing
          await client.query(
            `INSERT INTO room_daily_inventory (room_type_id, stay_date, total_rooms, booked_rooms)
             VALUES ($1, $2, $3, 0)
             ON CONFLICT (room_type_id, stay_date) DO NOTHING`,
            [bookingData.room_type_id, dateStr, defaultTotalRooms]
          );

          // Atomic increment with condition: booked_rooms + requested <= total_rooms
          const updateRes = await client.query(
            `UPDATE room_daily_inventory
             SET booked_rooms = booked_rooms + $1, updated_at = clock_timestamp()
             WHERE room_type_id = $2 AND stay_date = $3 AND (total_rooms - booked_rooms) >= $1
             RETURNING total_rooms, booked_rooms`,
            [bookingData.rooms_count, bookingData.room_type_id, dateStr]
          );

          if (updateRes.rowCount === 0) {
            const err = new Error(`Phòng đã hết vào ngày ${dateStr}. Không thể hoàn tất đặt phòng.`);
            err.code = 'ROOM_UNAVAILABLE';
            err.failedDate = dateStr;
            throw err;
          }
        }

        // 2. Insert Booking Record
        await client.query(
          `INSERT INTO bookings (
            id, booking_code, user_id, hotel_id, room_type_id,
            hotel_name, room_type_name, check_in, check_out,
            rooms_count, guests_count, unit_price, total_price,
            status, customer_name, customer_email, customer_phone, special_requests
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            bookingData.id, bookingData.booking_code, bookingData.user_id, bookingData.hotel_id, bookingData.room_type_id,
            bookingData.hotel_name, bookingData.room_type_name, bookingData.check_in, bookingData.check_out,
            bookingData.rooms_count, bookingData.guests_count, bookingData.unit_price, bookingData.total_price,
            'confirmed', bookingData.customer_name, bookingData.customer_email, bookingData.customer_phone, bookingData.special_requests || null
          ]
        );

        // 3. Insert Transactional Outbox Event
        const eventId = uuidv4();
        await client.query(
          `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1, 'booking', $2, 'booking.created', $3)`,
          [eventId, bookingData.id, JSON.stringify({ ...bookingData, eventId })]
        );

        return { ...bookingData, status: 'confirmed', eventId };
      });
    } else {
      // Local SQLite Atomic Transaction (Serialized to prevent overlapping transactions on single connection)
      return new Promise((resolve, reject) => {
        this._sqliteMutex = this._sqliteMutex.then(() => new Promise((taskDone) => {
          this.sqliteDb.serialize(() => {
            this.sqliteDb.run('BEGIN TRANSACTION', (beginErr) => {
              if (beginErr) {
                taskDone();
                return reject(beginErr);
              }

              const rollback = (err) => {
                this.sqliteDb.run('ROLLBACK', () => {
                  taskDone();
                  reject(err);
                });
              };

              const checkAndReserve = async () => {
                try {
                  for (const dateStr of stayDates) {
                    // Ensure record exists
                    await new Promise((res, rej) => {
                      this.sqliteDb.run(
                        'INSERT OR IGNORE INTO room_daily_inventory (room_type_id, stay_date, total_rooms, booked_rooms) VALUES (?, ?, ?, 0)',
                        [bookingData.room_type_id, dateStr, defaultTotalRooms],
                        err => err ? rej(err) : res()
                      );
                    });

                    // Atomic check and update: only increment if remaining >= requested
                    const updated = await new Promise((res, rej) => {
                      this.sqliteDb.run(
                        'UPDATE room_daily_inventory SET booked_rooms = booked_rooms + ? WHERE room_type_id = ? AND stay_date = ? AND (total_rooms - booked_rooms) >= ?',
                        [bookingData.rooms_count, bookingData.room_type_id, dateStr, bookingData.rooms_count],
                        function(err) {
                          if (err) rej(err);
                          else res(this.changes > 0);
                        }
                      );
                    });

                    if (!updated) {
                      const err = new Error(`Phòng đã hết vào ngày ${dateStr}. Không thể hoàn tất đặt phòng.`);
                      err.code = 'ROOM_UNAVAILABLE';
                      err.failedDate = dateStr;
                      return rollback(err);
                    }
                  }

                  // Insert booking into SQLite using native schema columns
                  await new Promise((res, rej) => {
                    this.sqliteDb.run(
                      `INSERT INTO bookings (
                        booking_code, user_id, hotel_id, room_id,
                        check_in, check_out, rooms_count, adults,
                        total_price_vnd, status, guest_name, guest_email, guest_phone, special_requests
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
                      [
                        bookingData.booking_code,
                        typeof bookingData.user_id === 'number' ? bookingData.user_id : 1,
                        bookingData.hotel_id,
                        bookingData.room_type_id,
                        bookingData.check_in,
                        bookingData.check_out,
                        bookingData.rooms_count,
                        bookingData.guests_count || 2,
                        bookingData.total_price,
                        bookingData.customer_name,
                        bookingData.customer_email,
                        bookingData.customer_phone,
                        bookingData.special_requests || null
                      ],
                      err => err ? rej(err) : res()
                    );
                  });

                  // Insert outbox event
                  const eventId = uuidv4();
                  await new Promise((res, rej) => {
                    this.sqliteDb.run(
                      'INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload) VALUES (?, ?, ?, ?, ?)',
                      [eventId, 'booking', bookingData.id, 'booking.created', JSON.stringify({ ...bookingData, eventId })],
                      err => err ? rej(err) : res()
                    );
                  });

                  this.sqliteDb.run('COMMIT', (commitErr) => {
                    taskDone();
                    if (commitErr) return rollback(commitErr);
                    resolve({ ...bookingData, status: 'confirmed', eventId });
                  });
                } catch (ex) {
                  rollback(ex);
                }
              };

              checkAndReserve();
            });
          });
        })).catch(reject);
      });
    }
  }

  /**
   * ATOMIC CANCELLATION
   * Reverts daily inventory and marks booking as cancelled.
   * Repeated cancellations return existing cancelled state without re-incrementing inventory.
   */
  async cancelBookingAtomic(bookingId, userId, isAdmin = false) {
    if (this.mode === 'cockroachdb') {
      return this.runWithRetry(async (client) => {
        const bRes = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
        const booking = bRes.rows[0];
        if (!booking) {
          const err = new Error('Không tìm thấy đơn đặt phòng');
          err.code = 'NOT_FOUND';
          throw err;
        }

        if (!isAdmin && booking.user_id !== userId) {
          const err = new Error('Bạn không có quyền hủy đơn đặt phòng này');
          err.code = 'FORBIDDEN';
          throw err;
        }

        // Idempotent cancellation check
        if (booking.status === 'cancelled') {
          return { ...booking, alreadyCancelled: true };
        }

        // Return inventory
        const stayDates = this._generateDateRange(booking.check_in, booking.check_out);
        for (const dateStr of stayDates) {
          await client.query(
            `UPDATE room_daily_inventory
             SET booked_rooms = GREATEST(0, booked_rooms - $1), updated_at = clock_timestamp()
             WHERE room_type_id = $2 AND stay_date = $3`,
            [booking.rooms_count, booking.room_type_id, dateStr]
          );
        }

        // Update booking status
        await client.query(
          `UPDATE bookings SET status = 'cancelled', updated_at = clock_timestamp() WHERE id = $1`,
          [bookingId]
        );

        // Transactional Outbox
        const eventId = uuidv4();
        await client.query(
          `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
           VALUES ($1, 'booking', $2, 'booking.cancelled', $3)`,
          [eventId, bookingId, JSON.stringify({ bookingId, userId: booking.user_id, eventId })]
        );

        return { ...booking, status: 'cancelled', eventId };
      });
    } else {
      return new Promise((resolve, reject) => {
        this._sqliteMutex = this._sqliteMutex.then(() => new Promise((taskDone) => {
          this.sqliteDb.serialize(() => {
            this.sqliteDb.run('BEGIN TRANSACTION', (beginErr) => {
              if (beginErr) {
                taskDone();
                return reject(beginErr);
              }

              const rollback = (err) => this.sqliteDb.run('ROLLBACK', () => {
                taskDone();
                reject(err);
              });

              this.sqliteDb.get('SELECT * FROM bookings WHERE id = ? OR booking_code = ?', [bookingId, bookingId], async (err, booking) => {
                if (err) return rollback(err);
                if (!booking) {
                  const notFound = new Error('Không tìm thấy đơn đặt phòng');
                  notFound.code = 'NOT_FOUND';
                  return rollback(notFound);
                }

                if (!isAdmin && String(booking.user_id) !== String(userId)) {
                  const forbidden = new Error('Bạn không có quyền hủy đơn đặt phòng này');
                  forbidden.code = 'FORBIDDEN';
                  return rollback(forbidden);
                }

                if (booking.status === 'cancelled') {
                  return this.sqliteDb.run('COMMIT', () => {
                    taskDone();
                    resolve({ ...booking, alreadyCancelled: true });
                  });
                }

                try {
                  const stayDates = this._generateDateRange(booking.check_in, booking.check_out);
                  for (const dateStr of stayDates) {
                    await new Promise((res, rej) => {
                      this.sqliteDb.run(
                        'UPDATE room_daily_inventory SET booked_rooms = MAX(0, booked_rooms - ?) WHERE room_type_id = ? AND stay_date = ?',
                        [booking.rooms_count, booking.room_type_id || booking.room_id, dateStr],
                        uErr => uErr ? rej(uErr) : res()
                      );
                    });
                  }

                  await new Promise((res, rej) => {
                    this.sqliteDb.run(
                      "UPDATE bookings SET status = 'cancelled' WHERE id = ? OR booking_code = ?",
                      [bookingId, bookingId],
                      uErr => uErr ? rej(uErr) : res()
                    );
                  });

                  const eventId = uuidv4();
                  await new Promise((res, rej) => {
                    this.sqliteDb.run(
                      'INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload) VALUES (?, ?, ?, ?, ?)',
                      [eventId, 'booking', booking.id, 'booking.cancelled', JSON.stringify({ bookingId: booking.id, userId: booking.user_id, eventId })],
                      oErr => oErr ? rej(oErr) : res()
                    );
                  });

                  this.sqliteDb.run('COMMIT', (commitErr) => {
                    taskDone();
                    if (commitErr) return rollback(commitErr);
                    resolve({ ...booking, status: 'cancelled', eventId });
                  });
                } catch (ex) {
                  rollback(ex);
                }
              });
            });
          });
        })).catch(reject);
      });
    }
  }

  async getBookingsByUser(userId) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query(
        'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all(
          'SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC',
          [userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
    }
  }

  async getAllBookings() {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query('SELECT * FROM bookings ORDER BY created_at DESC');
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all('SELECT * FROM bookings ORDER BY created_at DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    }
  }

  async getBookingById(id) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query('SELECT * FROM bookings WHERE id = $1 LIMIT 1', [id]);
      return res.rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    }
  }

  /**
   * Transactional Outbox: Polls unpublished events
   */
  async getUnpublishedOutboxEvents(limit = 10) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query(
        'SELECT * FROM outbox_events WHERE published = FALSE ORDER BY created_at ASC LIMIT $1',
        [limit]
      );
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all(
          'SELECT * FROM outbox_events WHERE published = 0 ORDER BY created_at ASC LIMIT ?',
          [limit],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
    }
  }

  async markOutboxEventPublished(id) {
    if (this.mode === 'cockroachdb') {
      await this.pgPool.query(
        'UPDATE outbox_events SET published = TRUE, published_at = clock_timestamp() WHERE id = $1',
        [id]
      );
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'UPDATE outbox_events SET published = 1 WHERE id = ?',
          [id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  _generateDateRange(startDateStr, endDateStr) {
    const dates = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const curr = new Date(start);
    while (curr < end) {
      dates.push(curr.toISOString().substring(0, 10));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }

  async isHealthy() {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query('SELECT 1');
      return !!res;
    }
    return !!this.sqliteDb;
  }
}
