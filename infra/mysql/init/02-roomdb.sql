-- ============================================================================
-- ROOM SERVICE DATABASE (roomdb) - MySQL 8.x
-- Hệ thống Phân tán PhenikaaHotel - Môn Ứng dụng Phân tán
-- ============================================================================

CREATE DATABASE IF NOT EXISTS roomdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE roomdb;

CREATE TABLE IF NOT EXISTS hotels (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    description TEXT,
    star_rating INT DEFAULT 5,
    price_per_night BIGINT NOT NULL,
    rating DECIMAL(3,1) DEFAULT 9.0,
    review_count INT DEFAULT 100,
    image_url VARCHAR(500),
    images_json JSON,
    amenities JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_hotel_city (city),
    INDEX idx_hotel_star (star_rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_types (
    id VARCHAR(100) PRIMARY KEY,
    hotel_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price BIGINT NOT NULL,
    capacity INT DEFAULT 2,
    total_rooms INT DEFAULT 10,
    image_url VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_room_hotel (hotel_id),
    CONSTRAINT fk_room_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_daily_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_type_id VARCHAR(100) NOT NULL,
    stay_date DATE NOT NULL,
    total_rooms INT NOT NULL DEFAULT 10,
    booked_rooms INT NOT NULL DEFAULT 0,
    held_rooms INT NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_room_date (room_type_id, stay_date),
    INDEX idx_inventory_lookup (room_type_id, stay_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Hotels with Rich Photo Galleries
INSERT INTO hotels (id, name, city, address, description, star_rating, price_per_night, rating, review_count, image_url, images_json)
VALUES 
    ('ae1b1640-8374-58a7-b285-c3254de2bbc8', 'InterContinental Danang Sun Peninsula Resort', 'Đà Nẵng', 'Bán đảo Sơn Trà, Đà Nẵng, Việt Nam', 'Nằm ẩn mình trên những ngọn đồi xanh mướt của Bán đảo Sơn Trà nhìn ra vịnh biển riêng biệt, InterContinental Danang là kiệt tác kiến trúc của Bill Bensley kết hợp văn hóa truyền thống Việt Nam và sự xa hoa đương đại.', 5, 9450000, 9.6, 3420, 
     'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1000&q=80"]'),

    ('c93958e2-9e95-5c65-8234-1ba80bd559c7', 'Sofitel Legend Metropole Hanoi', 'Hà Nội', '15 Phố Ngô Quyền, Quận Hoàn Kiếm, Hà Nội', 'Biểu tượng lịch sử tráng lệ từ năm 1901 tại trung tâm thủ đô Hà Nội. Sofitel Legend Metropole mang đến nét quyến rũ tân cổ điển Pháp cùng lòng hiếu khách nồng hậu của Việt Nam.', 5, 7200000, 9.5, 4180, 
     'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80"]'),

    ('db2235de-a9c0-5396-97ad-19267872bdf7', 'The Reverie Saigon', 'TP. Hồ Chí Minh', '22-36 Đại lộ Nguyễn Huệ, Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Lộng lẫy với phong cách vương giả Ý, dịch vụ chuẩn quốc tế và tầm nhìn toàn cảnh sông Sài Gòn lung linh về đêm.', 5, 6850000, 9.7, 2950, 
     'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80"]'),

    ('5813a3df-50fb-5e8f-a141-a7cbb67a2d3f', 'Vinpearl Resort & Spa Phú Quốc', 'Phú Quốc', 'Bãi Dài, Gành Dầu, Phú Quốc, Kiên Giang', 'Khu nghỉ dưỡng nép mình bên Bãi Dài hoang sơ tuyệt đẹp, mang phong cách kiến trúc Á Đông với hồ bơi rộng lớn bậc nhất đảo ngọc.', 5, 2850000, 9.1, 3890, 
     'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80"]'),

    ('8baecc0c-68d4-5020-9e7a-147d52b40c71', 'Hôtel Colline Đà Lạt', 'Đà Lạt', 'Số 10 Phan Bội Châu, Phường 1, TP. Đà Lạt', 'Mang sắc thái kiến trúc Pháp tinh tế kết hợp nét trẻ trung hiện đại, chỉ vài bước chân tới Hồ Xuân Hương và Chợ đêm Đà Lạt.', 4, 1650000, 9.0, 3100, 
     'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80"]'),

    ('70e3348b-a200-5f7f-bfdf-4db75b71ce8d', 'Amiana Resort Nha Trang', 'Nha Trang', 'Hòn Rùa, Đường Phạm Văn Đồng, TP. Nha Trang', 'Hồ bơi nước biển tự nhiên lớn nhất Việt Nam và dịch vụ tắm bùn khoáng sang trọng bên vịnh biển riêng biệt.', 5, 3950000, 9.4, 2640, 
     'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80"]'),

    ('danang-novotel', 'Novotel Danang Premier Han River', 'Đà Nẵng', '36 Bạch Đằng, Quận Hải Châu, Đà Nẵng', 'Tọa lạc bên bờ tây sông Hàn thơ mộng, Novotel Danang Premier là khách sạn cao tầng sang trọng ngắm trọn vẹn những cây cầu biểu tượng.', 5, 2150000, 8.9, 2780,
     'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1000&q=80"]'),

    ('danang-muongthanh', 'Mường Thanh Luxury Đà Nẵng Hotel', 'Đà Nẵng', '270 Võ Nguyên Giáp, Phường Mỹ An, Quận Ngũ Hành Sơn, Đà Nẵng', 'Nằm ngay trên đại lộ biển Võ Nguyên Giáp, đối diện bãi biển Mỹ Khê xinh đẹp với hồ bơi vô cực ngắm trọn vịnh Đà Nẵng.', 5, 1250000, 8.8, 3120,
     'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80"]'),

    ('hoian-almanity', 'Almanity Hoi An Wellness Resort', 'Hội An', '326 Lý Thường Kiệt, Phường Minh An, TP. Hội An, Quảng Nam', 'Khu nghỉ dưỡng chăm sóc sức khỏe phong cách Zen độc đáo, bao quanh bởi hồ bơi nước mặn thanh khiết và khu vườn nhiệt đới.', 5, 2350000, 9.2, 1980,
     'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80"]'),

    ('sapa-silkpath', 'Silk Path Grand Resort & Spa Sapa', 'Sa Pa', 'Đồi Quan 6, Tổ 5, Thị xã Sa Pa, Lào Cai', 'Tọa lạc trên ngọn đồi riêng biệt, mang đậm nét kiến trúc Đông Dương trang nhã với tầm nhìn ôm trọn dãy Hoàng Liên Sơn hùng vĩ.', 5, 2450000, 9.3, 2140,
     'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1000&q=80"]'),

    ('hcm-caravelle', 'Caravelle Saigon', 'TP. Hồ Chí Minh', '19-23 Quảng trường Lam Sơn, Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Chứng nhân lịch sử mở cửa từ năm 1959, nằm ngay trung tâm thành phố đối diện Nhà hát Lớn TP.HCM.', 5, 3450000, 9.1, 2350,
     'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=80"]'),

    ('hanoi-lasiesta', 'La Siesta Classic Ma May Hanoi', 'Hà Nội', '94 Mã Mây, Quận Hoàn Kiếm, Hà Nội', 'Tọa lạc giữa lòng Phố Cổ Hà Nội nghìn năm văn hiến, hòa quyện giữa phong cách boutique truyền thống và dịch vụ chuẩn 5 sao.', 4, 1550000, 9.4, 2890,
     'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80',
     '["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80"]')
ON DUPLICATE KEY UPDATE name=VALUES(name), images_json=VALUES(images_json), image_url=VALUES(image_url);

-- Seed Room Types with Room Images
INSERT INTO room_types (id, hotel_id, name, description, price, capacity, total_rooms, image_url)
VALUES
    ('ff8ab0a4-9f0c-54af-93b9-0906dd0ecfc6', 'ae1b1640-8374-58a7-b285-c3254de2bbc8', 'Phòng Classic King Terrace Biển', '70 m², giường King cực rộng, view biển trực diện', 9450000, 2, 10, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'),
    ('e877401a-6c14-59e4-b994-9ef9e47b42f0', 'ae1b1640-8374-58a7-b285-c3254de2bbc8', 'Son Tra Terrace Suite Oceanview', '84 m², ban công ngắm hoàng hôn vịnh biển', 14200000, 2, 8, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=800&q=80'),
    ('9933333f-a2a7-52b6-a3f7-a0cc20ebec01', 'c93958e2-9e95-5c65-8234-1ba80bd559c7', 'Phòng Premium Wing Opera', '48 m², phong cách thuộc địa Pháp sang trọng', 7200000, 2, 10, 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'),
    ('d99ac8f5-f2f4-5581-8e96-2424c4663e93', 'c93958e2-9e95-5c65-8234-1ba80bd559c7', 'Grand Luxury Suite', '75 m², phòng khách riêng biệt và quản gia cá nhân', 12800000, 2, 5, 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80'),
    ('7a31123b-fb24-5360-8417-ba7a646c9e05', 'db2235de-a9c0-5396-97ad-19267872bdf7', 'Phòng Grand Deluxe River View', '53 m², tầm nhìn trọn vẹn sông Sài Gòn', 6850000, 2, 12, 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80'),
    ('7397acea-08c3-5dff-8aa1-3b0810dc4946', '5813a3df-50fb-5e8f-a141-a7cbb67a2d3f', 'Phòng Deluxe Garden View', '46 m², hướng vườn nhiệt đới xanh mát', 2850000, 2, 15, 'https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=800&q=80'),
    ('cd7773e2-7da8-512b-acb7-f137bc62c70f', '8baecc0c-68d4-5020-9e7a-147d52b40c71', 'Superior Double Room', '25 m², ấm cúng lãng mạn giữa lòng Đà Lạt', 1650000, 2, 15, 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'),
    ('f65dffe9-17e5-5b87-ac53-9458dd636f68', '70e3348b-a200-5f7f-bfdf-4db75b71ce8d', 'Deluxe Room Garden View', '55 m², phòng tắm lộ thiên và khu vườn nhỏ', 3950000, 2, 10, 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80')
ON DUPLICATE KEY UPDATE name=VALUES(name), image_url=VALUES(image_url);
