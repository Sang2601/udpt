/**
 * services/booking/src/index.js
 * Booking Microservice Entry Point (Bài 1, Bài 2, Bài 3 & Bài 4).
 * Combines:
 * - Atomic multi-night daily inventory updates (anti-overbooking)
 * - CockroachDB serializable transaction retries (40001)
 * - Idempotency-Key support with cryptographic payload fingerprinting
 * - JSON-RPC 2.0 authoritative price lookup from Hotel Service
 * - Transactional Outbox event publishing
 * - Bounded Worker Pool (worker_threads) for CPU-bound analytics
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { BookingDatabase } from './db.js';
import { JsonRpcClient } from './rpc/jsonRpcClient.js';
import { OutboxPublisher } from './outbox/outboxPublisher.js';
import { WorkerPool } from './worker_pool/WorkerPool.js';

const PORT = process.env.PORT || 5003;
const INSTANCE_ID = process.env.SERVICE_INSTANCE_ID || `booking-node-${PORT}`;
const DATABASE_URL = process.env.DATABASE_URL || '';
const HOTEL_RPC_URL = process.env.HOTEL_RPC_URL || 'http://localhost:5002/rpc';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_phenikaa_hotel_2026';

const app = express();
app.use(cors());
app.use(express.json());

// Request tracing & instance tracking
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', reqId);
  res.setHeader('X-Served-By-Instance', INSTANCE_ID);
  req.requestId = reqId;
  next();
});

const db = new BookingDatabase(DATABASE_URL);
const rpcClient = new JsonRpcClient(HOTEL_RPC_URL, 4000);
const outboxPublisher = new OutboxPublisher(db);
const workerPool = new WorkerPool({ poolSize: 4, maxQueueSize: 50 });

// Helper: Authenticate JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu token xác thực' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// ----------------------------------------------------------------------------
// Health & Readiness Endpoints
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'booking-service',
    instanceId: INSTANCE_ID,
    pid: process.pid,
    workerPool: workerPool.getStatus(),
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const isDbReady = await db.isHealthy();
    if (isDbReady) {
      return res.json({ status: 'ready', instanceId: INSTANCE_ID, dbMode: db.mode });
    }
    return res.status(503).json({ status: 'not_ready', error: 'Database unavailable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Room Availability Inquiry Endpoint
// ----------------------------------------------------------------------------
app.get('/api/bookings/availability', async (req, res) => {
  try {
    const { roomTypeId, checkIn, checkOut, roomsCount } = req.query;
    if (!roomTypeId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Thiếu tham số roomTypeId, checkIn hoặc checkOut' });
    }

    const count = roomsCount ? parseInt(roomsCount, 10) : 1;
    const result = await db.checkAvailability(roomTypeId, checkIn, checkOut, count);
    return res.json(result);
  } catch (err) {
    console.error('[BookingService] Availability check error:', err);
    return res.status(500).json({ error: 'Lỗi kiểm tra tình trạng phòng trống' });
  }
});

// ----------------------------------------------------------------------------
// Create Booking with Idempotency & JSON-RPC Authoritative Pricing
// ----------------------------------------------------------------------------
app.post('/api/bookings', authenticate, async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  const userId = req.user.userId;

  try {
    const {
      hotelId, roomTypeId, checkIn, checkOut,
      roomsCount, guestsCount, customerName, customerEmail, customerPhone, specialRequests
    } = req.body;

    // 1. Validation
    if (!hotelId || !roomTypeId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Thiếu thông tin khách sạn, loại phòng hoặc ngày lưu trú' });
    }

    const count = parseInt(roomsCount || 1, 10);
    if (count <= 0) {
      return res.status(400).json({ error: 'Số lượng phòng phải lớn hơn 0' });
    }

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      return res.status(400).json({ error: 'Ngày nhận phòng phải trước ngày trả phòng' });
    }

    // 2. Idempotency Check
    let requestHash = '';
    if (idempotencyKey) {
      const payloadToHash = JSON.stringify({
        userId, hotelId, roomTypeId, checkIn, checkOut, count,
        customerName, customerEmail, customerPhone
      });
      requestHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

      const cached = await db.getIdempotencyRecord(idempotencyKey);
      if (cached) {
        if (cached.request_hash !== requestHash) {
          return res.status(422).json({
            error: 'Xung đột Idempotency-Key: Khóa này đã được sử dụng với nội dung đặt phòng khác'
          });
        }
        console.log(`[BookingService] Returning cached idempotent response for key: ${idempotencyKey}`);
        return res.status(cached.response_status).json({
          ...cached.response_body,
          _idempotentReplay: true
        });
      }
    }

    // 3. Authoritative Pricing lookup via JSON-RPC 2.0 (outside DB transaction)
    let rateInfo;
    try {
      rateInfo = await rpcClient.getAuthoritativePrice(roomTypeId);
    } catch (rpcErr) {
      console.warn(`[BookingService] RPC to Hotel Service failed (${rpcErr.message}). Using fallback catalog price.`);
      // If Hotel Service is unreachable, provide graceful fallback price if supplied in body
      rateInfo = {
        pricePerNight: req.body.unitPrice || 1200000,
        roomTypeName: req.body.roomTypeName || 'Tiêu chuẩn',
        hotelName: req.body.hotelName || 'Khách sạn'
      };
    }

    // Calculate stay nights and authoritative total price
    const stayDates = db._generateDateRange(checkIn, checkOut);
    const nights = stayDates.length;
    const unitPrice = Number(rateInfo.pricePerNight);
    const totalPrice = unitPrice * count * nights;

    // 4. Generate Identifiers (UUID + Human readable code)
    const bookingId = uuidv4();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const bookingCode = `PK-${randomSuffix}`;

    const bookingPayload = {
      id: bookingId,
      booking_code: bookingCode,
      user_id: userId,
      hotel_id: hotelId,
      room_type_id: roomTypeId,
      hotel_name: req.body.hotelName || rateInfo.hotelName || 'Khách sạn Phenikaa',
      room_type_name: req.body.roomTypeName || rateInfo.roomTypeName || 'Phòng',
      check_in: checkIn,
      check_out: checkOut,
      rooms_count: count,
      guests_count: parseInt(guestsCount || 2, 10),
      unit_price: unitPrice,
      total_price: totalPrice,
      customer_name: (customerName || req.user.name || 'Khách hàng').trim(),
      customer_email: (customerEmail || req.user.email || 'guest@example.com').trim(),
      customer_phone: (customerPhone || '0901234567').trim(),
      special_requests: specialRequests ? specialRequests.trim() : null
    };

    // 5. ATOMIC MULTI-NIGHT TRANSACTION
    const confirmedBooking = await db.createBookingAtomic({
      bookingData: bookingPayload,
      stayDates,
      defaultTotalRooms: rateInfo.totalRoomsInHotel || 10
    });

    const responseBody = {
      message: 'Đặt phòng thành công',
      booking: confirmedBooking,
      servedByInstance: INSTANCE_ID
    };

    // 6. Save Idempotency Record if key was provided
    if (idempotencyKey) {
      await db.saveIdempotencyRecord({
        key: idempotencyKey,
        userId,
        requestHash,
        status: 201,
        body: responseBody
      });
    }

    return res.status(201).json(responseBody);
  } catch (err) {
    console.error('[BookingService] Create booking error:', err);
    if (err.code === 'ROOM_UNAVAILABLE') {
      return res.status(409).json({ error: err.message, failedDate: err.failedDate });
    }
    return res.status(500).json({ error: 'Lỗi máy chủ khi tạo đơn đặt phòng' });
  }
});

// ----------------------------------------------------------------------------
// Get Bookings
// ----------------------------------------------------------------------------
app.get('/api/bookings', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const all = await db.getAllBookings();
      return res.json(all);
    } else {
      const userBookings = await db.getBookingsByUser(req.user.userId);
      return res.json(userBookings);
    }
  } catch (err) {
    console.error('[BookingService] Get bookings error:', err);
    return res.status(500).json({ error: 'Lỗi truy vấn danh sách đơn đặt phòng' });
  }
});

app.get('/api/bookings/:id', authenticate, async (req, res) => {
  try {
    const booking = await db.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Không tìm thấy đơn đặt phòng' });
    }
    if (req.user.role !== 'admin' && booking.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Không có quyền truy cập đơn đặt phòng này' });
    }
    return res.json(booking);
  } catch (err) {
    console.error(`[BookingService] Get booking ${req.params.id} error:`, err);
    return res.status(500).json({ error: 'Lỗi truy vấn chi tiết đơn đặt phòng' });
  }
});

// ----------------------------------------------------------------------------
// Cancel Booking (Atomic inventory return & idempotency)
// ----------------------------------------------------------------------------
app.post('/api/bookings/:id/cancel', authenticate, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'admin';

    const result = await db.cancelBookingAtomic(bookingId, userId, isAdmin);
    return res.json({
      message: result.alreadyCancelled ? 'Đơn đặt phòng này đã được hủy trước đó' : 'Hủy đơn đặt phòng thành công',
      booking: result
    });
  } catch (err) {
    console.error(`[BookingService] Cancel booking error:`, err);
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'FORBIDDEN') return res.status(403).json({ error: err.message });
    return res.status(500).json({ error: 'Lỗi khi hủy đơn đặt phòng' });
  }
});

// ----------------------------------------------------------------------------
// Analytical Reporting Endpoint (Bài 2: Worker Pool via worker_threads)
// ----------------------------------------------------------------------------
app.get('/api/bookings/admin/report', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Chỉ quản trị viên mới có quyền xem báo cáo thống kê' });
  }

  const jobId = `report-${Date.now()}-${uuidv4().substring(0, 8)}`;

  try {
    // 1. Main thread fetches raw booking dataset
    const bookings = await db.getAllBookings();

    // 2. Dispatch CPU-intensive calculation to bounded WorkerPool
    const reportData = await workerPool.execute(jobId, { bookings });

    return res.json(reportData);
  } catch (err) {
    console.error(`[BookingService] Analytics report failed for ${jobId}:`, err);
    if (err.message && err.message.includes('queue is saturated')) {
      return res.status(429).json({ error: 'Hệ thống đang quá tải tác vụ thống kê. Vui lòng thử lại sau giây lát.' });
    }
    return res.status(500).json({ error: 'Lỗi tính toán báo cáo thống kê' });
  }
});

// Start Server
db.init().then(() => {
  outboxPublisher.start().catch(err => console.warn('[BookingService] Outbox initial start warning:', err.message));

  app.listen(PORT, () => {
    console.log(`[BookingService] Microservice instance "${INSTANCE_ID}" running on port ${PORT} (PID: ${process.pid})`);
  });
}).catch(err => {
  console.error('[BookingService] Failed to start:', err);
  process.exit(1);
});
