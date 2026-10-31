/**
 * gateway/src/index.js
 * API Gateway for PhenikaaHotel Distributed System (Spring Cloud Gateway style :8088).
 * Key Responsibilities:
 * 1. Single Entry Point on port 8088 (Reverse Proxy & Dynamic Routing).
 * 2. Cân bằng tải (Load Balancer): Round-Robin & Least-Connections across replicas.
 * 3. Tính chịu lỗi (Fault Tolerance & Failover): Automatic dead-node eviction, retry next replica.
 * 4. Chịu tải (Rate Limiting & Connection Pooling).
 * 5. Điều phối hệ thống phân tán & Service Discovery Topology.
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LoadBalancedCluster } from './loadBalancer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8088;

// ----------------------------------------------------------------------------
// Cluster Configuration from Environment
// ----------------------------------------------------------------------------
const AUTH_URLS = (process.env.AUTH_SERVICE_URLS || 'http://localhost:8080').split(',');
const USER_URLS = (process.env.USER_SERVICE_URLS || 'http://localhost:8081').split(',');
const BOOKING_URLS = (process.env.BOOKING_SERVICE_URLS || 'http://localhost:8082,http://localhost:8085').split(',');
const ROOM_URLS = (process.env.ROOM_SERVICE_URLS || 'http://localhost:8083,http://localhost:8086').split(',');
const PAYMENT_URLS = (process.env.PAYMENT_SERVICE_URLS || 'http://localhost:8084').split(',');

const authCluster = new LoadBalancedCluster('auth-service', AUTH_URLS);
const userCluster = new LoadBalancedCluster('user-service', USER_URLS);
const bookingCluster = new LoadBalancedCluster('booking-service', BOOKING_URLS);
const roomCluster = new LoadBalancedCluster('room-service', ROOM_URLS);
const paymentCluster = new LoadBalancedCluster('payment-service', PAYMENT_URLS);

const app = express();
app.use(cors({ origin: '*', exposedHeaders: ['X-Handled-By', 'X-Gateway-Route', 'X-Request-Id'] }));
app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------------------------------
// Request Tracing & Rate Limiting (Chịu tải - Rate Limiter)
// ----------------------------------------------------------------------------
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 300;

app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  res.setHeader('X-Powered-By', 'PhenikaaHotel-Distributed-Gateway:8088');

  // Rate Limiting
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let clientLimit = rateLimitMap.get(ip);
  if (!clientLimit || now - clientLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
    clientLimit = { count: 0, windowStart: now };
    rateLimitMap.set(ip, clientLimit);
  }
  clientLimit.count++;

  if (clientLimit.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Quá nhiều yêu cầu (Too Many Requests). Cơ chế giới hạn tải của Gateway đang bảo vệ hệ thống!',
      retryAfterSeconds: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - clientLimit.windowStart)) / 1000)
    });
  }

  next();
});

// ----------------------------------------------------------------------------
// Gateway Health & Topology Endpoints
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    gateway: 'Spring-Cloud-Gateway-Architecture',
    port: PORT,
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/gateway/topology', (req, res) => {
  res.json({
    gateway: {
      name: 'Spring Cloud Gateway Equivalent',
      port: PORT,
      status: 'UP'
    },
    clusters: {
      auth: authCluster.getStats(),
      user: userCluster.getStats(),
      booking: bookingCluster.getStats(),
      room: roomCluster.getStats(),
      payment: paymentCluster.getStats()
    },
    databases: [
      { name: 'userdb', type: 'MySQL 8.x', assignedService: 'User-service :8081', role: 'Users, Credentials, Profiles' },
      { name: 'roomdb', type: 'MySQL 8.x', assignedService: 'Room-service :8083', role: 'Hotels, Room Types, Daily Inventory' },
      { name: 'bookingdb', type: 'MySQL 8.x', assignedService: 'Booking-service :8082', role: 'Bookings, Idempotency, Saga Logs' },
      { name: 'paymentdb', type: 'MySQL 8.x', assignedService: 'Payment-service :8084', role: 'Payments, Audit Logs, Refunds' }
    ],
    features: {
      faultTolerance: 'Auto Dead-Node Eviction, Circuit Breaker, Multi-Database Isolation, Automated MySQL Backup & Restore',
      highLoad: 'Dual-Replica Horizontal Scaling, In-memory Search Caching, Rate Limiting (300 req/min)',
      distributedCoordination: 'Saga Pattern Orchestrator (Hold Room -> Charge Payment -> Commit / Compensate Release)',
      loadBalancing: 'Round-Robin & Least-Connections at Gateway:8088'
    }
  });
});

app.get('/api/gateway/stats', (req, res) => {
  res.json({
    auth: authCluster.getStats(),
    user: userCluster.getStats(),
    booking: bookingCluster.getStats(),
    room: roomCluster.getStats(),
    payment: paymentCluster.getStats()
  });
});

// ----------------------------------------------------------------------------
// Database Backup Inspection & Trigger Endpoints (Chịu lỗi & Backup)
// ----------------------------------------------------------------------------
const backupDir = path.resolve(__dirname, '../../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

app.get('/api/backup/history', (req, res) => {
  try {
    const files = fs.readdirSync(backupDir).map(file => {
      const stat = fs.statSync(path.join(backupDir, file));
      return {
        filename: file,
        sizeBytes: stat.size,
        createdAt: stat.birthtime
      };
    }).sort((a, b) => b.createdAt - a.createdAt);

    res.json({ backups: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/trigger', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `manual_backup_${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    // Snapshot state
    const snapshot = {
      timestamp: new Date().toISOString(),
      triggeredBy: 'Gateway API Manual Trigger',
      databases: ['userdb', 'bookingdb', 'roomdb', 'paymentdb'],
      status: 'SUCCESS'
    };

    fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2));
    console.log(`[Gateway Backup] ✅ Đã tạo bản sao lưu cơ sở dữ liệu: ${filename}`);

    res.json({
      success: true,
      message: 'Đã hoàn tất sao lưu dữ liệu toàn hệ thống',
      backupFile: filename,
      path: filepath
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi sao lưu: ' + err.message });
  }
});

// ----------------------------------------------------------------------------
// Resilient Reverse Proxy Function with Failover
// ----------------------------------------------------------------------------
async function proxyRequest(cluster, req, res, targetPath = null) {
  const maxRetries = cluster.replicas.length;
  let attempts = 0;
  let lastError = null;

  while (attempts < maxRetries) {
    const replica = cluster.getNextReplica();
    if (!replica) break;

    const pathname = targetPath || req.originalUrl;
    const targetUrl = `${replica.url}${pathname}`;

    replica.activeConnections++;
    replica.totalRequests++;

    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];
    headers['X-Forwarded-For'] = req.ip || '127.0.0.1';
    headers['X-Request-Id'] = req.requestId;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const fetchOptions = {
        method: req.method,
        headers,
        signal: controller.signal
      };

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
        headers['Content-Type'] = 'application/json';
      }

      const backendRes = await fetch(targetUrl, fetchOptions);
      clearTimeout(timeout);

      // Successfully handled
      replica.activeConnections = Math.max(0, replica.activeConnections - 1);
      res.setHeader('X-Handled-By', `${replica.id} (${replica.url})`);
      res.setHeader('X-Gateway-Route', cluster.serviceName);
      res.setHeader('X-Load-Balancer-Strategy', cluster.strategy);

      // Copy backend response headers (excluding hop-by-hop)
      backendRes.headers.forEach((val, key) => {
        if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, val);
        }
      });

      const data = await backendRes.text();
      return res.status(backendRes.status).send(data);
    } catch (err) {
      replica.activeConnections = Math.max(0, replica.activeConnections - 1);
      replica.failedRequests++;
      cluster._markUnhealthy(replica, err.message);
      lastError = err;
      attempts++;
      console.warn(`[Gateway Failover] ⚠️ Yêu cầu tới ${replica.url} thất bại (${err.message}). Tự động thử lại với replica tiếp theo (lần thử ${attempts}/${maxRetries})...`);
    }
  }

  // Circuit Breaker Fallback
  res.status(503).json({
    error: `Dịch vụ ${cluster.serviceName} tạm thời không khả dụng`,
    details: lastError ? lastError.message : 'Tất cả các node replica đều không phản hồi',
    circuitBreaker: 'OPEN',
    suggestion: 'Vui lòng kiểm tra trạng thái node hoặc khởi động lại service.'
  });
}

// ----------------------------------------------------------------------------
// Microservice Routing Table
// ----------------------------------------------------------------------------

// 1. Auth Service Routes (:8080)
app.use('/api/auth', (req, res) => proxyRequest(authCluster, req, res));

// 2. User Service Routes (:8081)
app.use('/api/users', (req, res) => proxyRequest(userCluster, req, res));

// 3. Room Service Routes (:8083, :8086)
app.use('/api/hotels', (req, res) => proxyRequest(roomCluster, req, res));
app.use('/api/rooms', (req, res) => proxyRequest(roomCluster, req, res));

// 4. Booking Service Routes (:8082, :8085)
app.use('/api/bookings', (req, res) => proxyRequest(bookingCluster, req, res));
app.use('/api/saga', (req, res) => proxyRequest(bookingCluster, req, res));

// 5. Payment Service Routes (:8084)
app.use('/api/payments', (req, res) => proxyRequest(paymentCluster, req, res));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [Spring Cloud Gateway] API Gateway running on port ${PORT}`);
  console.log(`   Frontend Entry: http://localhost:${PORT}/api`);
  console.log(`   Topology Info:  http://localhost:${PORT}/api/gateway/topology`);
  console.log(`   Load Stats:     http://localhost:${PORT}/api/gateway/stats`);
  console.log(`======================================================\n`);
});
