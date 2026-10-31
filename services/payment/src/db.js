/**
 * services/payment/src/db.js
 * Resilient Database Adapter for Payment Service (paymentdb).
 * Connects to MySQL (paymentdb) with connection pooling.
 * Falls back to local SQLite if MySQL is unreachable.
 */

import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteFallbackPath = path.resolve(__dirname, '../../../server/database/hotelbooking.sqlite');

export class PaymentDatabase {
  constructor(config = {}) {
    this.host = config.host || process.env.MYSQL_HOST || '127.0.0.1';
    this.port = parseInt(config.port || process.env.MYSQL_PORT || '33064', 10);
    this.user = config.user || process.env.MYSQL_USER || 'root';
    this.password = config.password || process.env.MYSQL_PASSWORD || 'rootpassword';
    this.database = config.database || process.env.MYSQL_DATABASE || 'paymentdb';
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
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 2000
      });

      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();

      this.mode = 'mysql';
      console.log(`[PaymentService DB] Connected to MySQL (paymentdb) at ${this.host}:${this.port}/${this.database}`);
      return;
    } catch (err) {
      console.warn(`[PaymentService DB] MySQL unreachable (${err.message}). Using resilient local SQLite fallback.`);
      this.mode = 'sqlite';
      this.sqliteDb = new sqlite3.Database(sqliteFallbackPath);
      // Ensure payment table in sqlite fallback
      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id VARCHAR(100) PRIMARY KEY,
          transaction_code VARCHAR(50) UNIQUE,
          booking_id VARCHAR(100),
          user_id VARCHAR(100),
          amount INTEGER,
          currency VARCHAR(10) DEFAULT 'VND',
          payment_method VARCHAR(50),
          status VARCHAR(50),
          gateway_reference VARCHAR(100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log(`[PaymentService DB] Operating in local SQLite mode at ${sqliteFallbackPath}`);
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

  async createPayment({ id, transactionCode, bookingId, userId, amount, currency = 'VND', paymentMethod, status, gatewayReference = '' }) {
    if (this.mode === 'mysql') {
      await this.pool.query(
        `INSERT INTO payments (id, transaction_code, booking_id, user_id, amount, currency, payment_method, status, gateway_reference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, transactionCode, bookingId, userId, amount, currency, paymentMethod, status, gatewayReference]
      );
      await this.pool.query(
        `INSERT INTO payment_audit_logs (payment_id, action, message) VALUES (?, ?, ?)`,
        [id, 'CHARGE_' + status.toUpperCase(), `Khởi tạo thanh toán ${amount} VND qua ${paymentMethod}`]
      );
      return { id, transactionCode, bookingId, amount, paymentMethod, status };
    } else {
      return new Promise((resolve, reject) => {
        const sql = `INSERT INTO payments (id, transaction_code, booking_id, user_id, amount, currency, payment_method, status, gateway_reference)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        this.sqliteDb.run(sql, [id, transactionCode, bookingId, userId, amount, currency, paymentMethod, status, gatewayReference], (err) => {
          if (err) reject(err);
          else resolve({ id, transactionCode, bookingId, amount, paymentMethod, status });
        });
      });
    }
  }

  async getPaymentById(id) {
    if (this.mode === 'mysql') {
      const [rows] = await this.pool.query('SELECT * FROM payments WHERE id = ? OR transaction_code = ? LIMIT 1', [id, id]);
      return rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT * FROM payments WHERE id = ? OR transaction_code = ? LIMIT 1', [id, id], (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    }
  }

  async updatePaymentStatus(id, status, gatewayReference = '') {
    if (this.mode === 'mysql') {
      await this.pool.query(
        'UPDATE payments SET status = ?, gateway_reference = COALESCE(?, gateway_reference) WHERE id = ?',
        [status, gatewayReference, id]
      );
      await this.pool.query(
        'INSERT INTO payment_audit_logs (payment_id, action, message) VALUES (?, ?, ?)',
        [id, 'STATUS_UPDATE_' + status.toUpperCase(), `Cập nhật trạng thái thành ${status}`]
      );
      return this.getPaymentById(id);
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run('UPDATE payments SET status = ? WHERE id = ?', [status, id], (err) => {
          if (err) reject(err);
          else resolve(this.getPaymentById(id));
        });
      });
    }
  }
}

