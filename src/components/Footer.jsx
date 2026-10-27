import { Container, Row, Col } from 'react-bootstrap';

export default function Footer({ language }) {
  return (
    <footer className="booking-footer mt-auto">
      {/* Newsletter / PKA Highlights */}
      <div className="footer-newsletter">
        <Container>
          <h3 className="fw-bold fs-2 text-white mb-2">
            {language === 'vi' ? 'Tiết kiệm thời gian, chi phí cùng PhenikaaHotel' : 'Save time and money with PhenikaaHotel'}
          </h3>
          <p className="text-white-50 mb-0" style={{ maxWidth: '640px', margin: '0 auto' }}>
            {language === 'vi'
              ? 'Khám phá chuỗi khách sạn, resort tiện nghi với chính sách giá ưu đãi độc quyền dành cho khách hàng và đối tác của Tập đoàn Phenikaa.'
              : 'Discover curated stays and resorts with exclusive member benefits from Phenikaa Group.'}
          </p>
        </Container>
      </div>

      {/* Corporate Links */}
      <div className="footer-links-section bg-white border-top">
        <Container>
          <Row className="gy-4">
            <Col lg={4} md={6}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <span className="logo-icon" style={{ width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--pka-orange) 0%, #FF853E 100%)', borderRadius: '6px', color: '#ffffff', fontSize: '18px' }}>
                  <i className="bi bi-buildings-fill"></i>
                </span>
                <span className="fw-bold fs-4" style={{ color: 'var(--pka-navy)' }}>
                  Phenikaa<span style={{ color: 'var(--pka-orange)' }}>Hotel</span>
                </span>
              </div>
              <p className="text-muted small mb-3">
                {language === 'vi'
                  ? 'Hệ thống đặt phòng khách sạn và dịch vụ lưu trú hiện đại thuộc Tập đoàn Phenikaa (PKA Group). Đổi mới sáng tạo, tận tâm phục vụ vì trải nghiệm trọn vẹn của khách hàng.'
                  : 'Modern hospitality and hotel reservation platform under Phenikaa Group (PKA). Dedicated to innovation, quality, and exceptional guest experiences.'}
              </p>
              <div className="d-flex gap-3">
                <a href="https://phenikaa.com" target="_blank" rel="noreferrer" className="text-muted fs-5"><i className="bi bi-globe"></i></a>
                <a href="#" className="text-muted fs-5"><i className="bi bi-facebook"></i></a>
                <a href="#" className="text-muted fs-5"><i className="bi bi-youtube"></i></a>
                <a href="#" className="text-muted fs-5"><i className="bi bi-linkedin"></i></a>
              </div>
            </Col>

            <Col lg={2} md={6} sm={6}>
              <div className="footer-heading">
                {language === 'vi' ? 'Hệ sinh thái PKA' : 'PKA Ecosystem'}
              </div>
              <ul className="footer-link-list">
                <li><a href="https://phenikaa.com" target="_blank" rel="noreferrer">{language === 'vi' ? 'Tập đoàn Phenikaa' : 'Phenikaa Group'}</a></li>
                <li><a href="https://phenikaa-uni.edu.vn" target="_blank" rel="noreferrer">{language === 'vi' ? 'Trường ĐH Phenikaa' : 'Phenikaa University'}</a></li>
                <li><a href="https://vicostone.com" target="_blank" rel="noreferrer">Vicostone</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Phenikaa-X</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>{language === 'vi' ? 'BVĐK Phenikaa' : 'Phenikaa Hospital'}</a></li>
              </ul>
            </Col>

            <Col lg={3} md={6} sm={6}>
              <div className="footer-heading">
                {language === 'vi' ? 'Điểm đến nổi bật' : 'Featured Destinations'}
              </div>
              <ul className="footer-link-list">
                <li><a href="#" onClick={(e) => e.preventDefault()}>{language === 'vi' ? 'Khách sạn tại Hà Nội' : 'Hotels in Hanoi'}</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>{language === 'vi' ? 'Resort & Khách sạn Đà Nẵng' : 'Resorts & Hotels in Da Nang'}</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>{language === 'vi' ? 'Khách sạn TP. Hồ Chí Minh' : 'Hotels in Ho Chi Minh City'}</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>{language === 'vi' ? 'Khách sạn nghỉ dưỡng Đà Lạt' : 'Resorts in Da Lat'}</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>{language === 'vi' ? 'Khu nghỉ dưỡng Phú Quốc' : 'Resorts in Phu Quoc'}</a></li>
              </ul>
            </Col>

            <Col lg={3} md={6}>
              <div className="footer-heading">
                {language === 'vi' ? 'Thông tin liên hệ' : 'Contact Information'}
              </div>
              <ul className="footer-link-list text-muted small" style={{ listStyle: 'none', padding: 0 }}>
                <li className="mb-2 d-flex align-items-start gap-2">
                  <i className="bi bi-geo-alt-fill text-danger mt-1"></i>
                  <span>
                    {language === 'vi'
                      ? 'Tòa nhà Phenikaa, Đường Tố Hữu, Phường Vạn Phúc, TP. Hà Nội'
                      : 'Phenikaa Building, To Huu St., Van Phuc, Hanoi, Vietnam'}
                  </span>
                </li>
                <li className="mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-telephone-fill" style={{ color: 'var(--pka-orange)' }}></i>
                  <span>Hotline: 1900 1234 · (024) 2218 0336</span>
                </li>
                <li className="mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-envelope-fill" style={{ color: 'var(--pka-navy-light)' }}></i>
                  <span>contact@phenikaahotel.com</span>
                </li>
              </ul>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Copyright Bar */}
      <div className="footer-nav-top py-3 text-white text-center small border-top border-dark border-opacity-25" style={{ backgroundColor: 'var(--pka-navy-dark)' }}>
        <Container>
          <div className="d-flex flex-wrap justify-content-between align-items-center">
            <span className="text-white-50">
              © {new Date().getFullYear()} <strong>PhenikaaHotel</strong>. {language === 'vi' ? 'Bản quyền thuộc Tập đoàn Phenikaa (PKA Group).' : 'All rights reserved by Phenikaa Group.'}
            </span>
            <span className="text-white-50">
              {language === 'vi' ? 'Phát triển trên nền tảng React 19 + Vite & REST API CSDL Phân tán.' : 'Powered by React 19 + Vite & Distributed Database REST API.'}
            </span>
          </div>
        </Container>
      </div>
    </footer>
  );
}
