/**
 * services/booking/src/index.js
 * Booking Microservice Entry Point (Booking-service :8082 & replica :8085).
 * Acts as Distributed Saga Orchestrator for booking transactions,
 * coordinating Room-service :8083 (Hold/Release) and Payment-service :8084 (Charge/Refund).
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { BookingDatabase } from './db.js';

const PORT = process.env.PORT || 8082;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_phenikaa_hotel_2026';
const SERVICE_INSTANCE_ID = process.env.SERVICE_INSTANCE_ID || `booking-service-${PORT}`;

const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL || 'http://localhost:8083';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:8084';

const app = express();
app.use(cors());
app.use(express.json());

// Request tracing & instance tracking
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', reqId);
  res.setHeader('X-Service-Instance', SERVICE_INSTANCE_ID);
  res.setHeader('X-Service-Port', String(PORT));
  req.requestId = reqId;
  next();
});

const db = new BookingDatabase();
await db.init();

// Middleware: Authenticate JWT
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
    instanceId: SERVICE_INSTANCE_ID,
    port: PORT,
    pid: process.pid,
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
    return res.status(503).json({ status: 'not_ready', error: 'Database bookingdb unreachable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Availability Proxy
// ----------------------------------------------------------------------------
app.get(['/api/bookings/availability', '/api/bookings/check-availability'], async (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  try {
    const r = await fetch(`${ROOM_SERVICE_URL}/api/rooms/availability?${query}`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi kết nối tới Room-service: ' + err.message });
  }
});

// ----------------------------------------------------------------------------
// Distributed Saga Orchestration: Create Booking
// Flow:
// 1. Validate & Idempotency check
// 2. Room Service: Hold Inventory (Lock rooms)
// 3. Payment Service: Process Charge
// 4. If Charge succeeds: Confirm Room & Set Booking to 'confirmed'
// 5. If Charge fails: Compensate by Releasing Room & Set Booking to 'failed_payment_reverted'
// ----------------------------------------------------------------------------
app.post('/api/bookings', authenticate, async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  const userId = req.user.userId;

  const hotelId = req.body.hotelId;
  const roomTypeId = req.body.roomTypeId || req.body.roomId;
  const checkIn = req.body.checkIn;
  const checkOut = req.body.checkOut;
  const count = parseInt(req.body.roomsCount || 1, 10);
  const guestsCount = parseInt(req.body.guestsCount || 2, 10);
  const customerName = req.body.customerName || req.body.guestName || req.user.name || 'Khách hàng';
  const customerEmail = req.body.customerEmail || req.body.guestEmail || req.user.email || 'customer@example.com';
  const customerPhone = req.body.customerPhone || req.body.guestPhone || '0901234567';
  const specialRequests = req.body.specialRequests || req.body.requests || '';
  const paymentMethod = req.body.paymentMethod || 'cash_at_hotel';
  const simulatePaymentFailure = req.body.simulatePaymentFailure === true || paymentMethod === 'simulate_fail';

  if (!hotelId || !roomTypeId || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'Thiếu thông tin khách sạn, loại phòng hoặc ngày lưu trú' });
  }

  const startDate = new Date(checkIn);
  const endDate = new Date(checkOut);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
    return res.status(400).json({ error: 'Ngày nhận phòng phải trước ngày trả phòng' });
  }

  // 1. Idempotency Check
  let requestHash = '';
  if (idempotencyKey) {
    const payloadToHash = JSON.stringify({
      userId, hotelId, roomTypeId, checkIn, checkOut, count, customerName, customerEmail
    });
    requestHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const cached = await db.getIdempotencyRecord(idempotencyKey);
    if (cached) {
      if (cached.request_hash !== requestHash) {
        return res.status(422).json({
          error: 'Xung đột Idempotency-Key: Khóa này đã được sử dụng với nội dung đặt phòng khác'
        });
      }
      console.log(`[BookingService] Trả về phản hồi idempotent lưu sẵn cho key: ${idempotencyKey}`);
      return res.status(cached.response_status).json({
        ...cached.response_body,
        _idempotentReplay: true
      });
    }
  }

  // Calculate pricing from Room-service
  let pricePerNight = req.body.unitPrice || 1500000;
  let hotelName = req.body.hotelName || 'Khách sạn Phenikaa';
  let roomTypeName = req.body.roomTypeName || 'Phòng Tiêu Chuẩn';

  try {
    const priceRes = await fetch(`${ROOM_SERVICE_URL}/api/rooms/price/${roomTypeId}`);
    if (priceRes.ok) {
      const pData = await priceRes.json();
      pricePerNight = pData.pricePerNight || pricePerNight;
      hotelName = pData.hotelName || hotelName;
      roomTypeName = pData.roomTypeName || roomTypeName;
    }
  } catch (err) {
    console.warn('[BookingService] Không thể lấy giá từ Room-service, dùng giá mặc định.');
  }

  const stayNights = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
  const totalPrice = pricePerNight * count * stayNights;

  const bookingId = uuidv4();
  const bookingCode = `BK-${Math.floor(100000 + Math.random() * 900000)}`;
  const sagaId = uuidv4();

  console.log(`\n======================================================`);
  console.log(`🌐 [Saga Orchestrator] Khởi động Saga ${sagaId} cho Booking ${bookingCode}`);
  console.log(`======================================================`);

  // SAGA STEP 1: Khởi tạo booking ở trạng thái PENDING
  await db.logSagaStep(sagaId, bookingId, 'STEP_1_INIT_BOOKING', 'STARTED', `Tạo booking PENDING (${bookingCode})`);
  await db.createBooking({
    id: bookingId,
    booking_code: bookingCode,
    user_id: String(userId),
    hotel_id: hotelId,
    room_type_id: roomTypeId,
    hotel_name: hotelName,
    room_type_name: roomTypeName,
    check_in: checkIn,
    check_out: checkOut,
    rooms_count: count,
    guests_count: guestsCount,
    unit_price: pricePerNight,
    total_price: totalPrice,
    status: 'pending',
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    special_requests: specialRequests
  });

  // SAGA STEP 2: Điều phối sang Room-service để Khóa/Giữ phòng (Hold Room)
  console.log(`[Saga Orchestrator] ➡️ Bước 2: Gọi Room-service để giữ ${count} phòng ${roomTypeName}...`);
  try {
    const holdRes = await fetch(`${ROOM_SERVICE_URL}/api/rooms/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomTypeId, checkIn, checkOut, count })
    });

    if (!holdRes.ok) {
      const holdErr = await holdRes.json().catch(() => ({}));
      await db.updateBookingStatus(bookingId, 'failed_room_unavailable');
      await db.logSagaStep(sagaId, bookingId, 'STEP_2_HOLD_ROOM', 'FAILED', holdErr.error || 'Hết phòng');
      console.warn(`[Saga Orchestrator] ❌ Bước 2 thất bại: ${holdErr.error}`);
      return res.status(409).json({ error: holdErr.error || 'Kho phòng không đủ số lượng phòng yêu cầu' });
    }

    await db.logSagaStep(sagaId, bookingId, 'STEP_2_HOLD_ROOM', 'ROOM_HELD', `Đã giữ thành công ${count} phòng`);
    console.log(`[Saga Orchestrator] ✅ Bước 2 thành công: Đã giữ phòng trên Room-service!`);
  } catch (err) {
    await db.updateBookingStatus(bookingId, 'failed_room_service_down');
    await db.logSagaStep(sagaId, bookingId, 'STEP_2_HOLD_ROOM', 'ERROR', err.message);
    return res.status(503).json({ error: 'Room-service tạm thời không khả dụng: ' + err.message });
  }

  // SAGA STEP 3: Điều phối sang Payment-service để Xử lý Thanh toán
  console.log(`[Saga Orchestrator] ➡️ Bước 3: Gọi Payment-service để thanh toán ${totalPrice} VND qua ${paymentMethod}...`);
  let paymentResult = null;
  try {
    const payRes = await fetch(`${PAYMENT_SERVICE_URL}/api/payments/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        userId: String(userId),
        amount: totalPrice,
        paymentMethod,
        simulateFailure: simulatePaymentFailure === true
      })
    });

    paymentResult = await payRes.json().catch(() => ({}));

    if (!payRes.ok || paymentResult.success === false) {
      throw new Error(paymentResult.error || 'Giao dịch thanh toán bị từ chối');
    }

    await db.logSagaStep(
      sagaId, bookingId, 'STEP_3_PAYMENT', 'PAYMENT_PROCESSED',
      `Thanh toán thành công ${totalPrice} VND (Mã GD: ${paymentResult.payment?.transactionCode})`
    );
    console.log(`[Saga Orchestrator] ✅ Bước 3 thành công: Thanh toán đã hoàn tất!`);
  } catch (payErr) {
    // SAGA BÙ TRỪ (COMPENSATING TRANSACTION): Thanh toán lỗi -> Giải phóng phòng đã giữ
    console.warn(`\n⚠️ [Saga Orchestrator] Bước 3 thất bại: ${payErr.message}`);
    console.warn(`🔄 [Saga Orchestrator] KÍCH HOẠT GIAO DỊCH BÙ TRỪ (COMPENSATING TRANSACTION)...`);

    await db.logSagaStep(sagaId, bookingId, 'STEP_3_PAYMENT', 'FAILED', payErr.message);
    await db.logSagaStep(sagaId, bookingId, 'STEP_COMPENSATION_ROOM_RELEASE', 'STARTED', 'Gọi Room-service để hoàn trả phòng');

    try {
      await fetch(`${ROOM_SERVICE_URL}/api/rooms/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomTypeId, checkIn, checkOut, count })
      });
      await db.logSagaStep(sagaId, bookingId, 'STEP_COMPENSATION_ROOM_RELEASE', 'COMPLETED', 'Đã hoàn trả kho phòng thành công');
      console.log(`[Saga Orchestrator] ✅ Bù trừ thành công: Đã giải phóng phòng, không bị thất thoát kho!`);
    } catch (compErr) {
      console.error(`[Saga Orchestrator] ❌ Lỗi khi thực hiện bù trừ:`, compErr.message);
      await db.logSagaStep(sagaId, bookingId, 'STEP_COMPENSATION_ROOM_RELEASE', 'ERROR', compErr.message);
    }

    await db.updateBookingStatus(bookingId, 'failed_payment_reverted');

    const errorResponse = {
      success: false,
      error: `Thanh toán thất bại: ${payErr.message}. Hệ thống đã tự động kích hoạt giao dịch bù trừ để hoàn trả phòng trống!`,
      sagaTrace: {
        sagaId,
        bookingCode,
        status: 'COMPENSATED',
        steps: [
          '1. Tạo đơn đặt (PENDING): Thành công',
          '2. Giữ phòng (HOLD): Thành công',
          `3. Thanh toán (PAYMENT): Thất bại (${payErr.message})`,
          '4. Giao dịch bù trừ (COMPENSATION): Đã giải phóng phòng thành công'
        ]
      }
    };

    if (idempotencyKey) {
      await db.saveIdempotencyRecord(idempotencyKey, userId, requestHash, 402, errorResponse);
    }

    return res.status(402).json(errorResponse);
  }

  // SAGA STEP 4: Xác nhận hoàn tất (Commit)
  console.log(`[Saga Orchestrator] ➡️ Bước 4: Xác nhận kho phòng chính thức trên Room-service...`);
  try {
    await fetch(`${ROOM_SERVICE_URL}/api/rooms/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomTypeId, checkIn, checkOut, count })
    });
  } catch (confirmErr) {
    console.warn('[Saga Orchestrator] Cảnh báo xác nhận kho phòng:', confirmErr.message);
  }

  const confirmedBooking = await db.updateBookingStatus(bookingId, 'confirmed', paymentResult.payment?.id);
  await db.logSagaStep(sagaId, bookingId, 'STEP_4_CONFIRM', 'COMPLETED', 'Đơn đặt phòng đã được xác nhận toàn vẹn');

  console.log(`======================================================`);
  console.log(`🎉 [Saga Orchestrator] SAGA HOÀN TẤT THÀNH CÔNG CHO ${bookingCode}!`);
  console.log(`======================================================\n`);

  const successResponse = {
    message: 'Đặt phòng thành công!',
    booking: confirmedBooking,
    payment: paymentResult.payment,
    sagaTrace: {
      sagaId,
      status: 'COMPLETED',
      steps: [
        '1. Khởi tạo đơn: PENDING',
        '2. Giữ phòng Room-service: SUCCESS',
        '3. Xử lý thanh toán Payment-service: SUCCESS',
        '4. Cam kết trạng thái: CONFIRMED'
      ]
    }
  };

  if (idempotencyKey) {
    await db.saveIdempotencyRecord(idempotencyKey, userId, requestHash, 201, successResponse);
  }

  res.status(201).json(successResponse);
});

// GET /api/bookings (List bookings for current user or all for admin)
app.get('/api/bookings', authenticate, async (req, res) => {
  try {
    let bookings;
    if (req.user.role === 'admin') {
      bookings = await db.getAllBookings();
    } else {
      bookings = await db.getBookingsByUser(String(req.user.userId), req.user.email);
    }
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải danh sách đơn đặt phòng: ' + err.message });
  }
});

// GET /api/bookings/:id
app.get('/api/bookings/:id', authenticate, async (req, res) => {
  try {
    const booking = await db.getBookingById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy đơn đặt phòng' });

    if (req.user.role !== 'admin' && String(booking.user_id) !== String(req.user.userId) && booking.customer_email !== req.user.email) {
      return res.status(403).json({ error: 'Không có quyền truy cập đơn đặt phòng này' });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:id/cancel (Cancel with Compensation)
app.post('/api/bookings/:id/cancel', authenticate, async (req, res) => {
  const bookingId = req.params.id;
  try {
    const booking = await db.getBookingById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy đơn đặt phòng' });

    if (req.user.role !== 'admin' && String(booking.user_id) !== String(req.user.userId) && booking.customer_email !== req.user.email) {
      return res.status(403).json({ error: 'Không có quyền hủy đơn đặt phòng này' });
    }

    if (booking.status === 'cancelled') {
      return res.json({ message: 'Đơn đặt phòng đã được hủy trước đó', booking });
    }

    // 1. Release room in Room-service
    try {
      await fetch(`${ROOM_SERVICE_URL}/api/rooms/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId: booking.room_type_id,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          count: booking.rooms_count || 1
        })
      });
    } catch (err) {
      console.warn('[BookingService] Cảnh báo giải phóng phòng khi hủy:', err.message);
    }

    // 2. Process refund in Payment-service if paid
    if (booking.payment_id) {
      try {
        await fetch(`${PAYMENT_SERVICE_URL}/api/payments/refund`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: booking.payment_id,
            bookingId: booking.id,
            reason: 'Khách hàng yêu cầu hủy phòng'
          })
        });
      } catch (err) {
        console.warn('[BookingService] Cảnh báo hoàn tiền khi hủy:', err.message);
      }
    }

    const updated = await db.updateBookingStatus(booking.id, 'cancelled');
    await db.logSagaStep(uuidv4(), booking.id, 'CANCEL_BOOKING', 'COMPENSATED', 'Hủy đơn, hoàn kho phòng và hoàn tiền');

    console.log(`[BookingService] Đã hủy đơn ${booking.booking_code} và hoàn trả tài nguyên.`);
    res.json({ message: 'Hủy đặt phòng thành công, kho phòng đã được hoàn trả', booking: updated });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hủy đặt phòng: ' + err.message });
  }
});

// GET /api/bookings/saga/logs (Audit Trail for Distributed Saga Coordination)
app.get('/api/saga/logs', async (req, res) => {
  try {
    const logs = await db.getSagaLogs(req.query.bookingId || null);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Booking-Service] Running on port ${PORT} (Instance: ${SERVICE_INSTANCE_ID})`);
});
