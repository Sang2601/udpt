-- ============================================================================
-- BOOKING SERVICE DATABASE (bookingdb) - MySQL 8.x
-- Hệ thống Phân tán PhenikaaHotel - Môn Ứng dụng Phân tán
-- ============================================================================

CREATE DATABASE IF NOT EXISTS bookingdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bookingdb;

CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(100) PRIMARY KEY,
    booking_code VARCHAR(50) NOT NULL UNIQUE,
    user_id VARCHAR(100),
    hotel_id VARCHAR(100) NOT NULL,
    room_type_id VARCHAR(100) NOT NULL,
    hotel_name VARCHAR(255),
    room_type_name VARCHAR(255),
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    rooms_count INT DEFAULT 1,
    guests_count INT DEFAULT 2,
    unit_price BIGINT NOT NULL,
    total_price BIGINT NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled', 'completed'
    customer_name VARCHAR(150) NOT NULL,
    customer_email VARCHAR(191) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    special_requests TEXT,
    payment_id VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_booking_user (user_id),
    INDEX idx_booking_status (status),
    INDEX idx_booking_code (booking_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100),
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NOT NULL,
    response_body JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_idemp_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saga_coordination (
    id VARCHAR(100) PRIMARY KEY,
    booking_id VARCHAR(100) NOT NULL,
    current_step VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'STARTED', 'ROOM_HELD', 'PAYMENT_PROCESSED', 'COMPLETED', 'COMPENSATING', 'FAILED'
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_saga_booking (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Sample Bookings
INSERT INTO bookings (
    id, booking_code, user_id, hotel_id, room_type_id, 
    hotel_name, room_type_name, check_in, check_out, 
    rooms_count, guests_count, unit_price, total_price, 
    status, customer_name, customer_email, customer_phone, special_requests
) VALUES 
(
    'b976e854-041a-52cf-bb80-df79390452e5', 'BK-952471', '1', 
    'c93958e2-9e95-5c65-8234-1ba80bd559c7', '9933333f-a2a7-52b6-a3f7-a0cc20ebec01',
    'Sofitel Legend Metropole Hanoi', 'Phòng Premium Wing Opera',
    '2026-11-10', '2026-11-13', 1, 2, 7200000, 21600000, 
    'confirmed', 'Khách Hàng Phenikaa', 'khachhang@phenikaa.com', '0987654321', 'Tầng cao, phòng không hút thuốc'
) ON DUPLICATE KEY UPDATE status=VALUES(status);

