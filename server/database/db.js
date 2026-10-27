import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, 'hotelbooking.sqlite');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Khởi tạo kết nối SQLite với chế độ đa tiến trình (WAL Mode & Busy Timeout)
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Lỗi kết nối SQLite:', err.message);
  } else {
    db.run('PRAGMA journal_mode = WAL;');
    db.run('PRAGMA busy_timeout = 10000;');
    db.run('PRAGMA synchronous = NORMAL;');
    console.log('✅ Đã kết nối cơ sở dữ liệu SQLite (Chế độ Phân tán WAL Concurrency):', DB_PATH);
  }
});

// Helper wrap SQLite callback thành Promise
export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Khởi tạo bảng và Seed dữ liệu ban đầu
export async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(30) DEFAULT 'user',
      phone VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS hotels (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) DEFAULT 'hotel',
      city VARCHAR(100) NOT NULL,
      address VARCHAR(255) NOT NULL,
      distance VARCHAR(255),
      beach_distance VARCHAR(255),
      star_rating INTEGER DEFAULT 4,
      review_score DECIMAL(3,1) DEFAULT 9.0,
      review_score_word VARCHAR(50) DEFAULT 'Tuyệt vời',
      review_count INTEGER DEFAULT 100,
      price_vnd INTEGER NOT NULL,
      original_price_vnd INTEGER,
      is_genius INTEGER DEFAULT 1,
      badge VARCHAR(255),
      images_json TEXT,
      room_type VARCHAR(255),
      bed_type VARCHAR(255),
      free_cancellation INTEGER DEFAULT 1,
      no_prepayment INTEGER DEFAULT 1,
      breakfast_included INTEGER DEFAULT 1,
      amenities_json TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id VARCHAR(100) PRIMARY KEY,
      hotel_id VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      size VARCHAR(50) DEFAULT '35 m²',
      price_vnd INTEGER NOT NULL,
      original_price_vnd INTEGER,
      capacity VARCHAR(100) DEFAULT '2 người lớn',
      breakfast INTEGER DEFAULT 1,
      total_units INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code VARCHAR(50) NOT NULL UNIQUE,
      user_id INTEGER,
      hotel_id VARCHAR(100) NOT NULL,
      room_id VARCHAR(100) NOT NULL,
      guest_name VARCHAR(150) NOT NULL,
      guest_email VARCHAR(191) NOT NULL,
      guest_phone VARCHAR(50) NOT NULL,
      check_in DATE NOT NULL,
      check_out DATE NOT NULL,
      nights INTEGER DEFAULT 1,
      rooms_count INTEGER DEFAULT 1,
      adults INTEGER DEFAULT 2,
      children INTEGER DEFAULT 0,
      total_price_vnd INTEGER NOT NULL,
      special_requests TEXT,
      payment_method VARCHAR(50) DEFAULT 'hotel',
      status VARCHAR(50) DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  // Seed Admin và User mẫu nếu chưa có
  const existingAdmin = await get(`SELECT id FROM users WHERE email = ?`, ['admin@phenikaa.com']);
  if (!existingAdmin) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('user123', 10);

    await run(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
      ['Quản Trị Viên Phenikaa', 'admin@phenikaa.com', adminHash, 'admin', '0901234567']
    );

    await run(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
      ['Khách Hàng Phenikaa', 'khachhang@phenikaa.com', userHash, 'user', '0987654321']
    );

    console.log('✅ Đã tạo tài khoản mẫu: admin@phenikaa.com (admin123) & khachhang@phenikaa.com (user123)');
  }

  // Seed khách sạn và phòng từ initialHotels nếu bảng hotels trống
  const hotelCount = await get(`SELECT COUNT(*) as count FROM hotels`);
  if (hotelCount.count === 0) {
    console.log('🔄 Đang nạp dữ liệu khách sạn và phòng mẫu vào cơ sở dữ liệu...');
    try {
      const { initialHotels } = await import('../../src/data/hotelsData.js');
      for (const h of initialHotels) {
        await run(`
          INSERT INTO hotels (
            id, name, type, city, address, distance, beach_distance, star_rating,
            review_score, review_score_word, review_count, price_vnd, original_price_vnd,
            is_genius, badge, images_json, room_type, bed_type, free_cancellation,
            no_prepayment, breakfast_included, amenities_json, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          h.id,
          h.name,
          h.type || 'hotel',
          h.city,
          h.address,
          h.distance || '',
          h.beachDistance || '',
          h.starRating || 4,
          h.reviewScore || 9.0,
          h.reviewScoreWord || 'Tuyệt hảo',
          h.reviewCount || 100,
          h.priceVND,
          h.originalPriceVND || h.priceVND,
          h.isGenius ? 1 : 0,
          h.badge || '',
          JSON.stringify(h.images || []),
          h.roomType || '',
          h.bedType || '',
          h.freeCancellation ? 1 : 0,
          h.noPrepayment ? 1 : 0,
          h.breakfastIncluded ? 1 : 0,
          JSON.stringify(h.amenities || []),
          h.description || ''
        ]);

        if (Array.isArray(h.rooms)) {
          for (const rm of h.rooms) {
            await run(`
              INSERT INTO rooms (
                id, hotel_id, name, size, price_vnd, original_price_vnd, capacity, breakfast, total_units
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              `${h.id}_${rm.id}`,
              h.id,
              rm.name,
              rm.size || '35 m²',
              rm.priceVND,
              rm.originalPriceVND || rm.priceVND,
              rm.capacity || '2 người lớn',
              rm.breakfast ? 1 : 0,
              5 // mỗi loại phòng có sẵn 5 phòng thực tế
            ]);
          }
        }
      }

      // Seed 2 đơn đặt phòng mẫu để xem ngay trong quản trị
      const today = new Date();
      const in2Days = new Date(today);
      in2Days.setDate(today.getDate() + 2);
      const in5Days = new Date(today);
      in5Days.setDate(today.getDate() + 5);

      const d1 = in2Days.toISOString().split('T')[0];
      const d2 = in5Days.toISOString().split('T')[0];

      await run(`
        INSERT INTO bookings (
          booking_code, user_id, hotel_id, room_id, guest_name, guest_email, guest_phone,
          check_in, check_out, nights, rooms_count, adults, children, total_price_vnd,
          special_requests, payment_method, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'BK-928174',
        2,
        'danang-intercon',
        'danang-intercon_r1',
        'Nguyễn Thành Nam',
        'khachhang@booking.com',
        '0987654321',
        d1,
        d2,
        3,
        1,
        2,
        0,
        28350000,
        'Nhận phòng muộn lúc 19h tối, tầng cao view thoáng',
        'hotel',
        'confirmed'
      ]);

      console.log('✅ Đã nạp thành công dữ liệu khách sạn, phòng và đơn mẫu vào SQLite!');
    } catch (importErr) {
      console.error('Lỗi khi nạp dữ liệu initialHotels:', importErr);
    }
  }
}

export default db;
