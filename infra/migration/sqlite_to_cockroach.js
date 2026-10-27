/**
 * sqlite_to_cockroach.js
 * Migration tool converting legacy SQLite database to CockroachDB distributed schema.
 * Dynamically discovers tables in SQLite and safely extracts data.
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v5 as uuidv5 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NAMESPACE_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function toUuid(entityType, legacyId) {
  return uuidv5(`${entityType}:${legacyId}`, NAMESPACE_UUID);
}

const sqlitePath = path.resolve(__dirname, '../../server/database/hotelbooking.sqlite');
const outputSqlPath = path.resolve(__dirname, '../cockroachdb/seed_from_sqlite.sql');

if (!fs.existsSync(sqlitePath)) {
  console.error(`Source SQLite database not found at ${sqlitePath}`);
  process.exit(1);
}

const db = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Cannot open SQLite database:', err.message);
    process.exit(1);
  }
});

function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

async function runMigration() {
  console.log('='.repeat(70));
  console.log('  SQLITE TO COCKROACHDB MIGRATION & RE-SEEDING TOOL');
  console.log(`  Source: ${sqlitePath}`);
  console.log(`  Output: ${outputSqlPath}`);
  console.log('='.repeat(70));

  const tables = await queryAll("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const tableNames = new Set(tables.map(t => t.name));
  console.log('Discovered SQLite tables:', Array.from(tableNames));

  const stats = {
    users: 0,
    hotels: 0,
    rooms: 0,
    bookings: 0,
    reviews: 0,
    inventoryRecords: 0
  };

  const sqlStatements = [];
  sqlStatements.push('-- Generated CockroachDB Seed Data from SQLite migration\n');

  try {
    // 1. Users Migration -> auth_db
    if (tableNames.has('users')) {
      const users = await queryAll('SELECT * FROM users');
      sqlStatements.push('\\c auth_db;');
      for (const u of users) {
        const userUuid = toUuid('user', u.id);
        const role = u.role === 'admin' ? 'admin' : 'user';
        sqlStatements.push(
          `INSERT INTO users (id, name, email, password_hash, phone, role) VALUES ` +
          `('${userUuid}', ${escapeSql(u.name)}, ${escapeSql(u.email)}, ${escapeSql(u.password_hash || u.password)}, ${escapeSql(u.phone)}, '${role}') ` +
          `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email;`
        );
        stats.users++;
      }
    }

    // 2. Hotels Migration -> hotel_db
    if (tableNames.has('hotels')) {
      const hotels = await queryAll('SELECT * FROM hotels');
      sqlStatements.push('\n\\c hotel_db;');
      for (const h of hotels) {
        const hotelUuid = toUuid('hotel', h.id);
        let primaryImage = h.image_url || '';
        if (!primaryImage && h.images_json) {
          try {
            const imgs = JSON.parse(h.images_json);
            if (Array.isArray(imgs) && imgs.length > 0) primaryImage = imgs[0];
          } catch { /* ignore */ }
        }

        sqlStatements.push(
          `INSERT INTO hotels (id, name, city, address, description, star_rating, price_per_night, rating, review_count, image_url) VALUES ` +
          `('${hotelUuid}', ${escapeSql(h.name)}, ${escapeSql(h.city)}, ${escapeSql(h.address)}, ${escapeSql(h.description)}, ` +
          `${h.star_rating || 3}, ${h.price_vnd || 0}, ${h.review_score || 4.5}, ${h.review_count || 0}, ${escapeSql(primaryImage)}) ` +
          `ON CONFLICT (id) DO NOTHING;`
        );
        stats.hotels++;
      }
    }

    // 3. Rooms -> hotel_db
    if (tableNames.has('rooms')) {
      const rooms = await queryAll('SELECT * FROM rooms');
      for (const r of rooms) {
        const roomUuid = toUuid('room_type', r.id);
        const hotelUuid = toUuid('hotel', r.hotel_id);
        sqlStatements.push(
          `INSERT INTO room_types (id, hotel_id, name, description, price, capacity, total_rooms, image_url) VALUES ` +
          `('${roomUuid}', '${hotelUuid}', ${escapeSql(r.name)}, ${escapeSql(r.size || '')}, ` +
          `${r.price_vnd || 0}, 2, ${r.total_units || 10}, ${escapeSql(r.image_url || '')}) ` +
          `ON CONFLICT (id) DO NOTHING;`
        );
        stats.rooms++;
      }
    }

    // 4. Reviews -> hotel_db
    if (tableNames.has('reviews')) {
      const reviews = await queryAll('SELECT * FROM reviews');
      for (const rev of reviews) {
        const revUuid = toUuid('review', rev.id);
        const hotelUuid = toUuid('hotel', rev.hotel_id);
        const userUuid = rev.user_id ? toUuid('user', rev.user_id) : toUuid('user', 9999);
        sqlStatements.push(
          `INSERT INTO reviews (id, hotel_id, user_id, user_name, rating, comment) VALUES ` +
          `('${revUuid}', '${hotelUuid}', '${userUuid}', ${escapeSql(rev.user_name)}, ${Math.round(rev.score || 5)}, ${escapeSql(rev.comment)}) ` +
          `ON CONFLICT (id) DO NOTHING;`
        );
        stats.reviews++;
      }
    }

    // 5. Bookings & Daily Inventory -> booking_db
    if (tableNames.has('bookings')) {
      const bookings = await queryAll('SELECT * FROM bookings');
      sqlStatements.push('\n\\c booking_db;');

      const dailyInventoryMap = new Map();

      for (const b of bookings) {
        const bookingUuid = toUuid('booking', b.id);
        const userUuid = b.user_id ? toUuid('user', b.user_id) : toUuid('user', 1);
        const hotelUuid = toUuid('hotel', b.hotel_id);
        const roomUuid = toUuid('room_type', b.room_id);
        const bookingCode = b.booking_code || `PK-${String(b.id).padStart(6, '0')}`;

        sqlStatements.push(
          `INSERT INTO bookings (id, booking_code, user_id, hotel_id, room_type_id, hotel_name, room_type_name, ` +
          `check_in, check_out, rooms_count, guests_count, unit_price, total_price, status, customer_name, customer_email, customer_phone, special_requests) VALUES ` +
          `('${bookingUuid}', '${bookingCode}', '${userUuid}', '${hotelUuid}', '${roomUuid}', ` +
          `'Khách sạn', 'Phòng', '${b.check_in}', '${b.check_out}', ${b.rooms_count || 1}, ${b.adults || 2}, ` +
          `${b.total_price_vnd || 0}, ${b.total_price_vnd || 0}, '${b.status || 'confirmed'}', ` +
          `${escapeSql(b.guest_name || 'Khách hàng')}, ${escapeSql(b.guest_email || 'guest@example.com')}, ${escapeSql(b.guest_phone || '0901234567')}, ` +
          `${escapeSql(b.special_requests || '')}) ` +
          `ON CONFLICT (id) DO NOTHING;`
        );
        stats.bookings++;

        if (b.status === 'confirmed') {
          const start = new Date(b.check_in);
          const end = new Date(b.check_out);
          const curr = new Date(start);
          while (curr < end) {
            const dateStr = curr.toISOString().substring(0, 10);
            const invKey = `${roomUuid}:${dateStr}`;
            if (!dailyInventoryMap.has(invKey)) {
              dailyInventoryMap.set(invKey, { roomUuid, dateStr, total: 10, booked: 0 });
            }
            const item = dailyInventoryMap.get(invKey);
            item.booked += (b.rooms_count || 1);
            curr.setDate(curr.getDate() + 1);
          }
        }
      }

      for (const inv of dailyInventoryMap.values()) {
        sqlStatements.push(
          `INSERT INTO room_daily_inventory (room_type_id, stay_date, total_rooms, booked_rooms) VALUES ` +
          `('${inv.roomUuid}', '${inv.dateStr}', ${Math.max(inv.total, inv.booked)}, ${inv.booked}) ` +
          `ON CONFLICT (room_type_id, stay_date) DO UPDATE SET booked_rooms = EXCLUDED.booked_rooms;`
        );
        stats.inventoryRecords++;
      }
    }

    fs.writeFileSync(outputSqlPath, sqlStatements.join('\n'), 'utf8');

    console.log('\nMigration Completed Successfully:');
    console.log(`  - Users migrated:           ${stats.users}`);
    console.log(`  - Hotels migrated:          ${stats.hotels}`);
    console.log(`  - Rooms (Types) migrated:   ${stats.rooms}`);
    console.log(`  - Reviews migrated:         ${stats.reviews}`);
    console.log(`  - Bookings preserved:       ${stats.bookings}`);
    console.log(`  - Inventory slots computed: ${stats.inventoryRecords}`);
    console.log(`  - Output generated at:      ${outputSqlPath}`);
  } catch (err) {
    console.error('Migration failed with error:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

runMigration();
