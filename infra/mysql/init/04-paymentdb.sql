-- ============================================================================
-- PAYMENT SERVICE DATABASE (paymentdb) - MySQL 8.x
-- Hệ thống Phân tán PhenikaaHotel - Môn Ứng dụng Phân tán
-- ============================================================================

CREATE DATABASE IF NOT EXISTS paymentdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE paymentdb;

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(100) PRIMARY KEY,
    transaction_code VARCHAR(50) NOT NULL UNIQUE,
    booking_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    amount BIGINT NOT NULL,
    currency VARCHAR(10) DEFAULT 'VND',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'cash_at_hotel', -- 'momo', 'vnpay', 'credit_card', 'cash_at_hotel'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'refunded'
    gateway_reference VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_booking (booking_id),
    INDEX idx_payment_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_payment (payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Sample Payment
INSERT INTO payments (
    id, transaction_code, booking_id, user_id, amount, currency, payment_method, status, gateway_reference
) VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PAY-892104', 'b976e854-041a-52cf-bb80-df79390452e5', 
    '1', 21600000, 'VND', 'vnpay', 'success', 'VNPAY-TRANS-20261031-9921'
) ON DUPLICATE KEY UPDATE status=VALUES(status);

