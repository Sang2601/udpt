import React from 'react';
import { Container, Dropdown, Button, Badge } from 'react-bootstrap';

export default function Header({
  currency,
  setCurrency,
  language,
  setLanguage,
  user,
  onOpenAuth,
  onLogout,
  onOpenMyBookings,
  onOpenAdminDashboard
}) {
  const isAdmin = user?.role === 'admin';

  return (
    <header className="booking-header">
      {/* Top Navbar */}
      <div className="booking-header-top">
        <Container>
          <div className="d-flex align-items-center justify-content-between">
            {/* Logo */}
            <a href="#" className="booking-logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              Hotel<span>Booking</span>
            </a>

            {/* Right Nav Utilities */}
            <div className="d-flex align-items-center gap-2">
              {/* Currency Selector */}
              <Dropdown align="end">
                <Dropdown.Toggle as="button" className="header-btn header-btn-ghost d-flex align-items-center gap-1 border-0">
                  <span className="fw-bold">{currency === 'VND' ? 'VND' : 'USD'}</span>
                  <i className="bi bi-chevron-down ms-1" style={{ fontSize: '11px' }}></i>
                </Dropdown.Toggle>
                <Dropdown.Menu className="shadow-sm border">
                  <Dropdown.Item active={currency === 'VND'} onClick={() => setCurrency('VND')}>
                    <strong>VND</strong> - Đồng Việt Nam (₫)
                  </Dropdown.Item>
                  <Dropdown.Item active={currency === 'USD'} onClick={() => setCurrency('USD')}>
                    <strong>USD</strong> - Đô la Mỹ ($)
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              {/* Language Selector */}
              <Dropdown align="end">
                <Dropdown.Toggle as="button" className="header-btn header-btn-ghost d-flex align-items-center gap-1 border-0">
                  <span style={{ fontSize: '18px' }}>{language === 'vi' ? '🇻🇳' : '🇬🇧'}</span>
                  <i className="bi bi-chevron-down ms-1" style={{ fontSize: '11px' }}></i>
                </Dropdown.Toggle>
                <Dropdown.Menu className="shadow-sm border">
                  <Dropdown.Item active={language === 'vi'} onClick={() => setLanguage('vi')}>
                    <span className="me-2">🇻🇳</span> Tiếng Việt
                  </Dropdown.Item>
                  <Dropdown.Item active={language === 'en'} onClick={() => setLanguage('en')}>
                    <span className="me-2">🇬🇧</span> English (US)
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              {/* Button: Đơn đặt của tôi */}
              <Button
                variant="outline-light"
                size="sm"
                className="header-btn d-flex align-items-center gap-1.5 fw-semibold border-white border-opacity-25"
                onClick={onOpenMyBookings}
              >
                <i className="bi bi-journal-bookmark-fill text-warning"></i>
                <span className="d-none d-md-inline">{language === 'vi' ? 'Đơn của tôi' : 'My Bookings'}</span>
              </Button>

              {/* Button: Trang Quản Trị (Admin Panel) */}
              <Button
                variant={isAdmin ? 'warning' : 'outline-light'}
                size="sm"
                className={`header-btn d-flex align-items-center gap-1.5 fw-semibold ${isAdmin ? 'text-dark' : 'border-white border-opacity-25'}`}
                onClick={onOpenAdminDashboard}
                title="Quản lý khách sạn, phòng và toàn bộ đơn đặt trong CSDL"
              >
                <i className="bi bi-shield-lock-fill"></i>
                <span className="d-none d-lg-inline">{language === 'vi' ? 'Trang Quản Trị' : 'Admin Panel'}</span>
              </Button>

              {/* Auth or User Profile */}
              {user ? (
                <Dropdown align="end">
                  <Dropdown.Toggle as="button" className="header-btn header-btn-ghost d-flex align-items-center gap-2 border-0">
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: isAdmin ? '#dc3545' : '#ffb700',
                        color: isAdmin ? '#ffffff' : '#003580',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="fw-semibold d-none d-sm-inline">{user.name}</span>
                    {isAdmin && <Badge bg="danger" className="ms-1 small">Admin</Badge>}
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="shadow border" style={{ minWidth: '240px' }}>
                    <div className="px-3 py-2 border-bottom">
                      <div className="fw-bold d-flex align-items-center justify-content-between">
                        <span>{user.name}</span>
                        {isAdmin && <Badge bg="danger">Admin</Badge>}
                      </div>
                      <small className="text-muted">{user.email}</small>
                    </div>

                    <Dropdown.Item onClick={onOpenMyBookings} className="py-2">
                      <i className="bi bi-journal-text me-2 text-primary"></i>
                      {language === 'vi' ? 'Đơn đặt phòng của tôi' : 'My Bookings'}
                    </Dropdown.Item>

                    <Dropdown.Item onClick={onOpenAdminDashboard} className="py-2">
                      <i className="bi bi-speedometer2 me-2 text-warning"></i>
                      {language === 'vi' ? 'Bảng điều khiển quản trị' : 'Admin Dashboard'}
                    </Dropdown.Item>

                    <Dropdown.Divider />

                    <Dropdown.Item onClick={onLogout} className="text-danger py-2">
                      <i className="bi bi-box-arrow-right me-2"></i> {language === 'vi' ? 'Đăng xuất' : 'Sign out'}
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <div className="d-flex align-items-center gap-2">
                  <Button
                    variant="link"
                    className="header-btn header-btn-white text-decoration-none"
                    onClick={() => onOpenAuth('register')}
                  >
                    {language === 'vi' ? 'Đăng ký' : 'Register'}
                  </Button>
                  <Button
                    variant="link"
                    className="header-btn header-btn-white text-decoration-none"
                    onClick={() => onOpenAuth('login')}
                  >
                    {language === 'vi' ? 'Đăng nhập' : 'Sign in'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Container>
      </div>

      {/* Hero Section */}
      <div className="hero-section">
        <Container>
          <h1 className="hero-title">
            {language === 'vi' ? 'Tìm khách sạn & Kiểm tra phòng trống theo ngày' : 'Find your next stay with real availability'}
          </h1>
          <p className="hero-subtitle">
            {language === 'vi'
              ? 'Hệ thống kết nối trực tiếp CSDL (SQLite/MySQL/PostgreSQL) với kiểm tra phòng trống và lưu đơn theo thời gian thực.'
              : 'Connected directly to relational database with real-time room availability & booking.'}
          </p>
        </Container>
      </div>
    </header>
  );
}
