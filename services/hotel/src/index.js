/**
 * services/hotel/src/index.js
 * Hotel Microservice Entry Point (Bài 1, Bài 3 & Bài 4).
 * Serves hotel catalog, room metadata, and authoritative JSON-RPC 2.0 pricing server.
 */

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { HotelDatabase } from './db.js';
import { JsonRpcServer } from './rpc/jsonRpcHandler.js';

const PORT = process.env.PORT || 5002;
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

const db = new HotelDatabase(DATABASE_URL);
let rpcServer = null;

// ----------------------------------------------------------------------------
// Health & Readiness Endpoints
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'hotel-service',
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const isReady = await db.isHealthy();
    if (isReady) return res.json({ status: 'ready', dbMode: db.mode });
    return res.status(503).json({ status: 'not_ready', error: 'Database unavailable' });
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

// ----------------------------------------------------------------------------
// JSON-RPC 2.0 Endpoint (Bài 3 - Trao đổi thông tin)
// Handles authoritative price inquiries from Booking Service
// ----------------------------------------------------------------------------
app.post('/rpc', async (req, res) => {
  if (!rpcServer) {
    return res.status(503).json({ jsonrpc: '2.0', id: req.body?.id || null, error: { code: -32603, message: 'RPC server initializing' } });
  }
  const rpcResponse = await rpcServer.handleRequest(req.body);
  res.setHeader('Content-Type', 'application/json');
  return res.json(rpcResponse);
});

// ----------------------------------------------------------------------------
// REST Endpoints for Catalog & Frontend
// ----------------------------------------------------------------------------

/**
 * GET /api/hotels
 * Search & filter hotels
 */
app.get('/api/hotels', async (req, res) => {
  try {
    const { city, query, minPrice, maxPrice, stars, limit, offset } = req.query;
    const hotels = await db.getHotels({
      city,
      query,
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      stars: stars ? Number(stars) : null,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });
    return res.json(hotels);
  } catch (err) {
    console.error('[HotelService] Error querying hotels:', err);
    return res.status(500).json({ error: 'Lỗi truy vấn danh sách khách sạn' });
  }
});

/**
 * GET /api/hotels/:id
 */
app.get('/api/hotels/:id', async (req, res) => {
  try {
    const hotel = await db.getHotelById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ error: 'Không tìm thấy khách sạn' });
    }
    return res.json(hotel);
  } catch (err) {
    console.error(`[HotelService] Error getting hotel ${req.params.id}:`, err);
    return res.status(500).json({ error: 'Lỗi truy vấn thông tin khách sạn' });
  }
});

/**
 * GET /api/hotels/:id/rooms
 */
app.get('/api/hotels/:id/rooms', async (req, res) => {
  try {
    const rooms = await db.getRoomsByHotelId(req.params.id);
    return res.json(rooms);
  } catch (err) {
    console.error(`[HotelService] Error getting rooms for hotel ${req.params.id}:`, err);
    return res.status(500).json({ error: 'Lỗi truy vấn loại phòng' });
  }
});

// Start Server
db.init().then(() => {
  rpcServer = new JsonRpcServer(db);
  app.listen(PORT, () => {
    console.log(`[HotelService] Microservice running on port ${PORT} (PID: ${process.pid})`);
  });
}).catch(err => {
  console.error('[HotelService] Failed to start:', err);
  process.exit(1);
});
