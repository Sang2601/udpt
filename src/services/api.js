/**
 * src/services/api.js
 * Unified Frontend API Client (Bài 1: Client-Server & Phân tầng).
 * All requests route exclusively through the API Gateway (/api).
 * No client-side port rotation. Automatic Idempotency-Key attachment.
 */

import { v4 as uuidv4 } from 'uuid';

const API_BASE = '/api';

export const authStorage = {
  getToken: () => localStorage.getItem('hotelbooking_token'),
  setToken: (token) => localStorage.setItem('hotelbooking_token', token),
  removeToken: () => localStorage.removeItem('hotelbooking_token'),
  getUser: () => {
    try {
      const u = localStorage.getItem('hotelbooking_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem('hotelbooking_user', JSON.stringify(user)),
  removeUser: () => localStorage.removeItem('hotelbooking_user'),
  clear: () => {
    localStorage.removeItem('hotelbooking_token');
    localStorage.removeItem('hotelbooking_user');
  }
};

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  const token = authStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.error || data.message || `Lỗi yêu cầu HTTP ${res.status}`;
      const error = new Error(errorMsg);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    console.error(`[API Client Error] ${options.method || 'GET'} ${url}:`, err.message);
    throw err;
  }
}

export const api = {
  // Auth API
  auth: {
    login: async (email, password) => {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (res.token) authStorage.setToken(res.token);
      if (res.user) authStorage.setUser(res.user);
      return res;
    },
    register: async (name, email, password, phone) => {
      const res = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone })
      });
      if (res.token) authStorage.setToken(res.token);
      if (res.user) authStorage.setUser(res.user);
      return res;
    },
    getMe: async () => {
      return await request('/auth/me');
    },
    logout: () => {
      authStorage.clear();
    }
  },

  // Hotels Catalog API
  hotels: {
    getAll: async (params = {}) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, val);
        }
      });
      return await request(`/hotels?${query.toString()}`);
    },
    getById: async (id, dates = {}) => {
      const query = new URLSearchParams();
      if (dates.checkIn) query.append('checkIn', dates.checkIn);
      if (dates.checkOut) query.append('checkOut', dates.checkOut);
      return await request(`/hotels/${id}?${query.toString()}`);
    },
    checkAvailability: async (hotelId, checkIn, checkOut, roomTypeId = null, roomsCount = 1) => {
      const query = new URLSearchParams({
        checkIn,
        checkOut,
        roomsCount: String(roomsCount)
      });
      if (roomTypeId) query.append('roomTypeId', roomTypeId);
      return await request(`/bookings/availability?${query.toString()}`);
    }
  },

  // Bookings API (Anti-overbooking & Idempotency)
  bookings: {
    create: async (bookingData) => {
      // Attach unique Idempotency-Key per checkout submission to prevent double billing / duplicate bookings
      const idempotencyKey = uuidv4();
      return await request('/bookings', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify(bookingData)
      });
    },
    getMyBookings: async () => {
      return await request('/bookings');
    },
    getById: async (id) => {
      return await request(`/bookings/${id}`);
    },
    cancel: async (bookingId) => {
      return await request(`/bookings/${bookingId}/cancel`, {
        method: 'POST'
      });
    }
  },

  // In-App Notifications API
  notifications: {
    getAll: async () => {
      return await request('/notifications');
    }
  },

  // Admin Dashboard API
  admin: {
    getStats: async () => {
      // Calls Booking Service WorkerPool report endpoint
      return await request('/bookings/admin/report');
    },
    getBookings: async () => {
      return await request('/bookings');
    },
    cancelBooking: async (bookingId) => {
      return await request(`/bookings/${bookingId}/cancel`, {
        method: 'POST'
      });
    }
  },

  // Cluster & Gateway Status Monitoring API
  cluster: {
    getStatus: async () => {
      return await request('/gateway/status');
    }
  }
};
