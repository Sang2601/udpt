// Client API Service kết nối REST API Backend (Express + SQLite/MySQL)

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
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = authStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `Lỗi yêu cầu HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
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

  // Hotels & Availability API
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
    checkAvailability: async (id, checkIn, checkOut) => {
      return await request(`/hotels/${id}/availability?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`);
    }
  },

  // Bookings API
  bookings: {
    create: async (bookingData) => {
      return await request('/bookings', {
        method: 'POST',
        body: JSON.stringify(bookingData)
      });
    },
    getMyBookings: async (email, userId) => {
      const query = new URLSearchParams();
      if (userId) query.append('userId', userId);
      if (email) query.append('email', email);
      return await request(`/bookings/my?${query.toString()}`);
    },
    getByCode: async (code) => {
      return await request(`/bookings/code/${encodeURIComponent(code)}`);
    },
    cancel: async (bookingIdOrCode) => {
      return await request(`/bookings/${bookingIdOrCode}/cancel`, {
        method: 'PATCH'
      });
    }
  },

  // Admin Dashboard API
  admin: {
    getStats: async () => {
      return await request('/admin/stats');
    },
    getBookings: async (params = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.append('status', params.status);
      if (params.search) query.append('search', params.search);
      return await request(`/admin/bookings?${query.toString()}`);
    },
    updateBookingStatus: async (bookingId, status) => {
      return await request(`/admin/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    },
    createHotel: async (hotelData) => {
      return await request('/admin/hotels', {
        method: 'POST',
        body: JSON.stringify(hotelData)
      });
    },
    updateHotel: async (id, hotelData) => {
      return await request(`/admin/hotels/${id}`, {
        method: 'PUT',
        body: JSON.stringify(hotelData)
      });
    },
    deleteHotel: async (id) => {
      return await request(`/admin/hotels/${id}`, {
        method: 'DELETE'
      });
    },
    addRoom: async (hotelId, roomData) => {
      return await request(`/admin/hotels/${hotelId}/rooms`, {
        method: 'POST',
        body: JSON.stringify(roomData)
      });
    },
    updateRoom: async (roomId, roomData) => {
      return await request(`/admin/rooms/${roomId}`, {
        method: 'PUT',
        body: JSON.stringify(roomData)
      });
    },
    deleteRoom: async (roomId) => {
      return await request(`/admin/rooms/${roomId}`, {
        method: 'DELETE'
      });
    }
  }
};
