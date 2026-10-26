-- ============================================================================
-- HOTELBOOKING DATABASE SCHEMA
-- Hỗ trợ tương thích hoàn toàn cho: SQLite, MySQL 8.x / MariaDB, PostgreSQL
-- ============================================================================

-- Bảng 1: Người dùng (Tài khoản khách hàng và quản trị viên)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'user', -- 'user' hoặc 'admin'
    phone VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng 2: Khách sạn / Chỗ nghỉ
CREATE TABLE IF NOT EXISTS hotels (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'hotel', -- 'hotel', 'resort', 'apartment', 'villa'
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
    images_json TEXT, -- JSON array of image URLs
    room_type VARCHAR(255),
    bed_type VARCHAR(255),
    free_cancellation INTEGER DEFAULT 1,
    no_prepayment INTEGER DEFAULT 1,
    breakfast_included INTEGER DEFAULT 1,
    amenities_json TEXT, -- JSON array of amenities
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bảng 3: Các loại phòng thuộc khách sạn
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(100) PRIMARY KEY,
    hotel_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    size VARCHAR(50) DEFAULT '35 m²',
    price_vnd INTEGER NOT NULL,
    original_price_vnd INTEGER,
    capacity VARCHAR(100) DEFAULT '2 người lớn',
    breakfast INTEGER DEFAULT 1,
    total_units INTEGER DEFAULT 5, -- Số lượng phòng thực tế sẵn có
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- Bảng 4: Đơn đặt phòng
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
    status VARCHAR(50) DEFAULT 'confirmed', -- 'confirmed', 'cancelled', 'completed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Bảng 5: Đánh giá của khách (Mở rộng)
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id VARCHAR(100) NOT NULL,
    user_id INTEGER,
    user_name VARCHAR(150) NOT NULL,
    score DECIMAL(2,1) NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
);

-- Chỉ mục để tối ưu tốc độ tìm kiếm và kiểm tra phòng trống theo ngày
CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels(city);
CREATE INDEX IF NOT EXISTS idx_hotels_type ON hotels(type);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out, status);
CREATE INDEX IF NOT EXISTS idx_bookings_hotel ON bookings(hotel_id);
CREATE INDEX IF NOT EXISTS idx_bookings_code ON bookings(booking_code);
