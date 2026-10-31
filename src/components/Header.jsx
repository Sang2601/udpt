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
  onOpenAdminDashboard,
  onOpenDistributedModal
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
              <span className="logo-icon">
                <i className="bi bi-buildings-fill"></i>
              </span>
              <span>Phenikaa<span className="logo-hotel">Hotel</span></span>
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
                    <strong>VND</strong> - {language === 'vi' ? 'Đồng Việt Nam (₫)' : 'Vietnamese Dong (₫)'}
                  </Dropdown.Item>
                  <Dropdown.Item active={currency === 'USD'} onClick={() => setCurrency('USD')}>
                    <strong>USD</strong> - {language === 'vi' ? 'Đô la Mỹ ($)' : 'US Dollar ($)'}
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

              {/* Button: Bảng Điều Khiển Hệ Thống Phân Tán - CHỈ ADMIN MỚI ĐƯỢC PHÉP DÙNG */}
              {isAdmin && (
                <Button
                  variant="outline-light"
                  size="sm"
                  className="header-btn d-flex align-items-center gap-1.5 fw-semibold shadow-sm"
                  style={{ borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)' }}
                  onClick={onOpenDistributedModal}
                  title="Xem Sơ đồ cổng, 4 CSDL MySQL, Cân bằng tải, Chịu tải và Sao lưu (Chỉ Admin)"
                >
                  <i className="bi bi-diagram-3-fill text-warning"></i>
                  <span className="d-none d-md-inline">Hệ Thống Phân Tán</span>
                </Button>
              )}

              {/* Button: Trang Quản Trị (Chỉ hiển thị khi đã đăng nhập bằng tài khoản Admin) */}
              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  className="header-btn d-flex align-items-center gap-1.5 fw-semibold text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, var(--pka-orange) 0%, var(--pka-orange-hover) 100%)', border: 'none' }}
                  onClick={onOpenAdminDashboard}
                  title={language === 'vi' ? 'Quản lý khách sạn, phòng và toàn bộ đơn đặt trong CSDL' : 'Manage hotels, rooms, and bookings in database'}
                >
                  <i className="bi bi-shield-lock-fill"></i>
                  <span>{language === 'vi' ? 'Trang Quản Trị' : 'Admin Panel'}</span>
                </Button>
              )}

              {/* Auth or User Profile */}
              {user ? (
                <Dropdown align="end">
                  <Dropdown.Toggle as="button" className="header-btn header-btn-ghost d-flex align-items-center gap-2 border-0">
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: isAdmin ? '#dc3545' : 'var(--pka-orange)',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="fw-semibold d-none d-sm-inline">{user.name}</span>
                    {isAdmin && <Badge bg="danger" className="ms-1 small">Admin</Badge>}
                    <i className="bi bi-chevron-down ms-1" style={{ fontSize: '11px' }}></i>
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
                      <i className="bi bi-journal-text me-2" style={{ color: 'var(--pka-orange)' }}></i>
                      {language === 'vi' ? 'Đơn đặt phòng của tôi' : 'My Bookings'}
                    </Dropdown.Item>

                    {isAdmin && (
                      <Dropdown.Item onClick={onOpenDistributedModal} className="py-2">
                        <i className="bi bi-diagram-3 me-2 text-primary"></i>
                        Giám sát hệ thống phân tán
                      </Dropdown.Item>
                    )}

                    {isAdmin && (
                      <Dropdown.Item onClick={onOpenAdminDashboard} className="py-2">
                        <i className="bi bi-speedometer2 me-2" style={{ color: 'var(--pka-navy)' }}></i>
                        {language === 'vi' ? 'Bảng điều khiển quản trị' : 'Admin Dashboard'}
                      </Dropdown.Item>
                    )}

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
            {language === 'vi' ? 'PhenikaaHotel — Trải nghiệm lưu trú & Nghỉ dưỡng đẳng cấp' : 'PhenikaaHotel — Premium stays & Hospitality'}
          </h1>
        </Container>
      </div>
    </header>
  );
}
