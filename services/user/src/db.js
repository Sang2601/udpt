/**
 * services/user/src/db.js
 * Resilient Database Adapter for User Service (userdb).
 * Connects to MySQL (userdb) with connection pooling.
 * Falls back to local SQLite if MySQL is unreachable.
 */

import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteFallbackPath = path.resolve(__dirname, '../../../server/database/hotelbooking.sqlite');

export class UserDatabase {
  constructor(config = {}) {
    this.host = config.host || process.env.MYSQL_HOST || '127.0.0.1';
    this.port = parseInt(config.port || process.env.MYSQL_PORT || '33061', 10);
    this.user = config.user || process.env.MYSQL_USER || 'root';
    this.password = config.password || process.env.MYSQL_PASSWORD || 'rootpassword';
    this.database = config.database || process.env.MYSQL_DATABASE || 'userdb';
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

      // Ping to verify connection
      const conn = await this.pool.getConnection();
      await conn.ping();
      conn.release();

      this.mode = 'mysql';
      console.log(`[UserService DB] Connected to MySQL (userdb) at ${this.host}:${this.port}/${this.database}`);
      return;
    } catch (err) {
      console.warn(`[UserService DB] MySQL unreachable (${err.message}). Using resilient local SQLite fallback.`);
      this.mode = 'sqlite';
      this.sqliteDb = new sqlite3.Database(sqliteFallbackPath);
      console.log(`[UserService DB] Operating in local SQLite mode at ${sqliteFallbackPath}`);
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

  async getUserByEmail(email) {
    if (this.mode === 'mysql') {
      const [rows] = await this.pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
      return rows[0] || null;
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
    if (this.mode === 'mysql') {
      const [rows] = await this.pool.query(
        'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1',
        [id]
      );
      return rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get(
          'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ? LIMIT 1',
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
          }
        );
      });
    }
  }

  async createUser({ name, email, passwordHash, role = 'user', phone = '' }) {
    if (this.mode === 'mysql') {
      const [result] = await this.pool.query(
        'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
        [name, email, passwordHash, role, phone]
      );
      return { id: String(result.insertId), name, email, role, phone };
    } else {
      return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)';
        this.sqliteDb.run(sql, [name, email, passwordHash, role, phone], function (err) {
          if (err) reject(err);
          else resolve({ id: String(this.lastID), name, email, role, phone });
        });
      });
    }
  }

  async getAllUsers() {
    if (this.mode === 'mysql') {
      const [rows] = await this.pool.query('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC');
      return rows;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    }
  }

  async updateUserProfile(id, { name, phone }) {
    if (this.mode === 'mysql') {
      await this.pool.query('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?', [name, phone, id]);
      return this.getUserById(id);
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(
          'UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?',
          [name, phone, id],
          (err) => {
            if (err) reject(err);
            else resolve(this.getUserById(id));
          }
        );
      });
    }
  }
}

