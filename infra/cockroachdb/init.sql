-- ==============================================================================
-- CockroachDB 3-Node Cluster Initialization Script
-- Databases: auth_db, hotel_db, booking_db, notification_db
-- Strict database-per-service isolation with dedicated service users
-- ==============================================================================

-- 1. Create Dedicated Service Users (Never use root in microservices)
CREATE USER IF NOT EXISTS auth_user WITH PASSWORD 'auth_secure_pass_2026';
CREATE USER IF NOT EXISTS hotel_user WITH PASSWORD 'hotel_secure_pass_2026';
CREATE USER IF NOT EXISTS booking_user WITH PASSWORD 'booking_secure_pass_2026';
CREATE USER IF NOT EXISTS notification_user WITH PASSWORD 'notif_secure_pass_2026';

-- 2. Databases Creation
CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS hotel_db;
CREATE DATABASE IF NOT EXISTS booking_db;
CREATE DATABASE IF NOT EXISTS notification_db;

-- 3. Grant Privileges
GRANT ALL ON DATABASE auth_db TO auth_user;
GRANT ALL ON DATABASE hotel_db TO hotel_user;
GRANT ALL ON DATABASE booking_db TO booking_user;
GRANT ALL ON DATABASE notification_db TO notification_user;

-- ==============================================================================
-- AUTH_DB SCHEMA (Auth Service)
-- ==============================================================================
\c auth_db;
GRANT ALL ON SCHEMA public TO auth_user;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- Strict role: 'user' by default
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- ==============================================================================
-- HOTEL_DB SCHEMA (Hotel Service)
-- ==============================================================================
\c hotel_db;
GRANT ALL ON SCHEMA public TO hotel_user;

CREATE TABLE IF NOT EXISTS hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    description TEXT,
    star_rating INT DEFAULT 3 CHECK (star_rating >= 1 AND star_rating <= 5),
    price_per_night DECIMAL(12, 2) NOT NULL,
    rating DECIMAL(3, 2) DEFAULT 4.50,
    review_count INT DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS hotel_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    display_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS amenities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS hotel_amenities (
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
    PRIMARY KEY (hotel_id, amenity_id)
);

CREATE TABLE IF NOT EXISTS room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL,
    capacity INT DEFAULT 2,
    total_rooms INT NOT NULL DEFAULT 10 CHECK (total_rooms > 0),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Logical ID, no foreign key across databases
    user_name VARCHAR(255) NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- ==============================================================================
-- BOOKING_DB SCHEMA (Booking Service)
-- Holds atomic daily inventory, bookings, idempotency keys, and transactional outbox
-- ==============================================================================
\c booking_db;
GRANT ALL ON SCHEMA public TO booking_user;

-- Daily inventory: primary concurrency protection against overbooking
CREATE TABLE IF NOT EXISTS room_daily_inventory (
    room_type_id UUID NOT NULL,
    stay_date DATE NOT NULL,
    total_rooms INT NOT NULL CHECK (total_rooms >= 0),
    booked_rooms INT NOT NULL DEFAULT 0 CHECK (booked_rooms >= 0),
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    PRIMARY KEY (room_type_id, stay_date),
    CONSTRAINT check_inventory_capacity CHECK (booked_rooms <= total_rooms)
);

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code VARCHAR(20) UNIQUE NOT NULL, -- Human-friendly lookup code (e.g. PK-849201)
    user_id UUID NOT NULL,
    hotel_id UUID NOT NULL,
    room_type_id UUID NOT NULL,
    hotel_name VARCHAR(255) NOT NULL,
    room_type_name VARCHAR(255) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    rooms_count INT NOT NULL DEFAULT 1 CHECK (rooms_count > 0),
    guests_count INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL, -- Authoritative frozen rate
    total_price DECIMAL(12, 2) NOT NULL, -- Frozen total calculated by backend
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed', -- confirmed, cancelled
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    special_requests TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Idempotency table: ensures duplicate requests with same Idempotency-Key return cached response
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(128) PRIMARY KEY,
    user_id UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Transactional Outbox: stores events in same CockroachDB transaction as the booking
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(50) NOT NULL, -- 'booking'
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- 'booking.created', 'booking.cancelled'
    payload JSONB NOT NULL,
    published BOOLEAN DEFAULT FALSE,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    published_at TIMESTAMPTZ
);

-- ==============================================================================
-- NOTIFICATION_DB SCHEMA (Notification Service)
-- ==============================================================================
\c notification_db;
GRANT ALL ON SCHEMA public TO notification_user;

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE NOT NULL, -- Idempotency key from outbox event
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'booking_confirmed', 'booking_cancelled'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    payload JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);
