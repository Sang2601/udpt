/**
 * gateway/src/index.js
 * API Gateway for PhenikaaHotel Distributed System (Bài 1: Client-Server & Phân tầng).
 * Responsibilities:
 * - Single Entry Point for Frontend (all client traffic goes to http://localhost:5000/api)
 * - Domain routing:
 *     /api/auth/*          -> Auth Service (5001)
 *     /api/hotels/*        -> Hotel Service (5002)
 *     /api/bookings/*      -> Booking Service (5003, 5004) via Round-Robin Load Balancer
 *     /api/notifications/* -> Notification Service (5005)
 * - Request ID generation & propagation (X-Request-Id)
 * - Timeout handling (10,000ms deadline)
 * - Error normalization into consistent JSON envelope
 * - Replica health check & automatic dead-replica eviction
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const PORT = process.env.PORT || 5000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const HOTEL_SERVICE_URL = process.env.HOTEL_SERVICE_URL || 'http://localhost:5002';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5005';

// Booking replicas for horizontal load balancing
const bookingReplicaUrls = (process.env.BOOKING_REPLICAS || 'http://localhost:5003,http://localhost:5004')
  .split(',')
  .map(u => u.trim());

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------------------------------
// Request ID & Tracing Middleware
// ----------------------------------------------------------------------------
app.use((req, res, next) => {
  const reqId = req.headers['x-request-id'] || uuidv4();
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  res.setHeader('X-Powered-By', 'PhenikaaHotel-API-Gateway');
  next();
});

// ----------------------------------------------------------------------------
// Load Balancer for Booking Service Replicas
// ----------------------------------------------------------------------------
class ReplicaLoadBalancer {
  constructor(replicaUrls) {
    this.replicas = replicaUrls.map(url => ({
      url,
      healthy: true,
      lastChecked: 0,
      failures: 0
    }));
    this.currentIndex = 0;
    this._startHealthChecks();
  }

  getNextTarget() {
    const healthyReplicas = this.replicas.filter(r => r.healthy);
    const pool = healthyReplicas.length > 0 ? healthyReplicas : this.replicas;

    const target = pool[this.currentIndex % pool.length];
    this.currentIndex++;
    return target.url;
  }

  markFailure(url) {
    const item = this.replicas.find(r => r.url === url);
    if (item) {
      item.failures++;
      if (item.failures >= 2) {
        item.healthy = false;
        console.warn(`[LoadBalancer] Evicting unhealthy replica from pool: ${url}`);
      }
    }
  }

  markSuccess(url) {
    const item = this.replicas.find(r => r.url === url);
    if (item) {
      item.failures = 0;
      item.healthy = true;
    }
  }

  _startHealthChecks() {
    setInterval(async () => {
      for (const r of this.replicas) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(`${r.url}/health`, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            this.markSuccess(r.url);
          } else {
            this.markFailure(r.url);
          }
        } catch {
          this.markFailure(r.url);
        }
      }
    }, 5000);
  }

  getStatus() {
    return this.replicas.map(r => ({
      url: r.url,
      healthy: r.healthy,
      failures: r.failures
    }));
  }
}

const bookingBalancer = new ReplicaLoadBalancer(bookingReplicaUrls);

// ----------------------------------------------------------------------------
// Reverse Proxy Core Dispatcher
// ----------------------------------------------------------------------------
async function proxyRequest(req, res, targetBaseUrl, isBookingService = false) {
  const targetUrl = `${targetBaseUrl}${req.originalUrl}`;
  const controller = new AbortController();
  const timeoutMs = 10000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const forwardHeaders = {
    ...req.headers,
    'x-request-id': req.requestId,
    'host': new URL(targetBaseUrl).host
  };
  delete forwardHeaders['content-length'];

  const fetchOptions = {
    method: req.method,
    headers: forwardHeaders,
    signal: controller.signal
  };

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
    fetchOptions.body = JSON.stringify(req.body);
    forwardHeaders['content-type'] = 'application/json';
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timer);

    if (isBookingService) bookingBalancer.markSuccess(targetBaseUrl);

    // Propagate headers
    const contentType = response.headers.get('content-type') || 'application/json';
    res.setHeader('content-type', contentType);

    const servedBy = response.headers.get('x-served-by-instance');
    if (servedBy) res.setHeader('x-served-by-instance', servedBy);

    const bodyText = await response.text();
    return res.status(response.status).send(bodyText);
  } catch (err) {
    clearTimeout(timer);
    if (isBookingService) bookingBalancer.markFailure(targetBaseUrl);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Gateway Timeout: Dịch vụ đích không phản hồi trong thời gian quy định (10s)',
        statusCode: 504,
        requestId: req.requestId
      });
    }

    console.error(`[Gateway Proxy Error] Target: ${targetUrl}`, err.message);
    return res.status(502).json({
      error: `Bad Gateway: Không thể kết nối tới dịch vụ đích (${targetBaseUrl})`,
      details: err.message,
      statusCode: 502,
      requestId: req.requestId
    });
  }
}

// ----------------------------------------------------------------------------
// Health & Diagnostic Endpoints
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/gateway/status', (req, res) => {
  res.json({
    gateway: { port: PORT, pid: process.pid },
    routes: {
      authService: AUTH_SERVICE_URL,
      hotelService: HOTEL_SERVICE_URL,
      bookingReplicas: bookingBalancer.getStatus(),
      notificationService: NOTIFICATION_SERVICE_URL
    }
  });
});

// ----------------------------------------------------------------------------
// Route Handlers (Using Express path prefixes)
// ----------------------------------------------------------------------------
app.use('/api/auth', (req, res) => proxyRequest(req, res, AUTH_SERVICE_URL));
app.use('/api/hotels', (req, res) => proxyRequest(req, res, HOTEL_SERVICE_URL));
app.use('/api/rooms', (req, res) => proxyRequest(req, res, HOTEL_SERVICE_URL));
app.use('/api/bookings', (req, res) => {
  const target = bookingBalancer.getNextTarget();
  return proxyRequest(req, res, target, true);
});
app.use('/api/notifications', (req, res) => proxyRequest(req, res, NOTIFICATION_SERVICE_URL));

// Fallback for unmapped API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `Không tìm thấy tài nguyên API: ${req.method} ${req.originalUrl}`,
    statusCode: 404,
    requestId: req.requestId
  });
});

app.listen(PORT, () => {
  console.log(`[API Gateway] Running on port ${PORT} (PID: ${process.pid})`);
  console.log(`  -> Auth:          ${AUTH_SERVICE_URL}`);
  console.log(`  -> Hotels:        ${HOTEL_SERVICE_URL}`);
  console.log(`  -> Bookings:      [${bookingReplicaUrls.join(', ')}] (Load Balanced)`);
  console.log(`  -> Notifications: ${NOTIFICATION_SERVICE_URL}`);
});
