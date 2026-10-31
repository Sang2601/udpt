-- ============================================================================
-- USER SERVICE DATABASE (userdb) - MySQL 8.x
-- Hệ thống Phân tán PhenikaaHotel - Môn Ứng dụng Phân tán
-- ============================================================================

CREATE DATABASE IF NOT EXISTS userdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE userdb;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'user',
    phone VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed tài khoản mặc định (Admin và Khách hàng)
-- Mật khẩu mặc định: admin123 (cho admin) và user123 (cho khách hàng)
INSERT INTO users (name, email, password_hash, role, phone)
VALUES 
    ('Quản trị viên Phenikaa', 'admin@phenikaa.com', '$2a$10$K7L1OHm0P5j8e0N8qP3bReRzWdKj7f0A3g0B4y1C5t9E2i6G3k8wS', 'admin', '0901234567'),
    ('Nguyễn Văn Khách Hàng', 'khachhang@phenikaa.com', '$2a$10$K7L1OHm0P5j8e0N8qP3bReRzWdKj7f0A3g0B4y1C5t9E2i6G3k8wS', 'user', '0987654321')
ON DUPLICATE KEY UPDATE name=VALUES(name);

