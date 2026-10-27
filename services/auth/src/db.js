/**
 * services/auth/src/db.js
 * Resilient Database Adapter for Auth Service.
 * Connects to CockroachDB cluster (auth_db) via PostgreSQL driver (`pg`).
 * Gracefully falls back to local SQLite if CockroachDB is unreachable on host.
 */

import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteFallbackPath = path.resolve(__dirname, '../../../server/database/hotelbooking.sqlite');

export class AuthDatabase {
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
        console.log(`[AuthService DB] Connected to CockroachDB cluster (${this.connectionString.replace(/:[^:]*@/, ':****@')})`);
        return;
      } catch (err) {
        console.warn(`[AuthService DB] CockroachDB unreachable (${err.message}). Falling back to local SQLite adapter.`);
      }
    }

    // Fallback SQLite
    this.mode = 'sqlite';
    this.sqliteDb = new sqlite3.Database(sqliteFallbackPath);
    console.log(`[AuthService DB] Operating in local SQLite mode at ${sqliteFallbackPath}`);
  }

  async getUserByEmail(email) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
      return res.rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT * FROM users WHERE email = ? LIMIT 1', [email], (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    }
  }

  async getUserById(id) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query('SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1 LIMIT 1', [id]);
      return res.rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT id, name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    }
  }

  async createUser({ id, name, email, passwordHash, phone, role }) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query(
        'INSERT INTO users (id, name, email, password_hash, phone, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, role, created_at',
        [id, name, email, passwordHash, phone || null, role]
      );
      return res.rows[0];
    } else {
      return new Promise((resolve, reject) => {
        const stmt = this.sqliteDb.prepare(
          'INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, ?)'
        );
        stmt.run([name, email, passwordHash, phone || null, role], function(err) {
          if (err) return reject(err);
          resolve({
            id: String(this.lastID),
            name,
            email,
            phone: phone || null,
            role,
            created_at: new Date().toISOString()
          });
        });
        stmt.finalize();
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
