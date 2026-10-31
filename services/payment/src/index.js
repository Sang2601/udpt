/**
 * services/payment/src/index.js
 * Payment Microservice Entry Point (Payment-service :8084).
 * Handles payment processing, transaction lifecycle, refund coordination,
 * and simulated failure modes for testing Distributed Saga rollbacks.
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { PaymentDatabase } from './db.js';

const PORT = process.env.PORT || 8084;
const SERVICE_INSTANCE_ID = process.env.SERVICE_INSTANCE_ID || `payment-service-${PORT}`;

const app = express();
app.use(cors());
app.use(express.json());

// Request tracing middleware
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', reqId);
  res.setHeader('X-Service-Instance', SERVICE_INSTANCE_ID);
  req.requestId = reqId;
  next();
});

const db = new PaymentDatabase();
await db.init();

// ----------------------------------------------------------------------------
// Health & Readiness Endpoints
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'payment-service',
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
    return res.status(503).json({ status: 'not_ready', error: 'Database paymentdb unreachable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Payment Endpoints
// ----------------------------------------------------------------------------

// Process Payment (Saga Step 3)
app.post('/api/payments/process', async (req, res) => {
  const { bookingId, userId, amount, paymentMethod = 'cash_at_hotel', simulateFailure = false } = req.body;

  if (!bookingId || !amount) {
    return res.status(400).json({ error: 'Thiếu bookingId hoặc số tiền thanh toán' });
  }

  const paymentId = uuidv4();
  const txSuffix = Math.floor(100000 + Math.random() * 900000);
  const transactionCode = `PAY-${txSuffix}`;

  // Kiểm tra mô phỏng lỗi thanh toán để kiểm chứng Saga Rollback
  if (simulateFailure === true || paymentMethod === 'simulate_fail') {
    console.warn(`[PaymentService] ⚠️ Mô phỏng thanh toán THẤT BẠI cho booking ${bookingId} để kích hoạt Saga Rollback!`);
    await db.createPayment({
      id: paymentId,
      transactionCode,
      bookingId,
      userId,
      amount,
      paymentMethod,
      status: 'failed',
      gatewayReference: 'ERR_SIMULATED_INSUFFICIENT_FUNDS'
    });

    return res.status(402).json({
      success: false,
      error: 'Giao dịch thanh toán bị từ chối (Mô phỏng lỗi tài khoản không đủ số dư)',
      paymentId,
      transactionCode,
      status: 'failed'
    });
  }

  // Xử lý thanh toán thành công
  try {
    const gatewayRef = `${paymentMethod.toUpperCase()}-REF-${Date.now()}`;
    const payment = await db.createPayment({
      id: paymentId,
      transactionCode,
      bookingId,
      userId,
      amount,
      paymentMethod,
      status: 'success',
      gatewayReference: gatewayRef
    });

    console.log(`[PaymentService] ✅ Thanh toán thành công ${amount} VND cho booking ${bookingId} qua ${paymentMethod}`);
    res.json({
      success: true,
      message: 'Thanh toán thành công',
      payment: {
        ...payment,
        gatewayReference: gatewayRef
      }
    });
  } catch (err) {
    console.error('[PaymentService] Lỗi xử lý thanh toán:', err.message);
    res.status(500).json({ error: 'Lỗi máy chủ xử lý thanh toán: ' + err.message });
  }
});

// Process Refund (Saga Compensation upon Cancellation)
app.post('/api/payments/refund', async (req, res) => {
  const { paymentId, bookingId, reason } = req.body;
  try {
    const payment = await db.getPaymentById(paymentId || bookingId);
    if (!payment) {
      return res.status(404).json({ error: 'Không tìm thấy giao dịch thanh toán để hoàn tiền' });
    }

    const updated = await db.updatePaymentStatus(payment.id, 'refunded', `REFUND-${Date.now()}`);
    console.log(`[PaymentService] 🔄 Đã hoàn tiền cho giao dịch ${payment.id} (Lý do: ${reason || 'Hủy phòng'})`);
    res.json({ success: true, message: 'Hoàn tiền thành công', payment: updated });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hoàn tiền: ' + err.message });
  }
});

// Get Payment Details
app.get('/api/payments/:id', async (req, res) => {
  try {
    const payment = await db.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Không tìm thấy thông tin thanh toán' });
    res.json({ payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Payment-Service] Running on port ${PORT} (Instance: ${SERVICE_INSTANCE_ID})`);
});

