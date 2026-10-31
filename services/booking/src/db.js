/**
 * services/booking/src/db.js
 * Resilient Database Adapter for Booking Service (bookingdb).
 * Connects to MySQL (bookingdb) with connection pooling.
 * Falls back to local SQLite if MySQL is unreachable.
 */

import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteFallbackPath = path.resolve(__dirname, '../../../server/database/hotelbooking.sqlite');

export class BookingDatabase {
  constructor(config = {}) {
    this.host = config.host || process.env.MYSQL_HOST || '127.0.0.1';
    this.port = parseInt(config.port || process.env.MYSQL_PORT || '33062', 10);
    this.user = config.user || process.env.MYSQL_USER || 'root';
    this.password = config.password || process.env.MYSQL_PASSWORD || 'rootpassword';
    this.database = config.database || process.env.MYSQL_DATABASE || 'bookingdb';
    this.pool = null;
    this.sqliteDb = null;
    this.mode = 'uninitialized';
  }

  async init() {
    try {
      this.pool = mysql.createPool({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database: this.database,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        connectTimeout: 2000
      });

      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();

      this.mode = 'mysql';
      console.log(`[BookingService DB] Connected to MySQL (bookingdb) at ${this.host}:${this.port}/${this.database}`);
      return;
    } catch (err) {
      console.warn(`[BookingService DB] MySQL unreachable (${err.message}). Using resilient local SQLite fallback.`);
      this.mode = 'sqlite';
      this.sqliteDb = new sqlite3.Database(sqliteFallbackPath);
      // Ensure idempotency and saga tables in SQLite
      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          idempotency_key VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(100),
          request_hash VARCHAR(64),
          response_status INTEGER,
          response_body TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS saga_coordination (
          id VARCHAR(100) PRIMARY KEY,
          booking_id VARCHAR(100),
          current_step VARCHAR(50),
          status VARCHAR(50),
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log(`[BookingService DB] Operating in local SQLite mode at ${sqliteFallbackPath}`);
    }
  }

  async isHealthy() {
    if (this.mode === 'mysql' && this.pool) {
      try {
        const [rows] = await this.pool.query('SELECT 1 AS alive');
        return rows[0]?.alive === 1;
      } catch {
        return false;
      }
    }
    return this.mode === 'sqlite' && !!this.sqliteDb;
  }

  async getIdempotencyRecord(key) {
    if (this.mode === 'mysql') {
      const [rows] = await this.pool.query('SELECT * FROM idempotency_keys WHERE idempotency_key = ? LIMIT 1', [key]);
      if (!rows.length) return null;
      return {
        ...rows[0],
        response_body: typeof rows[0].response_body === 'string' ? JSON.parse(rows[0].response_body) : rows[0].response_body
      };
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT * FROM idempotency_keys WHERE idempotency_key = ? LIMIT 1', [key], (err, row) => {
          if (err) reject(err);
          else resolve(row ? { ...row, response_body: JSON.parse(row.response_body) } : null);
        });
      });
    }
  }

  async saveIdempotencyRecord(key, userId, requestHash, status, body) {
    const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
    if (this.mode === 'mysql') {
      await this.pool.query(
        `INSERT INTO idempotency_keys (idempotency_key, user_id, request_hash, response_status, response_body)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE response_status = VALUES(response_status), response_body = VALUES(response_body)`,
        [key, userId, requestHash, status, bodyStr]
      );
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          `INSERT OR REPLACE INTO idempotency_keys (idempotency_key, user_id, request_hash, response_status, response_body)
           VALUES (?, ?, ?, ?, ?)`,
          [key, userId, requestHash, status, bodyStr],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  async logSagaStep(id, bookingId, step, status, details = '') {
    if (this.mode === 'mysql') {
      await this.pool.query(
        'INSERT INTO saga_coordination (id, booking_id, current_step, status, details) VALUES (?, ?, ?, ?, ?)',
        [id, bookingId, step, status, details]
      );
    } else {
      return new Promise((resolve) => {
        this.sqliteDb.run(
          'INSERT INTO saga_coordination (id, booking_id, current_step, status, details) VALUES (?, ?, ?, ?, ?)',
          [id, bookingId, step, status, details],
          () => resolve()
        );
      });
    }
  }

  async getSagaLogs(bookingId = null) {
    if (this.mode === 'mysql') {
      let sql = 'SELECT * FROM saga_coordination';
      const params = [];
      if (bookingId) {
        sql += ' WHERE booking_id = ?';
        params.push(bookingId);
      }
      sql += ' ORDER BY created_at DESC LIMIT 50';
      const [rows] = await this.pool.query(sql, params);
      return rows;
    } else {
      return new Promise((resolve) => {
        let sql = 'SELECT * FROM saga_coordination';
        const params = [];
        if (bookingId) {
          sql += ' WHERE booking_id = ?';
          params.push(bookingId);
        }
        sql += ' ORDER BY created_at DESC LIMIT 50';
        this.sqliteDb.all(sql, params, (err, rows) => {
          resolve(rows || []);
        });
      });
    }
  }

  async createBooking(data) {
    const {
      id, booking_code, user_id, hotel_id, room_type_id,
      hotel_name, room_type_name, check_in, check_out,
      rooms_count, guests_count, unit_price, total_price,
      status, customer_name, customer_email, customer_phone,
      special_requests, payment_id
    } = data;

    if (this.mode === 'mysql') {
      await this.pool.query(
        `INSERT INTO bookings (
          id, booking_code, user_id, hotel_id, room_type_id,
          hotel_name, room_type_name, check_in, check_out,
          rooms_count, guests_count, unit_price, total_price,
          status, customer_name, customer_email, customer_phone,
          special_requests, payment_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, booking_code, user_id, hotel_id, room_type_id,
          hotel_name, room_type_name, check_in, check_out,
          rooms_count, guests_count, unit_price, total_price,
          status, customer_name, customer_email, customer_phone,
          special_requests || '', payment_id || null
        ]
      );
      return data;
    } else {
      return new Promise((resolve, reject) => {
        const sql = `INSERT INTO bookings (
          id, booking_code, user_id, hotel_id, room_id,
          guest_name, guest_email, guest_phone, check_in, check_out,
          nights, rooms_count, adults, children, total_price_vnd,
          special_requests, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        this.sqliteDb.run(
          sql,
          [
            id, booking_code, user_id, hotel_id, room_type_id,
            customer_name, customer_email, customer_phone, check_in, check_out,
            1, rooms_count, guests_count, 0, total_price,
            special_requests || '', status
          ],
          (err) => {
            if (err) reject(err);
            else resolve(data);
          }
        );
      });
    }
  }

  async updateBookingStatus(id, status, paymentId = null) {
    if (this.mode === 'mysql') {
      await this.pool.query(
        'UPDATE bookings SET status = ?, payment_id = COALESCE(?, payment_id) WHERE id = ?',
        [status, paymentId, id]
      );
      return this.getBookingById(id);
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'UPDATE bookings SET status = ? WHERE id = ? OR booking_code = ?',
          [status, id, id],
          (err) => {
            if (err) reject(err);
            else resolve(this.getBookingById(id));
          }
        );
      });
    }
  }

  async getBookingById(id) {
    if (this.mode === 'mysql') {
      const [rows] = await this.pool.query('SELECT * FROM bookings WHERE id = ? OR booking_code = ? LIMIT 1', [id, id]);
      return rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT * FROM bookings WHERE id = ? OR booking_code = ? LIMIT 1', [id, id], (err, row) => {
          if (err) reject(err);
          else {
            if (!row) return resolve(null);
            resolve({
              ...row,
              customer_name: row.customer_name || row.guest_name,
              customer_email: row.customer_email || row.guest_email,
              customer_phone: row.customer_phone || row.guest_phone,
              room_type_id: row.room_type_id || row.room_id,
              total_price: row.total_price || row.total_price_vnd
            });
          }
        });
      });
    }
  }

  async getBookingsByUser(userId, email = null) {
    if (this.mode === 'mysql') {
      const [rows] = await this.pool.query(
        'SELECT * FROM bookings WHERE user_id = ? OR customer_email = ? ORDER BY created_at DESC',
        [userId, email]
      );
      return rows;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all(
          'SELECT * FROM bookings WHERE user_id = ? OR guest_email = ? ORDER BY created_at DESC',
          [userId, email],
          (err, rows) => {
            if (err) reject(err);
            else {
              const mapped = (rows || []).map(r => ({
                ...r,
                customer_name: r.customer_name || r.guest_name,
                customer_email: r.customer_email || r.guest_email,
                customer_phone: r.customer_phone || r.guest_phone,
                room_type_id: r.room_type_id || r.room_id,
                total_price: r.total_price || r.total_price_vnd
              }));
              resolve(mapped);
            }
          }
        );
      });
    }
  }

  async getAllBookings() {
    if (this.mode === 'mysql') {
      const [rows] = await this.pool.query('SELECT * FROM bookings ORDER BY created_at DESC');
      return rows;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all('SELECT * FROM bookings ORDER BY created_at DESC', [], (err, rows) => {
          if (err) reject(err);
          else {
            const mapped = (rows || []).map(r => ({
              ...r,
              customer_name: r.customer_name || r.guest_name,
              customer_email: r.customer_email || r.guest_email,
              customer_phone: r.customer_phone || r.guest_phone,
              room_type_id: r.room_type_id || r.room_id,
              total_price: r.total_price || r.total_price_vnd
            }));
            resolve(mapped);
          }
        });
      });
    }
  }
}
