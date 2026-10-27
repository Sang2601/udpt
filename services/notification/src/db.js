/**
 * services/notification/src/db.js
 * Database Adapter for Notification Service (notification_db).
 * Supports CockroachDB and SQLite fallback.
 */

import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteFallbackPath = path.resolve(__dirname, '../../../server/database/hotelbooking.sqlite');

export class NotificationDatabase {
  constructor(connectionString) {
    this.connectionString = connectionString || process.env.DATABASE_URL;
    this.pgPool = null;
    this.sqliteDb = null;
    this.mode = 'uninitialized';
  }

  async init() {
    if (this.connectionString && !this.connectionString.startsWith('sqlite')) {
      try {
        const pool = new pg.Pool({
          connectionString: this.connectionString,
          connectionTimeoutMillis: 3000,
          max: 10
        });
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        this.pgPool = pool;
        this.mode = 'cockroachdb';
        console.log(`[NotificationService DB] Connected to CockroachDB cluster (${this.connectionString.replace(/:[^:]*@/, ':****@')})`);
        return;
      } catch (err) {
        console.warn(`[NotificationService DB] CockroachDB unreachable (${err.message}). Falling back to local SQLite adapter.`);
      }
    }

    this.mode = 'sqlite';
    this.sqliteDb = new sqlite3.Database(sqliteFallbackPath);
    await this._initSqlite();
    console.log(`[NotificationService DB] Operating in local SQLite mode at ${sqliteFallbackPath}`);
  }

  async _initSqlite() {
    return new Promise((resolve, reject) => {
      this.sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          event_id TEXT UNIQUE NOT NULL,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          payload TEXT,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, err => err ? reject(err) : resolve());
    });
  }

  async saveNotification({ id, eventId, userId, type, title, message, payload }) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query(
        `INSERT INTO notifications (id, event_id, user_id, type, title, message, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING *`,
        [id, eventId, userId, type, title, message, payload]
      );
      return res.rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        this.sqliteDb.run(
          `INSERT OR IGNORE INTO notifications (id, event_id, user_id, type, title, message, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, eventId, userId, type, title, message, payloadStr],
          function(err) {
            if (err) return reject(err);
            if (this.changes > 0) {
              resolve({ id, event_id: eventId, user_id: userId, type, title, message });
            } else {
              resolve(null); // Already processed (idempotent)
            }
          }
        );
      });
    }
  }

  async getNotificationsByUser(userId) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [userId]
      );
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all(
          'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
          [userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
    }
  }

  async isHealthy() {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query('SELECT 1');
      return !!res;
    }
    return !!this.sqliteDb;
  }
}
