import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db, { run, get, all, initializeDatabase } from './database/db.js';

const app = express();
const PORT = process.env.PORT || process.argv[2] || 5001;
const NODE_ID = process.env.NODE_ID || process.argv[3] || `Node-${PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'hotelbooking_secret_key_2026';

app.use(cors());
app.use(express.json());

// Biến trạng thái mô phỏng sập Node (hỗ trợ kiểm thử chịu lỗi trực quan)
let isSimulatedDown = false;

// Middleware gắn Header nhận diện Node phân tán
app.use((req, res, next) => {
  res.setHeader('X-Served-By', NODE_ID);
  res.setHeader('X-Node-Port', String(PORT));
  res.setHeader('X-Node-Pid', String(process.pid));
  next();
});

// Chặn request nếu node đang trong trạng thái mô phỏng sập (trừ endpoint bật lại)
app.use((req, res, next) => {
  if (isSimulatedDown && !req.url.startsWith('/api/node/toggle-fail')) {
    return res.status(503).json({
      error: `[503 Service Unavailable] Node ${NODE_ID} (Port ${PORT}) đang ngắt kết nối (Mô phỏng sập Node phân tán)`
    });
  }
  next();
});

// Request logger kèm định danh Node
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}][${NODE_ID}:${PORT}] ${req.method} ${req.url}`);
  next();
});

// Endpoint kiểm tra sức khỏe của Node (Health Check)
app.get('/api/health', (req, res) => {
  if (isSimulatedDown) {
    return res.status(503).json({
      status: 'DOWN',
      node: NODE_ID,
      port: PORT,
      pid: process.pid,
      uptime: Math.floor(process.uptime()),
      message: 'Node đang ngoại tuyến (Simulated Failure)'
    });
  }
  res.json({
    status: 'UP',
    node: NODE_ID,
    port: PORT,
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Endpoint mô phỏng sập hoặc khôi phục Node phục vụ bài thi / kiểm tra
app.post('/api/node/toggle-fail', (req, res) => {
  isSimulatedDown = !isSimulatedDown;
  console.log(`⚠️ [DISTRIBUTED TEST] Node ${NODE_ID} (Port ${PORT}) đổi trạng thái: ${isSimulatedDown ? '🔴 SẬP (DOWN)' : '🟢 HOẠT ĐỘNG (UP)'}`);
  res.json({
    success: true,
    node: NODE_ID,
    port: PORT,
    isSimulatedDown,
    status: isSimulatedDown ? 'DOWN' : 'UP'
  });
});

// Helper xác thực Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Cần đăng nhập để thực hiện thao tác này' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
    req.user = user;
    next();
  });
}

// Helper kiểm tra quyền Admin
function requireAdmin(req, res, next) {
  authenticateToken(req, res, () => {
    if (req.user && req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Bạn không có quyền quản trị viên' });
    }
  });
}

// Helper chuẩn hóa ngày YYYY-MM-DD
function normalizeDate(dStr) {
  if (!dStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dStr)) {
    const [day, month, year] = dStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dStr;
}

// ============================================================================
// 1. AUTHENTICATION & USER MANAGEMENT
// ============================================================================

// Đăng ký tài khoản
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const existing = await get(`SELECT id FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Email này đã được đăng ký tài khoản trước đó' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = name ? name.trim() : email.split('@')[0];
    // Ràng buộc bảo mật: Mọi tài khoản đăng ký mới luôn luôn có vai trò 'user', tuyệt đối không cấp admin
    const role = 'user';

    const result = await run(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)`,
      [displayName, email.toLowerCase().trim(), passwordHash, role, phone || '']
    );

    const user = {
      id: result.lastID,
      name: displayName,
      email: email.toLowerCase().trim(),
      role,
      phone: phone || ''
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ success: true, user, token, message: 'Đăng ký tài khoản thành công!' });
  } catch (err) {
    console.error('Lỗi đăng ký:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi đăng ký: ' + err.message });
  }
});

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });
    }

    const userRecord = await get(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase().trim()]);
    if (!userRecord) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const match = await bcrypt.compare(password, userRecord.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const user = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      phone: userRecord.phone
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, user, token, message: 'Đăng nhập thành công!' });
  } catch (err) {
    console.error('Lỗi đăng nhập:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập: ' + err.message });
  }
});

