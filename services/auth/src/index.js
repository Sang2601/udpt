/**
 * services/auth/src/index.js
 * Auth Microservice Entry Point (Bài 1 & Bài 4).
 * Manages user authentication, bcrypt password hashing, JWT generation, and role authorization.
 */

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AuthDatabase } from './db.js';

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_phenikaa_hotel_2026';
const DATABASE_URL = process.env.DATABASE_URL || '';

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

const db = new AuthDatabase(DATABASE_URL);

// ----------------------------------------------------------------------------
// Health & Readiness Endpoints
// ----------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  res.json({
    status: 'healthy',
    service: 'auth-service',
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const isDbHealthy = await db.isHealthy();
    if (isDbHealthy) {
      return res.json({ status: 'ready', dbMode: db.mode });
    }
    return res.status(503).json({ status: 'not_ready', error: 'Database unavailable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ----------------------------------------------------------------------------
// Auth Endpoints
// ----------------------------------------------------------------------------

/**
 * POST /api/auth/register
 * Enforces role: 'user'. Never grants 'admin' based on email keywords.
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Họ tên, email và mật khẩu là bắt buộc' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const existingUser = await db.getUserByEmail(email.toLowerCase().trim());
    if (existingUser) {
      return res.status(409).json({ error: 'Email này đã được sử dụng bởi một tài khoản khác' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = uuidv4();

    // Security requirement: New registrations are ALWAYS role 'user'
    const role = 'user';

    const newUser = await db.createUser({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      phone: phone ? phone.trim() : null,
      role
    });

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Đăng ký tài khoản thành công',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      },
      token
    });
  } catch (err) {
    console.error(`[AuthService] Error registering user:`, err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký tài khoản' });
  }
});

/**
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ email và mật khẩu' });
    }

    const user = await db.getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const storedHash = user.password_hash || user.password;
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error(`[AuthService] Error logging in:`, err);
    return res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập' });
  }
});

/**
 * GET /api/auth/me
 */
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu token xác thực' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản' });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error(`[AuthService] Error in /me:`, err);
    return res.status(500).json({ error: 'Lỗi xác thực người dùng' });
  }
});

// Start Server
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`[AuthService] Microservice running on port ${PORT} (PID: ${process.pid})`);
  });
}).catch(err => {
  console.error('[AuthService] Failed to start:', err);
  process.exit(1);
});
