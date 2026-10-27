/**
 * services/hotel/src/db.js
 * Resilient Database Adapter for Hotel Service.
 * Connects to CockroachDB cluster (hotel_db) or local SQLite fallback.
 */

import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteFallbackPath = path.resolve(__dirname, '../../../server/database/hotelbooking.sqlite');

export class HotelDatabase {
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
        console.log(`[HotelService DB] Connected to CockroachDB cluster (${this.connectionString.replace(/:[^:]*@/, ':****@')})`);
        return;
      } catch (err) {
        console.warn(`[HotelService DB] CockroachDB unreachable (${err.message}). Falling back to local SQLite adapter.`);
      }
    }

    this.mode = 'sqlite';
    this.sqliteDb = new sqlite3.Database(sqliteFallbackPath);
    console.log(`[HotelService DB] Operating in local SQLite mode at ${sqliteFallbackPath}`);
  }

  async getHotels({ city, query, minPrice, maxPrice, stars, limit = 50, offset = 0 } = {}) {
    if (this.mode === 'cockroachdb') {
      let sql = 'SELECT * FROM hotels WHERE 1=1';
      const params = [];
      let pIdx = 1;

      if (city) {
        sql += ` AND LOWER(city) = LOWER($${pIdx++})`;
        params.push(city);
      }
      if (query) {
        sql += ` AND (LOWER(name) LIKE $${pIdx} OR LOWER(city) LIKE $${pIdx} OR LOWER(address) LIKE $${pIdx})`;
        params.push(`%${query.toLowerCase()}%`);
        pIdx++;
      }
      if (minPrice) {
        sql += ` AND price_per_night >= $${pIdx++}`;
        params.push(minPrice);
      }
      if (maxPrice) {
        sql += ` AND price_per_night <= $${pIdx++}`;
        params.push(maxPrice);
      }
      if (stars) {
        sql += ` AND star_rating = $${pIdx++}`;
        params.push(stars);
      }

      sql += ` ORDER BY star_rating DESC, rating DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
      params.push(limit, offset);

      const res = await this.pgPool.query(sql, params);
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        let sql = 'SELECT * FROM hotels WHERE 1=1';
        const params = [];

        if (city) {
          sql += ' AND LOWER(city) = LOWER(?)';
          params.push(city);
        }
        if (query) {
          sql += ' AND (LOWER(name) LIKE ? OR LOWER(city) LIKE ? OR LOWER(address) LIKE ?)';
          params.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`);
        }
        if (minPrice) {
          sql += ' AND price_vnd >= ?';
          params.push(minPrice);
        }
        if (maxPrice) {
          sql += ' AND price_vnd <= ?';
          params.push(maxPrice);
        }
        if (stars) {
          sql += ' AND star_rating = ?';
          params.push(stars);
        }

        sql += ' ORDER BY star_rating DESC, review_score DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        this.sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          // Normalize column names
          const normalized = (rows || []).map(r => ({
            ...r,
            price_per_night: r.price_vnd || r.price_per_night,
            rating: r.review_score || r.rating
          }));
          resolve(normalized);
        });
      });
    }
  }

  async getHotelById(id) {
    if (this.mode === 'cockroachdb') {
      const hRes = await this.pgPool.query('SELECT * FROM hotels WHERE id = $1 LIMIT 1', [id]);
      if (!hRes.rows[0]) return null;
      const hotel = hRes.rows[0];

      const rRes = await this.pgPool.query('SELECT * FROM room_types WHERE hotel_id = $1', [id]);
      hotel.rooms = rRes.rows;
      return hotel;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT * FROM hotels WHERE id = ? LIMIT 1', [id], (err, hotel) => {
          if (err) return reject(err);
          if (!hotel) return resolve(null);

          this.sqliteDb.all('SELECT * FROM rooms WHERE hotel_id = ?', [id], (rErr, rooms) => {
            if (rErr) return reject(rErr);
            hotel.rooms = (rooms || []).map(r => ({
              ...r,
              price: r.price_vnd || r.price,
              total_rooms: r.total_units || r.total_rooms
            }));
            hotel.price_per_night = hotel.price_vnd || hotel.price_per_night;
            hotel.rating = hotel.review_score || hotel.rating;
            resolve(hotel);
          });
        });
      });
    }
  }

  async getRoomTypeById(id) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query('SELECT * FROM room_types WHERE id = $1 LIMIT 1', [id]);
      return res.rows[0] || null;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.get('SELECT * FROM rooms WHERE id = ? LIMIT 1', [id], (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          resolve({
            ...row,
            price: row.price_vnd || row.price,
            total_rooms: row.total_units || row.total_rooms
          });
        });
      });
    }
  }

  async getRoomsByHotelId(hotelId) {
    if (this.mode === 'cockroachdb') {
      const res = await this.pgPool.query('SELECT * FROM room_types WHERE hotel_id = $1', [hotelId]);
      return res.rows;
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all('SELECT * FROM rooms WHERE hotel_id = ?', [hotelId], (err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).map(r => ({
            ...r,
            price: r.price_vnd || r.price,
            total_rooms: r.total_units || r.total_rooms
          })));
        });
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