// Lấy thông tin user hiện tại
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await get(`SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?`, [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 2. HOTELS & ROOM AVAILABILITY REST API
// ============================================================================

// Lấy danh sách khách sạn kèm bộ lọc và kiểm tra phòng trống theo ngày
app.get('/api/hotels', async (req, res) => {
  try {
    const {
      city, q, type, stars, minScore, maxPrice, freeCancellation,
      sortBy, checkIn, checkOut
    } = req.query;

    const normCheckIn = normalizeDate(checkIn);
    const normCheckOut = normalizeDate(checkOut);

    let sql = `SELECT * FROM hotels WHERE 1=1`;
    const params = [];

    if (city && city.trim() !== '') {
      sql += ` AND (LOWER(city) LIKE ? OR LOWER(name) LIKE ? OR LOWER(address) LIKE ?)`;
      const term = `%${city.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    if (q && q.trim() !== '') {
      sql += ` AND (LOWER(city) LIKE ? OR LOWER(name) LIKE ? OR LOWER(address) LIKE ? OR LOWER(description) LIKE ?)`;
      const term = `%${q.trim().toLowerCase()}%`;
      params.push(term, term, term, term);
    }

    if (type && type !== 'all') {
      sql += ` AND type = ?`;
      params.push(type);
    }

    if (stars) {
      const starList = stars.split(',').map(s => parseInt(s)).filter(s => !isNaN(s));
      if (starList.length > 0) {
        sql += ` AND star_rating IN (${starList.map(() => '?').join(',')})`;
        params.push(...starList);
      }
    }

    if (minScore) {
      sql += ` AND review_score >= ?`;
      params.push(parseFloat(minScore));
    }

    if (maxPrice) {
      sql += ` AND price_vnd <= ?`;
      params.push(parseInt(maxPrice));
    }

    if (freeCancellation === 'true') {
      sql += ` AND free_cancellation = 1`;
    }

    // Sắp xếp
    if (sortBy === 'price_asc') {
      sql += ` ORDER BY price_vnd ASC`;
    } else if (sortBy === 'price_desc') {
      sql += ` ORDER BY price_vnd DESC`;
    } else if (sortBy === 'score_desc') {
      sql += ` ORDER BY review_score DESC`;
    } else {
      sql += ` ORDER BY star_rating DESC, review_score DESC`;
    }

    const hotels = await all(sql, params);

    // Lấy thông tin phòng và tính toán tình trạng phòng trống
    for (const h of hotels) {
      h.images = JSON.parse(h.images_json || '[]');
      h.amenities = JSON.parse(h.amenities_json || '[]');
      h.starRating = h.star_rating;
      h.reviewScore = h.review_score;
      h.reviewScoreWord = h.review_score_word;
      h.reviewCount = h.review_count;
      h.priceVND = h.price_vnd;
      h.originalPriceVND = h.original_price_vnd;
      h.isGenius = !!h.is_genius;
      h.freeCancellation = !!h.free_cancellation;
      h.noPrepayment = !!h.no_prepayment;
      h.breakfastIncluded = !!h.breakfast_included;
      h.roomType = h.room_type;
      h.bedType = h.bed_type;
      h.beachDistance = h.beach_distance;

      // Lấy danh sách phòng của khách sạn
      const rooms = await all(`SELECT * FROM rooms WHERE hotel_id = ?`, [h.id]);
      let totalAvailableInHotel = 0;

      for (const rm of rooms) {
        rm.priceVND = rm.price_vnd;
        rm.originalPriceVND = rm.original_price_vnd;
        rm.totalUnits = rm.total_units || 5;

        // Nếu có khoảng ngày checkIn & checkOut, kiểm tra lịch đặt phòng trùng lặp
        if (normCheckIn && normCheckOut) {
          const bookedRow = await get(`
            SELECT COALESCE(SUM(rooms_count), 0) as booked
            FROM bookings
            WHERE room_id = ?
              AND status != 'cancelled'
              AND check_in < ?
              AND check_out > ?
          `, [rm.id, normCheckOut, normCheckIn]);

          const bookedUnits = bookedRow ? bookedRow.booked : 0;
          rm.bookedUnits = bookedUnits;
          rm.availableUnits = Math.max(0, rm.totalUnits - bookedUnits);
        } else {
          rm.availableUnits = rm.totalUnits;
        }

        totalAvailableInHotel += rm.availableUnits;
      }

      h.rooms = rooms;
      h.totalAvailableRooms = totalAvailableInHotel;
      h.isSoldOut = (normCheckIn && normCheckOut && totalAvailableInHotel === 0);
    }

    res.json({
      success: true,
      count: hotels.length,
      checkIn: normCheckIn,
      checkOut: normCheckOut,
      data: hotels
    });
  } catch (err) {
    console.error('Lỗi truy vấn khách sạn:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi tải danh sách khách sạn: ' + err.message });
  }
});

// Lấy chi tiết 1 khách sạn kèm danh sách phòng và số lượng phòng trống theo ngày
app.get('/api/hotels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut } = req.query;
    const normCheckIn = normalizeDate(checkIn);
    const normCheckOut = normalizeDate(checkOut);

    const h = await get(`SELECT * FROM hotels WHERE id = ?`, [id]);
    if (!h) return res.status(404).json({ error: 'Không tìm thấy khách sạn' });

    h.images = JSON.parse(h.images_json || '[]');
    h.amenities = JSON.parse(h.amenities_json || '[]');
    h.starRating = h.star_rating;
    h.reviewScore = h.review_score;
    h.reviewScoreWord = h.review_score_word;
    h.reviewCount = h.review_count;
    h.priceVND = h.price_vnd;
    h.originalPriceVND = h.original_price_vnd;
    h.isGenius = !!h.is_genius;
    h.freeCancellation = !!h.free_cancellation;
    h.noPrepayment = !!h.no_prepayment;
    h.breakfastIncluded = !!h.breakfast_included;
    h.roomType = h.room_type;
    h.bedType = h.bed_type;
    h.beachDistance = h.beach_distance;

    const rooms = await all(`SELECT * FROM rooms WHERE hotel_id = ?`, [h.id]);
    for (const rm of rooms) {
      rm.priceVND = rm.price_vnd;
      rm.originalPriceVND = rm.original_price_vnd;
      rm.totalUnits = rm.total_units || 5;

      if (normCheckIn && normCheckOut) {
        const bookedRow = await get(`
          SELECT COALESCE(SUM(rooms_count), 0) as booked
          FROM bookings
          WHERE room_id = ?
            AND status != 'cancelled'
            AND check_in < ?
            AND check_out > ?
        `, [rm.id, normCheckOut, normCheckIn]);

        const bookedUnits = bookedRow ? bookedRow.booked : 0;
        rm.bookedUnits = bookedUnits;
        rm.availableUnits = Math.max(0, rm.totalUnits - bookedUnits);
      } else {
        rm.availableUnits = rm.totalUnits;
      }
    }
    h.rooms = rooms;

    res.json({ success: true, data: h });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint chuyên biệt kiểm tra phòng trống theo khoảng ngày
app.get('/api/hotels/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut } = req.query;
    const normCheckIn = normalizeDate(checkIn);
    const normCheckOut = normalizeDate(checkOut);

    if (!normCheckIn || !normCheckOut) {
      return res.status(400).json({ error: 'Vui lòng cung cấp ngày check-in và check-out hợp lệ' });
    }

    const rooms = await all(`SELECT * FROM rooms WHERE hotel_id = ?`, [id]);
    const availability = [];

    for (const rm of rooms) {
      const bookedRow = await get(`
        SELECT COALESCE(SUM(rooms_count), 0) as booked
        FROM bookings
        WHERE room_id = ?
          AND status != 'cancelled'
          AND check_in < ?
          AND check_out > ?
      `, [rm.id, normCheckOut, normCheckIn]);

      const bookedUnits = bookedRow ? bookedRow.booked : 0;
      const totalUnits = rm.total_units || 5;
      const availableUnits = Math.max(0, totalUnits - bookedUnits);

      availability.push({
        roomId: rm.id,
        roomName: rm.name,
        priceVND: rm.price_vnd,
        totalUnits,
        bookedUnits,
        availableUnits,
        isAvailable: availableUnits > 0
      });
    }

    res.json({
      hotelId: id,
      checkIn: normCheckIn,
      checkOut: normCheckOut,
      availability
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 3. BOOKINGS MANAGEMENT (ĐẶT PHÒNG VÀ QUẢN LÝ ĐƠN)
// ============================================================================

// Tạo đơn đặt phòng mới (Lưu trực tiếp vào CSDL + kiểm tra phòng trống thực tế)
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      hotelId, roomId, guestName, guestEmail, guestPhone,
      checkIn, checkOut, roomsCount = 1, adults = 2, children = 0,
      specialRequests, paymentMethod = 'hotel', userId
    } = req.body;

    if (!hotelId || !guestName || !guestEmail || !guestPhone) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin khách hàng và phòng' });
    }

    const normCheckIn = normalizeDate(checkIn) || new Date().toISOString().split('T')[0];
    const defaultCheckOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const normCheckOut = normalizeDate(checkOut) || defaultCheckOut;

    const dIn = new Date(normCheckIn);
    const dOut = new Date(normCheckOut);
    if (dOut <= dIn) {
      return res.status(400).json({ error: 'Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm' });
    }

    const nights = Math.max(1, Math.round((dOut - dIn) / (1000 * 60 * 60 * 24)));

    // Lấy thông tin phòng
    let room = null;
    if (roomId) {
      room = await get(`SELECT * FROM rooms WHERE id = ? OR id = ?`, [roomId, `${hotelId}_${roomId}`]);
    }
    if (!room) {
      room = await get(`SELECT * FROM rooms WHERE hotel_id = ? LIMIT 1`, [hotelId]);
    }
    if (!room) {
      return res.status(404).json({ error: 'Không tìm thấy loại phòng hợp lệ của khách sạn' });
    }

    // KIỂM TRA PHÒNG TRỐNG THEO NGÀY:
    const bookedRow = await get(`
      SELECT COALESCE(SUM(rooms_count), 0) as booked
      FROM bookings
      WHERE room_id = ?
        AND status != 'cancelled'
        AND check_in < ?
        AND check_out > ?
    `, [room.id, normCheckOut, normCheckIn]);

    const bookedUnits = bookedRow ? bookedRow.booked : 0;
    const totalUnits = room.total_units || 5;
    const availableUnits = totalUnits - bookedUnits;

    if (availableUnits < roomsCount) {
      return res.status(400).json({
        error: `Rất tiếc! Loại phòng "${room.name}" chỉ còn ${Math.max(0, availableUnits)} phòng trống trong khoảng thời gian từ ${normCheckIn} đến ${normCheckOut}. Vui lòng chọn ngày khác hoặc loại phòng khác.`
      });
    }

    const hotel = await get(`SELECT name, price_vnd FROM hotels WHERE id = ?`, [hotelId]);
    const totalPriceVnd = nights * (room.price_vnd || hotel.price_vnd) * roomsCount;

    // Sinh mã đơn đặt ngẫu nhiên chuyên nghiệp BK-xxxxxx
    const bookingCode = 'BK-' + Math.floor(100000 + Math.random() * 900000);

    const result = await run(`
      INSERT INTO bookings (
        booking_code, user_id, hotel_id, room_id, guest_name, guest_email, guest_phone,
        check_in, check_out, nights, rooms_count, adults, children, total_price_vnd,
        special_requests, payment_method, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bookingCode,
      userId || null,
      hotelId,
      room.id,
      guestName.trim(),
      guestEmail.toLowerCase().trim(),
      guestPhone.trim(),
      normCheckIn,
      normCheckOut,
      nights,
      roomsCount,
      adults,
      children,
      totalPriceVnd,
      specialRequests || '',
      paymentMethod,
      'confirmed'
    ]);

    const createdBooking = await get(`
      SELECT b.*, h.name as hotel_name, h.address as hotel_address, h.city as hotel_city, r.name as room_name
      FROM bookings b
      JOIN hotels h ON b.hotel_id = h.id
      JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `, [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Đặt phòng thành công! Đơn đặt phòng đã được lưu vào hệ thống CSDL.',
      booking: createdBooking
    });
  } catch (err) {
    console.error('Lỗi tạo đơn đặt phòng:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi tạo đơn đặt: ' + err.message });
  }
});

// Tra cứu danh sách đơn đặt phòng của khách hàng
app.get('/api/bookings/my', async (req, res) => {
  try {
    const { email, userId } = req.query;
    let sql = `
      SELECT b.*, h.name as hotel_name, h.address as hotel_address, h.city as hotel_city,
             h.images_json, r.name as room_name, r.size as room_size
      FROM bookings b
      LEFT JOIN hotels h ON b.hotel_id = h.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      sql += ` AND b.user_id = ?`;
      params.push(userId);
    } else if (email) {
      sql += ` AND LOWER(b.guest_email) = ?`;
      params.push(email.toLowerCase().trim());
    } else {
      return res.status(400).json({ error: 'Vui lòng cung cấp email hoặc đăng nhập để xem đơn' });
    }

    sql += ` ORDER BY b.created_at DESC`;
    const bookings = await all(sql, params);

    for (const b of bookings) {
      const imgs = JSON.parse(b.images_json || '[]');
      b.hotel_image = imgs[0] || '';
    }

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tra cứu chi tiết 1 đơn theo mã đơn BK-xxxxxx
app.get('/api/bookings/code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const booking = await get(`
      SELECT b.*, h.name as hotel_name, h.address as hotel_address, h.city as hotel_city,
             h.images_json, r.name as room_name
      FROM bookings b
      LEFT JOIN hotels h ON b.hotel_id = h.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.booking_code = ?
    `, [code.toUpperCase()]);

    if (!booking) return res.status(404).json({ error: 'Không tìm thấy đơn đặt phòng với mã ' + code });

    const imgs = JSON.parse(booking.images_json || '[]');
    booking.hotel_image = imgs[0] || '';

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hủy đặt phòng (Khách hàng hoặc Quản trị viên)
app.patch('/api/bookings/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await get(`SELECT * FROM bookings WHERE id = ? OR booking_code = ?`, [id, id]);
    if (!booking) return res.status(404).json({ error: 'Không tìm thấy đơn đặt phòng' });

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Đơn đặt phòng này đã được hủy trước đó' });
    }

    await run(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [booking.id]);
    res.json({
      success: true,
      message: `Đã hủy thành công đơn đặt phòng #${booking.booking_code}. Phòng đã được hoàn lại vào kho phòng trống!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 4. ADMIN DASHBOARD & MANAGEMENT (QUẢN TRỊ KHÁCH SẠN, PHÒNG VÀ ĐƠN)
// ============================================================================

// Bắt buộc xác thực quyền Admin cho tất cả các endpoint quản trị
app.use('/api/admin', requireAdmin);

// Thống kê tổng quan cho Admin Dashboard
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalHotels = await get(`SELECT COUNT(*) as count FROM hotels`);
    const totalRooms = await get(`SELECT COUNT(*) as count, COALESCE(SUM(total_units), 0) as units FROM rooms`);
    const totalBookings = await get(`SELECT COUNT(*) as count FROM bookings`);
    const activeBookings = await get(`SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed'`);
    const cancelledBookings = await get(`SELECT COUNT(*) as count FROM bookings WHERE status = 'cancelled'`);
    const totalRevenue = await get(`SELECT COALESCE(SUM(total_price_vnd), 0) as revenue FROM bookings WHERE status != 'cancelled'`);
    const totalUsers = await get(`SELECT COUNT(*) as count FROM users`);

    const recentBookings = await all(`
      SELECT b.*, h.name as hotel_name, r.name as room_name
      FROM bookings b
      LEFT JOIN hotels h ON b.hotel_id = h.id
      LEFT JOIN rooms r ON b.room_id = r.id
      ORDER BY b.created_at DESC
      LIMIT 6
    `);

    res.json({
      success: true,
      stats: {
        totalHotels: totalHotels.count,
        totalRooms: totalRooms.count,
        totalRoomUnits: totalRooms.units,
        totalBookings: totalBookings.count,
        activeBookings: activeBookings.count,
        cancelledBookings: cancelledBookings.count,
        totalRevenueVND: totalRevenue.revenue,
        totalUsers: totalUsers.count
      },
      recentBookings
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quản trị viên lấy danh sách toàn bộ đơn đặt phòng (kèm tìm kiếm và lọc trạng thái)
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = `
      SELECT b.*, h.name as hotel_name, h.city as hotel_city, r.name as room_name
      FROM bookings b
      LEFT JOIN hotels h ON b.hotel_id = h.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ` AND b.status = ?`;
      params.push(status);
    }

    if (search && search.trim() !== '') {
      sql += ` AND (
        b.booking_code LIKE ? OR
        LOWER(b.guest_name) LIKE ? OR
        LOWER(b.guest_email) LIKE ? OR
        b.guest_phone LIKE ? OR
        LOWER(h.name) LIKE ?
      )`;
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term, term, term);
    }

    sql += ` ORDER BY b.created_at DESC`;
    const bookings = await all(sql, params);
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quản trị viên cập nhật trạng thái đơn (confirmed, completed, cancelled)
app.patch('/api/admin/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    }

    await run(`UPDATE bookings SET status = ? WHERE id = ?`, [status, id]);
    res.json({ success: true, message: `Cập nhật trạng thái đơn thành công sang: ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quản trị viên thêm khách sạn mới
app.post('/api/admin/hotels', async (req, res) => {
  try {
    const {
      id, name, type = 'hotel', city, address, distance, starRating = 4,
      priceVND, rooms = [], amenities = [], description = ''
    } = req.body;

    if (!name || !city || !priceVND) {
      return res.status(400).json({ error: 'Vui lòng điền tên, thành phố và giá phòng cơ bản' });
    }

    const hotelId = id || (city.toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString(36));

    const defaultImages = [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80'
    ];

    await run(`
      INSERT INTO hotels (
        id, name, type, city, address, distance, star_rating,
        review_score, review_score_word, review_count, price_vnd,
        original_price_vnd, is_genius, badge, images_json, room_type,
        bed_type, free_cancellation, no_prepayment, breakfast_included,
        amenities_json, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      hotelId,
      name.trim(),
      type,
      city.trim(),
      address || `${city}, Việt Nam`,
      distance || 'Trung tâm thành phố',
      starRating,
      9.0,
      'Tuyệt vời',
      50,
      priceVND,
      Math.round(priceVND * 1.25),
      1,
      'Khách sạn mới',
      JSON.stringify(req.body.images && req.body.images.length > 0 ? req.body.images : defaultImages),
      'Phòng Tiêu Chuẩn',
      '1 giường đôi lớn',
      1,
      1,
      1,
      JSON.stringify(amenities.length > 0 ? amenities : ['WiFi miễn phí', 'Điều hòa', 'Lễ tân 24h']),
      description || `Khách sạn tiện nghi sang trọng tọa lạc tại ${city}.`
    ]);

    // Thêm các loại phòng mặc định nếu có
    if (rooms.length > 0) {
      for (const rm of rooms) {
        await run(`
          INSERT INTO rooms (id, hotel_id, name, size, price_vnd, original_price_vnd, capacity, breakfast, total_units)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `${hotelId}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
          hotelId,
          rm.name || 'Phòng Deluxe',
          rm.size || '32 m²',
          rm.priceVND || priceVND,
          rm.originalPriceVND || Math.round(priceVND * 1.25),
          rm.capacity || '2 người lớn',
          rm.breakfast ? 1 : 0,
          rm.totalUnits || 5
        ]);
      }
    } else {
      // Tự động tạo 1 phòng tiêu chuẩn
      await run(`
        INSERT INTO rooms (id, hotel_id, name, size, price_vnd, original_price_vnd, capacity, breakfast, total_units)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `${hotelId}_r1`,
        hotelId,
        'Phòng Superior Giường Đôi',
        '30 m²',
        priceVND,
        Math.round(priceVND * 1.25),
        '2 người lớn',
        1,
        5
      ]);
    }

    res.status(201).json({ success: true, message: 'Thêm khách sạn thành công!', hotelId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quản trị viên cập nhật thông tin khách sạn
app.put('/api/admin/hotels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, city, address, starRating, priceVND, description, type } = req.body;

    await run(`
      UPDATE hotels
      SET name = COALESCE(?, name),
          city = COALESCE(?, city),
          address = COALESCE(?, address),
          star_rating = COALESCE(?, star_rating),
          price_vnd = COALESCE(?, price_vnd),
          description = COALESCE(?, description),
          type = COALESCE(?, type)
      WHERE id = ?
    `, [name, city, address, starRating, priceVND, description, type, id]);

    res.json({ success: true, message: 'Cập nhật khách sạn thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quản trị viên xóa khách sạn
app.delete('/api/admin/hotels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(`DELETE FROM hotels WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Đã xóa khách sạn và các phòng liên quan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quản trị viên thêm phòng vào khách sạn
app.post('/api/admin/hotels/:id/rooms', async (req, res) => {
  try {
    const { id: hotelId } = req.params;
    const { name, size, priceVND, capacity, breakfast, totalUnits = 5 } = req.body;

    if (!name || !priceVND) {
      return res.status(400).json({ error: 'Vui lòng nhập tên phòng và giá' });
    }

    const roomId = `${hotelId}_${Date.now().toString(36)}`;
    await run(`
      INSERT INTO rooms (id, hotel_id, name, size, price_vnd, original_price_vnd, capacity, breakfast, total_units)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      roomId,
      hotelId,
      name,
      size || '35 m²',
      priceVND,
      Math.round(priceVND * 1.25),
      capacity || '2 người lớn',
      breakfast ? 1 : 0,
      totalUnits
    ]);

    res.status(201).json({ success: true, message: 'Thêm phòng thành công!', roomId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quản trị viên cập nhật số lượng và thông tin phòng
app.put('/api/admin/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, size, priceVND, totalUnits, capacity } = req.body;

    await run(`
      UPDATE rooms
      SET name = COALESCE(?, name),
          size = COALESCE(?, size),
          price_vnd = COALESCE(?, price_vnd),
          total_units = COALESCE(?, total_units),
          capacity = COALESCE(?, capacity)
      WHERE id = ?
    `, [name, size, priceVND, totalUnits, capacity, id]);

    res.json({ success: true, message: 'Cập nhật phòng thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quản trị viên xóa phòng
app.delete('/api/admin/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(`DELETE FROM rooms WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Đã xóa phòng thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Khởi chạy server và kết nối DB
async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 [Distributed Node: ${NODE_ID}] Backend Node đang hoạt động tại: http://localhost:${PORT} (PID: ${process.pid})`);
  });
}

startServer().catch(err => {
  console.error('Lỗi khởi động server:', err);
});
