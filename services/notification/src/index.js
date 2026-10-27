/**
 * services/notification/src/index.js
 * Notification Microservice Entry Point (Bài 1 & Bài 3).
 * Consumes RabbitMQ events and stores in-app notifications.
 * Exposes REST API for frontend notification fetching.
 */

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { NotificationDatabase } from './db.js';
import { NotificationConsumer } from './consumer.js';

const PORT = process.env.PORT || 5005;
const DATABASE_URL = process.env.DATABASE_URL || '';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://hotel_rabbit:rabbit_secure_pass_2026@localhost:5672';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_phenikaa_hotel_2026';

const app = express();
app.use(cors());
app.use(express.json());

// Request tracing middleware
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', reqId);
  req.requestId = reqId;
  next();
});

const db = new NotificationDatabase(DATABASE_URL);
const consumer = new NotificationConsumer(db, RABBITMQ_URL);

// Helper: JWT verification
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
    service: 'notification-service',
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const isDbReady = await db.isHealthy();
    if (isDbReady) {
      return res.json({ status: 'ready', dbMode: db.mode });
    }
    return res.status(503).json({ status: 'not_ready', error: 'Database unavailable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ----------------------------------------------------------------------------
// In-App Notifications REST API
// ----------------------------------------------------------------------------
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const notifs = await db.getNotificationsByUser(req.user.userId);
    return res.json(notifs);
  } catch (err) {
    console.error('[NotificationService] Get notifications error:', err);
    return res.status(500).json({ error: 'Lỗi truy vấn thông báo' });
  }
});

// Start Server
db.init().then(() => {
  consumer.start().catch(err => console.warn('[NotificationService] RabbitMQ consumer warning:', err.message));

  app.listen(PORT, () => {
    console.log(`[NotificationService] Microservice running on port ${PORT} (PID: ${process.pid})`);
  });
}).catch(err => {
  console.error('[NotificationService] Failed to start:', err);
  process.exit(1);
});
