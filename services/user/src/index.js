/**
 * services/user/src/index.js
 * User Microservice Entry Point (User-service :8081).
 * Manages user accounts, profiles, role authorization, and user persistence in userdb.
 */

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserDatabase } from './db.js';

const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_phenikaa_hotel_2026';
const SERVICE_INSTANCE_ID = process.env.SERVICE_INSTANCE_ID || `user-service-${PORT}`;

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

const db = new UserDatabase();
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
    service: 'user-service',
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
    return res.status(503).json({ status: 'not_ready', error: 'Database userdb unreachable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ----------------------------------------------------------------------------
// User Endpoints
// ----------------------------------------------------------------------------

// Get current user profile
app.get('/api/users/me', authenticate, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi truy xuất thông tin người dùng: ' + err.message });
  }
});

// Update current user profile
app.put('/api/users/me', authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updated = await db.updateUserProfile(req.user.userId, { name, phone });
    const { password_hash, ...safeUser } = updated;
    res.json({ message: 'Cập nhật thành công', user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật người dùng: ' + err.message });
  }
});

// Admin: Get all users
app.get('/api/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Từ chối truy cập: Quyền Quản trị viên bị yêu cầu' });
  }
  try {
    const users = await db.getAllUsers();
    res.json({
      users: users.map(u => {
        const { password_hash, ...safe } = u;
        return safe;
      })
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tải danh sách người dùng' });
  }
});

// ----------------------------------------------------------------------------
// Internal RPC Endpoints (Used by Auth-service)
// ----------------------------------------------------------------------------

// Internal: Lookup user by email & verify password for login
app.post('/api/users/internal/verify-credentials', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' });
  }
  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xác thực người dùng: ' + err.message });
  }
});

// Internal: Create user for registration
app.post('/api/users/internal/create', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' });
  }
  try {
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email này đã được đăng ký trong hệ thống' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = await db.createUser({
      name: name || email.split('@')[0],
      email,
      passwordHash,
      role: 'user',
      phone: phone || ''
    });

    res.status(201).json({ user: newUser });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi tạo tài khoản: ' + err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [User-Service] Running on port ${PORT} (Instance: ${SERVICE_INSTANCE_ID})`);
});

