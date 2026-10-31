/**
 * services/room/src/index.js
 * Room Microservice Entry Point (Room-service :8083 & replica :8086).
 * Handles hotel catalog, room inventory, live availability, in-memory caching,
 * and Saga Hold/Release coordination for distributed bookings.
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { RoomDatabase } from './db.js';

const PORT = process.env.PORT || 8083;
const SERVICE_INSTANCE_ID = process.env.SERVICE_INSTANCE_ID || `room-service-${PORT}`;

const app = express();
app.use(cors());
app.use(express.json());

// In-memory High Load Cache (Chịu tải - High-Throughput Caching)
const cache = new Map();
const CACHE_TTL_MS = 10000; // 10 seconds TTL

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlMs = CACHE_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function clearCache() {
  cache.clear();
}

// Request tracing & instance tracking header
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', reqId);
  res.setHeader('X-Service-Instance', SERVICE_INSTANCE_ID);
  res.setHeader('X-Service-Port', String(PORT));
  req.requestId = reqId;
  next();
});

const db = new RoomDatabase();
await db.init();

// ----------------------------------------------------------------------------
// Health & Readiness Endpoints
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'room-service',
    instanceId: SERVICE_INSTANCE_ID,
    port: PORT,
    pid: process.pid,
    cacheEntries: cache.size,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const isReady = await db.isHealthy();
    if (isReady) {
      return res.json({ status: 'ready', instanceId: SERVICE_INSTANCE_ID, dbMode: db.mode });
    }
    return res.status(503).json({ status: 'not_ready', error: 'Database roomdb unreachable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Hotels & Rooms Catalog (Cached for High Load Resilience)
// ----------------------------------------------------------------------------

// GET /api/hotels (or /api/rooms/hotels)
app.get(['/api/hotels', '/api/rooms/hotels', '/api/rooms'], async (req, res) => {
  const cacheKey = `hotels:${JSON.stringify(req.query)}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.setHeader('X-Cache-Hit', 'true');
    return res.json(cached);
  }

  try {
    const hotels = await db.getAllHotels(req.query);
    setCache(cacheKey, hotels);
    res.setHeader('X-Cache-Hit', 'false');
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải danh sách khách sạn: ' + err.message });
  }
});

// GET /api/hotels/:id
app.get(['/api/hotels/:id', '/api/rooms/hotels/:id'], async (req, res) => {
  const hotelId = req.params.id;
  try {
    const hotel = await db.getHotelById(hotelId);
    if (!hotel) {
      return res.status(404).json({ error: 'Không tìm thấy khách sạn' });
    }
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy xuất thông tin khách sạn: ' + err.message });
  }
});

// GET /api/rooms/availability
app.get('/api/rooms/availability', async (req, res) => {
  const { roomTypeId, checkIn, checkOut, roomsCount } = req.query;
  if (!roomTypeId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Thiếu tham số roomTypeId, checkIn hoặc checkOut' });
  }

  try {
    const count = parseInt(roomsCount || '1', 10);
    const result = await db.checkAvailability(roomTypeId, checkIn, checkOut, count);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi kiểm tra tình trạng phòng trống: ' + err.message });
  }
});

// Authoritative Price lookup
app.get('/api/rooms/price/:roomTypeId', async (req, res) => {
  try {
    const room = await db.getRoomTypeById(req.params.roomTypeId);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy loại phòng' });
    res.json({
      roomTypeId: room.id,
      roomTypeName: room.name,
      hotelName: room.hotel_name,
      pricePerNight: Number(room.price)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Saga Coordination Endpoints (Hold / Release / Confirm)
// ----------------------------------------------------------------------------

// Saga Step 2: Hold Room Inventory
app.post('/api/rooms/hold', async (req, res) => {
  const { roomTypeId, checkIn, checkOut, count } = req.body;
  if (!roomTypeId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Thiếu thông tin giữ phòng' });
  }

  try {
    const result = await db.holdRoom(roomTypeId, checkIn, checkOut, parseInt(count || '1', 10));
    clearCache(); // Invalidate search cache
    console.log(`[RoomService ${SERVICE_INSTANCE_ID}] Đã giữ ${count || 1} phòng cho roomType ${roomTypeId}`);
    res.json(result);
  } catch (err) {
    console.warn(`[RoomService ${SERVICE_INSTANCE_ID}] Giữ phòng thất bại:`, err.message);
    res.status(409).json({ error: err.message });
  }
});

// Saga Step 4 (Compensating): Release Held Room on Payment Failure / Cancellation
app.post('/api/rooms/release', async (req, res) => {
  const { roomTypeId, checkIn, checkOut, count } = req.body;
  try {
    const result = await db.releaseRoom(roomTypeId, checkIn, checkOut, parseInt(count || '1', 10));
    clearCache();
    console.log(`[RoomService ${SERVICE_INSTANCE_ID}] Giao dịch bù trừ: Đã giải phóng phòng ${roomTypeId}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi giải phóng phòng: ' + err.message });
  }
});

// Saga Step 4 (Commit): Confirm Booking Inventory
app.post('/api/rooms/confirm', async (req, res) => {
  const { roomTypeId, checkIn, checkOut, count } = req.body;
  try {
    const result = await db.confirmRoom(roomTypeId, checkIn, checkOut, parseInt(count || '1', 10));
    clearCache();
    console.log(`[RoomService ${SERVICE_INSTANCE_ID}] Đã xác nhận giữ phòng chính thức cho ${roomTypeId}`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xác nhận phòng: ' + err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Room-Service] Running on port ${PORT} (Instance: ${SERVICE_INSTANCE_ID})`);
});

