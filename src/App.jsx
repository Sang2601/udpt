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
        sortBy,
        checkIn: checkInDate,
        checkOut: checkOutDate
      });

      if (res.data && Array.isArray(res.data)) {
        // Lọc thêm tiện ích ở phía client nếu cần
        let list = res.data;
        if (filters.amenities.length > 0) {
          list = list.filter(hotel =>
            filters.amenities.every(a =>
              hotel.amenities?.some(ha => ha.toLowerCase().includes(a.toLowerCase()))
            )
          );
        }
        setHotels(list);
      }
    } catch (err) {
      console.warn('Không thể kết nối REST API backend, dùng dữ liệu khởi tạo:', err.message);
      setHotels(initialHotels);
    } finally {
      setLoadingHotels(false);
    }
  }, [activeSearchCity, filters, sortBy, checkInDate, checkOutDate]);

  useEffect(() => {
    fetchHotelsFromApi();
  }, [fetchHotelsFromApi]);

  // Handle Favorite Toggle
  const handleToggleFavorite = (hotelId) => {
    setFavorites(prev =>
      prev.includes(hotelId) ? prev.filter(id => id !== hotelId) : [...prev, hotelId]
    );
  };

  // Trigger Search for Stays
  const handleSearch = () => {
    setActiveSearchCity(destination.trim());
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Select Destination from cards
  const handleSelectDestination = (cityName) => {
    setDestination(cityName);
    setActiveSearchCity(cityName);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilters({
      stars: [],
      minScore: 0,
      maxPrice: 15000000,
      amenities: [],
      freeCancellation: false,
      propertyType: 'all'
    });
    setDestination('');
    setActiveSearchCity('');
  };

  // Open Hotel Detail Modal
  const handleOpenHotel = (hotel) => {
    setSelectedHotel(hotel);
    setShowHotelModal(true);
  };

  // Xử lý sau khi lưu đơn đặt phòng thành công vào CSDL
  const handleConfirmHotelBooking = (bookingData) => {
    const code = bookingData.booking?.booking_code || 'BK-' + Math.floor(100000 + Math.random() * 900000);
    setBookingToast({
      show: true,
      title: language === 'vi' ? 'Đặt phòng thành công & Đã lưu vào CSDL!' : 'Booking Confirmed & Saved!',
      message: `${bookingData.hotel.name} · ${bookingData.room.name}. Đơn đặt đã được ghi nhận trong cơ sở dữ liệu. Nhấn "Đơn của tôi" trên thanh tiêu đề để xem lịch sử.`,
      code
    });
    // Cập nhật lại số lượng phòng trống của các khách sạn ngay lập tức
    fetchHotelsFromApi();
  };

  // Tính số đêm lưu trú
  const calculateNights = () => {
    try {
      const dIn = new Date(checkInDate);
      const dOut = new Date(checkOutDate);
      const diffDays = Math.round((dOut - dIn) / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 1;
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
        }}
        onOpenMyBookings={() => setShowMyBookings(true)}
        onOpenAdminDashboard={() => setShowAdminDashboard(true)}
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
                    ? (language === 'vi' ? `${activeSearchCity}: tìm thấy ${hotels.length} chỗ nghỉ` : `${activeSearchCity}: ${hotels.length} properties found`)
                    : (language === 'vi' ? 'Các chỗ nghỉ & Tình trạng phòng thực tế từ CSDL' : 'Featured stays & Live database availability')}
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
                      {language === 'vi' ? 'Điểm đánh giá tốt nhất' : 'Top reviewed'}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </div>

            {(activeSearchCity || filters.propertyType !== 'all' || filters.stars.length > 0 || filters.minScore > 0 || filters.freeCancellation) && (
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <span className="small text-muted">{language === 'vi' ? 'Đang lọc:' : 'Active filters:'}</span>
                {activeSearchCity && (
                  <Badge bg="primary" className="p-2 fw-normal d-flex align-items-center gap-1">
                    <span>{activeSearchCity}</span>
                    <i className="bi bi-x cursor-pointer" onClick={() => { setActiveSearchCity(''); setDestination(''); }}></i>
                  </Badge>
                )}
                {filters.propertyType !== 'all' && (
                  <Badge bg="secondary" className="p-2 fw-normal d-flex align-items-center gap-1">
                    <span>Loại: {filters.propertyType}</span>
                    <i className="bi bi-x cursor-pointer" onClick={() => setFilters(p => ({ ...p, propertyType: 'all' }))}></i>
                  </Badge>
                )}
                {filters.stars.map(st => (
                  <Badge key={st} bg="warning" text="dark" className="p-2 fw-normal d-flex align-items-center gap-1">
                    <span>{st} sao</span>
                    <i className="bi bi-x cursor-pointer" onClick={() => setFilters(p => ({ ...p, stars: p.stars.filter(s => s !== st) }))}></i>
                  </Badge>
                ))}
                {filters.freeCancellation && (
                  <Badge bg="success" className="p-2 fw-normal d-flex align-items-center gap-1">
                    <span>Miễn phí hủy</span>
                    <i className="bi bi-x cursor-pointer" onClick={() => setFilters(p => ({ ...p, freeCancellation: false }))}></i>
                  </Badge>
                )}
                <button
                  className="btn btn-sm btn-link text-decoration-none p-0 text-danger ms-2"
                  onClick={handleResetFilters}
                >
                  {language === 'vi' ? 'Xóa tất cả bộ lọc' : 'Clear all'}
                </button>
              </div>
            )}

            <Row>
              <Col lg={3} className="mb-4">
                <FilterSidebar
                  filters={filters}
                  setFilters={setFilters}
                  onResetFilters={handleResetFilters}
                  language={language}
                />
              </Col>

              <Col lg={9}>
                {loadingHotels && hotels.length === 0 ? (
                  <div className="text-center py-5 bg-white rounded-3 border">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">Đang kết nối CSDL và kiểm tra phòng trống...</p>
                  </div>
                ) : hotels.length > 0 ? (
                  hotels.map(hotel => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      currency={currency}
                      isFavorite={favorites.includes(hotel.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelectHotel={handleOpenHotel}
                      language={language}
                      nights={nightsCount}
                    />
                  ))
                ) : (
                  <div className="text-center py-5 bg-white rounded-3 border">
                    <i className="bi bi-search text-muted" style={{ fontSize: '48px' }}></i>
                    <h4 className="fw-bold mt-3 text-dark">
                      {language === 'vi' ? 'Không tìm thấy chỗ nghỉ phù hợp' : 'No matching properties found'}
                    </h4>
                    <p className="text-muted">
                      {language === 'vi'
                        ? 'Thử nới lỏng các bộ lọc hoặc tìm kiếm địa điểm khác như Đà Nẵng, Hà Nội, TP. Hồ Chí Minh...'
                        : 'Try broadening your filters or searching for cities like Da Nang, Hanoi, Ho Chi Minh City...'}
                    </p>
                    <button className="btn btn-primary mt-2" onClick={handleResetFilters}>
                      {language === 'vi' ? 'Xem tất cả chỗ nghỉ' : 'View all properties'}
                    </button>
                  </div>
                )}
              </Col>
            </Row>
          </Container>
        </div>
      </>

      {/* Hotel Detail Modal (For Stays) */}
      {selectedHotel && (
        <HotelDetailModal
          key={selectedHotel?.id}
          hotel={selectedHotel}
          show={showHotelModal}
          onHide={() => setShowHotelModal(false)}
          currency={currency}
          onConfirmBooking={handleConfirmHotelBooking}
          language={language}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          user={user}
        />
      )}

      {/* Auth Modal (Login & Register with Real Database Persistence) */}
      <AuthModal
        show={authModal.show}
        mode={authModal.mode}
        setMode={(mode) => setAuthModal(prev => ({ ...prev, mode }))}
        onHide={() => setAuthModal({ show: false, mode: 'login' })}
        onLoginSuccess={(userData) => setUser(userData)}
        language={language}
      />

      {/* My Bookings Modal (User Bookings History & Cancellation) */}
      <MyBookingsModal
        show={showMyBookings}
        onHide={() => setShowMyBookings(false)}
        user={user}
        currency={currency}
        language={language}
        onBookingsChanged={fetchHotelsFromApi}
      />

      {/* Admin Dashboard Modal (Stats, Bookings Management, Hotel/Room Inventory) */}
      <AdminDashboardModal
        show={showAdminDashboard}
        onHide={() => setShowAdminDashboard(false)}
        currency={currency}
        language={language}
        onDataChanged={fetchHotelsFromApi}
      />

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
