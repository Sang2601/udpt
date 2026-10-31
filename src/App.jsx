import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Row, Col, Dropdown, Toast, ToastContainer, Badge, Spinner } from 'react-bootstrap';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import TrendingDestinations from './components/TrendingDestinations';
import HotelCard from './components/HotelCard';
import FilterSidebar from './components/FilterSidebar';
import HotelDetailModal from './components/HotelDetailModal';
import AuthModal from './components/AuthModal';
import MyBookingsModal from './components/MyBookingsModal';
import AdminDashboardModal from './components/AdminDashboardModal';
import DistributedSystemModal from './components/DistributedSystemModal';
import Footer from './components/Footer';

import { initialHotels } from './data/hotelsData';
import { api, authStorage } from './services/api';

export default function App() {
  // Global settings
  const [currency, setCurrency] = useState('VND');
  const [language, setLanguage] = useState('vi');
  const [user, setUser] = useState(() => authStorage.getUser());

  // Search parameters for Stays
  const [destination, setDestination] = useState('');
  const [activeSearchCity, setActiveSearchCity] = useState('');

  // Default dates: Upcoming dates (YYYY-MM-DD for database consistency)
  const [checkInDate, setCheckInDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });

  const [guests, setGuests] = useState({ adults: 2, children: 0, rooms: 1 });
  const [isWorkTravel, setIsWorkTravel] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState(['danang-intercon']);

  // Filters & Sorting for Stays
  const [filters, setFilters] = useState({
    stars: [],
    minScore: 0,
    maxPrice: 15000000,
    amenities: [],
    freeCancellation: false,
    propertyType: 'all'
  });
  const [sortBy, setSortBy] = useState('recommended');

  // Hotels Data from Backend REST API
  const [hotels, setHotels] = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(false);

  // Modals & Toasts
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [authModal, setAuthModal] = useState({ show: false, mode: 'login' });
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showDistributedModal, setShowDistributedModal] = useState(false);
  const [bookingToast, setBookingToast] = useState({ show: false, title: '', message: '', code: '' });

  const resultsRef = useRef(null);

  // Tải danh sách khách sạn kèm tính năng kiểm tra phòng trống theo ngày từ REST API
  const fetchHotelsFromApi = useCallback(async () => {
    setLoadingHotels(true);
    try {
      const res = await api.hotels.getAll({
        city: activeSearchCity,
        type: filters.propertyType,
        stars: filters.stars.length > 0 ? filters.stars.join(',') : undefined,
        minScore: filters.minScore > 0 ? filters.minScore : undefined,
        maxPrice: filters.maxPrice,
        freeCancellation: filters.freeCancellation ? 'true' : undefined,
        checkIn: checkInDate,
        checkOut: checkOutDate
      });

      if (Array.isArray(res)) {
        setHotels(res);
      } else if (res && Array.isArray(res.hotels)) {
        setHotels(res.hotels);
      } else {
        setHotels(initialHotels);
      }
    } catch (err) {
      console.warn('API Gateway chưa sẵn sàng hoặc gặp lỗi, sử dụng dữ liệu tĩnh fallback:', err);
      setHotels(initialHotels);
    } finally {
      setLoadingHotels(false);
    }
  }, [activeSearchCity, filters, checkInDate, checkOutDate]);

  useEffect(() => {
    fetchHotelsFromApi();
  }, [fetchHotelsFromApi]);

  // Handle Search Submission
  const handleSearch = ({ destination: dest, checkIn, checkOut, guests: g, isWork }) => {
    setDestination(dest);
    setActiveSearchCity(dest);
    setCheckInDate(checkIn);
    setCheckOutDate(checkOut);
    setGuests(g);
    setIsWorkTravel(isWork);

    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectDestination = (cityName) => {
    setDestination(cityName);
    setActiveSearchCity(cityName);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleToggleFavorite = (hotelId) => {
    setFavorites(prev =>
      prev.includes(hotelId) ? prev.filter(id => id !== hotelId) : [...prev, hotelId]
    );
  };

  const handleSelectHotel = (hotel) => {
    setSelectedHotel(hotel);
    setShowHotelModal(true);
  };

  const handleConfirmBooking = ({ hotel, room, guest, booking, nights, totalPrice }) => {
    setBookingToast({
      show: true,
      title: language === 'vi' ? 'Đặt phòng thành công!' : 'Booking Confirmed!',
      message: language === 'vi'
        ? `Đã lưu đơn đặt phòng ${hotel.name} (${nights} đêm) thành công vào CSDL.`
        : `Your reservation at ${hotel.name} (${nights} nights) has been saved in the database.`,
      code: booking?.booking_code || booking?.bookingCode || 'BK-SUCCESS'
    });
    fetchHotelsFromApi();
  };

  // Filter and sort stays
  const filteredHotels = hotels
    .filter(h => {
      if (filters.stars.length > 0 && !filters.stars.includes(h.starRating || h.stars)) return false;
      const score = h.reviewScore || h.rating || 9.0;
      if (score < filters.minScore) return false;
      const price = h.priceVND || h.price_per_night || 0;
      if (price > filters.maxPrice) return false;
      if (filters.freeCancellation && !h.freeCancellation) return false;
      return true;
    })
    .sort((a, b) => {
      const priceA = a.priceVND || a.price_per_night || 0;
      const priceB = b.priceVND || b.price_per_night || 0;
      const scoreA = a.reviewScore || a.rating || 0;
      const scoreB = b.reviewScore || b.rating || 0;

      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      if (sortBy === 'score_desc') return scoreB - scoreA;
      return 0;
    });

  const calculateNights = () => {
    try {
      if (!checkInDate || !checkOutDate) return 2;
      let dIn, dOut;
      if (checkInDate.includes('/')) {
        const [d, m, y] = checkInDate.split('/');
        dIn = new Date(`${y}-${m}-${d}`);
      } else {
        dIn = new Date(checkInDate);
      }
      if (checkOutDate.includes('/')) {
        const [d, m, y] = checkOutDate.split('/');
        dOut = new Date(`${y}-${m}-${d}`);
      } else {
        dOut = new Date(checkOutDate);
      }
      const diff = Math.round((dOut - dIn) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 1;
    } catch {
      return 2;
    }
  };

  const nightsCount = calculateNights();

  return (
    <div className="d-flex flex-column min-vh-100 bg-white">
      {/* Header */}
      <Header
        currency={currency}
        setCurrency={setCurrency}
        language={language}
        setLanguage={setLanguage}
        user={user}
        onOpenAuth={(mode) => setAuthModal({ show: true, mode })}
        onLogout={() => {
          authStorage.clear();
          setUser(null);
          setShowAdminDashboard(false);
          setShowMyBookings(false);
        }}
        onOpenMyBookings={() => setShowMyBookings(true)}
        onOpenAdminDashboard={() => {
          if (user?.role === 'admin') {
            setShowAdminDashboard(true);
          } else {
            setAuthModal({ show: true, mode: 'login' });
          }
        }}
        onOpenDistributedModal={() => {
          if (user?.role === 'admin') {
            setShowDistributedModal(true);
          } else {
            setAuthModal({ show: true, mode: 'login' });
          }
        }}
      />

      {/* Main Content */}
      <>
        {/* Floating Search Bar */}
        <SearchBar
          destination={destination}
          setDestination={setDestination}
          checkInDate={checkInDate}
          setCheckInDate={setCheckInDate}
          checkOutDate={checkOutDate}
          setCheckOutDate={setCheckOutDate}
          guests={guests}
          setGuests={setGuests}
          isWorkTravel={isWorkTravel}
          setIsWorkTravel={setIsWorkTravel}
          onSearch={handleSearch}
          language={language}
        />

        {/* Trending Destinations */}
        <TrendingDestinations
          onSelectDestination={handleSelectDestination}
          language={language}
        />

        {/* Hotel Search Results & Featured Section */}
        <div ref={resultsRef} className="py-4" style={{ backgroundColor: '#fafbfc' }}>
          <Container>
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
              <div>
                <h2 className="fw-bold fs-3 text-dark mb-1 d-flex align-items-center gap-2">
                  {activeSearchCity
                    ? (language === 'vi' ? `${activeSearchCity}: tìm thấy ${hotels.length} khách sạn & chỗ nghỉ` : `${activeSearchCity}: ${hotels.length} properties found`)
                    : (language === 'vi' ? 'Hệ thống Khách sạn & Nghỉ dưỡng PhenikaaHotel' : 'PhenikaaHotel Stays & Resorts')}
                  {loadingHotels && <Spinner size="sm" animation="border" variant="primary" />}
                </h2>
                <p className="text-muted small mb-0">
                  <i className="bi bi-calendar3 me-1 text-primary"></i>
                  {language === 'vi'
                    ? `Khoảng thời gian: ${checkInDate} đến ${checkOutDate} (${nightsCount} đêm) · Kiểm tra phòng trống theo thời gian thực`
                    : `Dates: ${checkInDate} to ${checkOutDate} (${nightsCount} nights) · Live availability checking`}
                </p>
              </div>

              <div className="d-flex align-items-center gap-2 mt-3 mt-md-0">
                <span className="text-muted small">
                  {language === 'vi' ? 'Sắp xếp theo:' : 'Sort by:'}
                </span>
                <Dropdown align="end">
                  <Dropdown.Toggle variant="outline-secondary" size="sm" className="fw-semibold">
                    {sortBy === 'recommended' && (language === 'vi' ? 'Lựa chọn hàng đầu của chúng tôi' : 'Our top picks')}
                    {sortBy === 'price_asc' && (language === 'vi' ? 'Giá (ưu tiên thấp nhất)' : 'Price (lowest first)')}
                    {sortBy === 'price_desc' && (language === 'vi' ? 'Giá (ưu tiên cao nhất)' : 'Price (highest first)')}
                    {sortBy === 'score_desc' && (language === 'vi' ? 'Điểm đánh giá & tốt nhất' : 'Top reviewed')}
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="shadow-sm border">
                    <Dropdown.Item active={sortBy === 'recommended'} onClick={() => setSortBy('recommended')}>
                      {language === 'vi' ? 'Lựa chọn hàng đầu của chúng tôi' : 'Our top picks'}
                    </Dropdown.Item>
                    <Dropdown.Item active={sortBy === 'price_asc'} onClick={() => setSortBy('price_asc')}>
                      {language === 'vi' ? 'Giá (ưu tiên thấp nhất)' : 'Price (lowest first)'}
                    </Dropdown.Item>
                    <Dropdown.Item active={sortBy === 'price_desc'} onClick={() => setSortBy('price_desc')}>
                      {language === 'vi' ? 'Giá (ưu tiên cao nhất)' : 'Price (highest first)'}
                    </Dropdown.Item>
                    <Dropdown.Item active={sortBy === 'score_desc'} onClick={() => setSortBy('score_desc')}>
                      {language === 'vi' ? 'Điểm đánh giá cao nhất' : 'Top reviewed'}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </div>

            <Row className="g-4">
              {/* Sidebar Filters */}
              <Col lg={3} md={4}>
                <FilterSidebar
                  filters={filters}
                  setFilters={setFilters}
                  language={language}
                />
              </Col>

              {/* Hotel Cards List */}
              <Col lg={9} md={8}>
                {filteredHotels.length > 0 ? (
                  filteredHotels.map(hotel => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      currency={currency}
                      language={language}
                      isFavorite={favorites.includes(hotel.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectHotel={handleSelectHotel}
                      nights={nightsCount}
                      checkInDate={checkInDate}
                      checkOutDate={checkOutDate}
                    />
                  ))
                ) : (
                  <div className="text-center py-5 bg-white rounded shadow-sm border p-4">
                    <i className="bi bi-search text-muted display-4 mb-3 d-block"></i>
                    <h5 className="fw-bold">{language === 'vi' ? 'Không tìm thấy chỗ nghỉ phù hợp' : 'No matching properties found'}</h5>
                    <p className="text-muted small">
                      {language === 'vi'
                        ? 'Hãy thử điều chỉnh lại bộ lọc ngân sách, số sao hoặc chọn một địa điểm khác.'
                        : 'Try adjusting your budget, stars filter, or select a different destination.'}
                    </p>
                  </div>
                )}
              </Col>
            </Row>
          </Container>
        </div>
      </>

      {/* Hotel Detail & Booking Modal */}
      {selectedHotel && (
        <HotelDetailModal
          hotel={selectedHotel}
          show={showHotelModal}
          onHide={() => setShowHotelModal(false)}
          currency={currency}
          language={language}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          user={user}
          onConfirmBooking={handleConfirmBooking}
        />
      )}

      {/* Auth Modal (Login / Register) */}
      <AuthModal
        show={authModal.show}
        initialMode={authModal.mode}
        onHide={() => setAuthModal({ show: false, mode: 'login' })}
        onLoginSuccess={(userData) => {
          setUser(userData);
          setAuthModal({ show: false, mode: 'login' });
        }}
        language={language}
      />

      {/* My Bookings Modal */}
      <MyBookingsModal
        show={showMyBookings}
        onHide={() => setShowMyBookings(false)}
        user={user}
        currency={currency}
        language={language}
        onBookingsChanged={fetchHotelsFromApi}
      />

      {/* Admin Dashboard Modal */}
      {user?.role === 'admin' && (
        <AdminDashboardModal
          show={showAdminDashboard}
          onHide={() => setShowAdminDashboard(false)}
          currency={currency}
          language={language}
          onDataChanged={fetchHotelsFromApi}
        />
      )}

      {/* Distributed System Monitor Modal - CHỈ DÀNH CHO ADMIN */}
      {user?.role === 'admin' && (
        <DistributedSystemModal
          show={showDistributedModal}
          onHide={() => setShowDistributedModal(false)}
        />
      )}

      {/* Universal Booking Toast Notification */}
      <ToastContainer position="top-end" className="p-3 position-fixed" style={{ zIndex: 9999 }}>
        <Toast
          show={bookingToast.show}
          onClose={() => setBookingToast(prev => ({ ...prev, show: false }))}
          delay={8000}
          autohide
          bg="success"
          className="text-white shadow-lg"
        >
          <Toast.Header closeButton className="bg-success text-white">
            <i className="bi bi-check-circle-fill me-2 fs-5"></i>
            <strong className="me-auto">{bookingToast.title}</strong>
            <small>{language === 'vi' ? 'Vừa xong' : 'Just now'}</small>
          </Toast.Header>
          <Toast.Body>
            <div className="mb-1">
              {language === 'vi' ? 'Mã xác nhận CSDL:' : 'Database Confirmation Code:'}{' '}
              <strong className="font-monospace fs-6">{bookingToast.code}</strong>
            </div>
            <div className="small opacity-95 mb-2">{bookingToast.message}</div>
            <button
              className="btn btn-sm btn-light text-success fw-bold py-1 px-2"
              onClick={() => {
                setBookingToast(prev => ({ ...prev, show: false }));
                setShowMyBookings(true);
              }}
            >
              <i className="bi bi-journal-text me-1"></i>Xem danh sách đơn của tôi
            </button>
          </Toast.Body>
        </Toast>
      </ToastContainer>

      {/* Footer */}
      <Footer language={language} />
    </div>
  );
}
