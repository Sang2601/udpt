/**
 * services/auth/src/index.js
 * Auth Microservice Entry Point (Auth-service :8080).
 * Handles authentication, JWT issuance, token verification, and coordinates with User-service :8081.
 */

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_phenikaa_hotel_2026';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:8081';
const SERVICE_INSTANCE_ID = process.env.SERVICE_INSTANCE_ID || `auth-service-${PORT}`;

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

// Helper: Call User-service internally
async function callUserService(endpoint, options = {}) {
  const url = `${USER_SERVICE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Lỗi User-service (HTTP ${response.status})`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ----------------------------------------------------------------------------
// Health & Readiness Endpoints
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    instanceId: SERVICE_INSTANCE_ID,
    port: PORT,
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const userHealthRes = await fetch(`${USER_SERVICE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (userHealthRes.ok) {
      return res.json({ status: 'ready', instanceId: SERVICE_INSTANCE_ID, userService: 'connected' });
    }
    return res.status(503).json({ status: 'not_ready', error: 'User-service unreachable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: 'User-service check failed: ' + err.message });
  }
});

// ----------------------------------------------------------------------------
// Auth Endpoints
// ----------------------------------------------------------------------------

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
  }

  try {
    const { user } = await callUserService('/api/users/internal/verify-credentials', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AuthService] Đăng nhập thành công: ${user.email} (${user.role})`);
    res.json({
      message: 'Đăng nhập thành công',
      token,
      user
    });
  } catch (err) {
    console.warn(`[AuthService] Đăng nhập thất bại cho ${email}:`, err.message);
    res.status(err.status || 401).json({ error: err.message || 'Đăng nhập thất bại' });
  }
});

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ email và mật khẩu' });
  }

  try {
    const { user } = await callUserService('/api/users/internal/create', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone })
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[AuthService] Đăng ký tài khoản mới: ${user.email}`);
    res.status(201).json({
      message: 'Đăng ký tài khoản thành công',
      token,
      user
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Lỗi đăng ký tài khoản' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { user } = await callUserService('/api/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
});

// POST /api/auth/verify (Internal token check for other services)
app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ valid: false, error: 'Thiếu token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ valid: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Auth-Service] Running on port ${PORT} (Instance: ${SERVICE_INSTANCE_ID})`);
});
