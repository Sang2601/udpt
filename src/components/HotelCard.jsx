import React from 'react';
import { Row, Col, Badge } from 'react-bootstrap';
import { formatPrice } from '../utils/formatPrice';

export default function HotelCard({
  hotel,
  currency,
  isFavorite,
  onToggleFavorite,
  onSelectHotel,
  language,
  nights = 2
}) {
  const isSoldOut = hotel.isSoldOut;
  const availableRooms = hotel.totalAvailableRooms;

  return (
    <div className={`hotel-card ${isSoldOut ? 'opacity-75 border-danger' : ''}`}>
      <Row className="g-0">
        {/* Left Column: Image */}
        <Col md={4} lg={3}>
          <div className="hotel-img-container h-100 position-relative">
            <img src={hotel.images?.[0] || ''} alt={hotel.name} className="hotel-img" />
            <button
              className={`btn-favorite ${isFavorite ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(hotel.id);
              }}
              title={language === 'vi' ? 'Lưu vào danh sách yêu thích' : 'Save to favorites'}
            >
              <i className={`bi ${isFavorite ? 'bi-heart-fill' : 'bi-heart'}`}></i>
            </button>

            {isSoldOut && (
              <div
                className="position-absolute top-0 start-0 w-100 bg-danger text-white text-center py-1 fw-bold"
                style={{ fontSize: '11px', zIndex: 2 }}
              >
                <i className="bi bi-x-circle me-1"></i>HẾT PHÒNG TRONG KHOẢNG NGÀY NÀY
              </div>
            )}
          </div>
        </Col>

        {/* Center Column: Hotel Information */}
        <Col md={5} lg={6} className="p-3">
          <div className="d-flex align-items-center gap-2 mb-1">
            <h3
              className="fw-bold mb-0 text-primary cursor-pointer"
              style={{ fontSize: '18px', cursor: 'pointer' }}
              onClick={() => onSelectHotel(hotel)}
            >
              {hotel.name}
            </h3>
            <div className="text-warning d-flex align-items-center" style={{ fontSize: '12px' }}>
              {[...Array(hotel.starRating || 4)].map((_, i) => (
                <i key={i} className="bi bi-star-fill me-0.5"></i>
              ))}
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center gap-2 mb-2" style={{ fontSize: '12px' }}>
            <span className="text-primary fw-medium cursor-pointer">
              <i className="bi bi-geo-alt-fill me-1 text-danger"></i>
              {hotel.city}
            </span>
            <span className="text-muted">·</span>
            <span className="text-muted">{hotel.distance}</span>
            {hotel.beachDistance && (
              <>
                <span className="text-muted">·</span>
                <span className="text-success fw-semibold">
                  <i className="bi bi-water me-1"></i>
                  {hotel.beachDistance}
                </span>
              </>
            )}
          </div>

          {/* Badge */}
          {hotel.badge && (
            <div className="mb-2">
              <span
                style={{
                  backgroundColor: '#fff4e5',
                  color: '#b25e00',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  display: 'inline-block'
                }}
              >
                {hotel.badge}
              </span>
            </div>
          )}

          {/* Room Details */}
          <div className="border-start border-2 border-secondary ps-2 mb-2" style={{ fontSize: '12px' }}>
            <div className="fw-bold text-dark">{hotel.roomType || 'Phòng Tiêu Chuẩn'}</div>
            <div className="text-muted">{hotel.bedType || '1 giường đôi lớn'}</div>
          </div>

          {/* Inclusions & Policies */}
          <div style={{ fontSize: '12px' }}>
            {hotel.breakfastIncluded && (
              <div className="text-success fw-bold d-flex align-items-center gap-1">
                <i className="bi bi-check2"></i>
                {language === 'vi' ? 'Bao gồm bữa sáng tuyệt hảo' : 'Breakfast included'}
              </div>
            )}
            {hotel.freeCancellation && (
              <div className="text-success fw-bold d-flex align-items-center gap-1">
                <i className="bi bi-check2"></i>
                {language === 'vi' ? 'MIỄN PHÍ hủy phòng' : 'FREE cancellation'}
              </div>
            )}
            {hotel.noPrepayment && (
              <div className="text-muted d-flex align-items-center gap-1">
                <i className="bi bi-check2"></i>
                {language === 'vi' ? 'Không cần thanh toán trước – thanh toán tại chỗ nghỉ' : 'No prepayment needed – pay at the property'}
              </div>
            )}

            {/* Real Date Availability Indicator */}
            <div className="mt-2">
              {isSoldOut ? (
                <Badge bg="danger" className="p-1 px-2 fw-semibold">
                  <i className="bi bi-x-circle me-1"></i>Đã kín tất cả các phòng
                </Badge>
              ) : availableRooms !== undefined && availableRooms <= 3 ? (
                <div className="text-danger fw-semibold" style={{ fontSize: '11px' }}>
                  <i className="bi bi-fire me-1"></i>
                  {language === 'vi'
                    ? `Nhanh tay! Chỉ còn ${availableRooms} phòng trống cho ngày bạn chọn`
                    : `Hurry! Only ${availableRooms} rooms left for your dates`}
                </div>
              ) : (
                <div className="text-success fw-semibold" style={{ fontSize: '11px' }}>
                  <i className="bi bi-check-circle-fill me-1"></i>
                  {language === 'vi'
                    ? `Còn ${availableRooms || 5} phòng trống sẵn sàng đón khách`
                    : `${availableRooms || 5} rooms available`}
                </div>
              )}
            </div>
          </div>
        </Col>

        {/* Right Column: Review Score & Price */}
        <Col md={3} lg={3} className="p-3 d-flex flex-column justify-content-between border-start bg-light bg-opacity-25">
          {/* Review Score */}
          <div className="d-flex align-items-center justify-content-end gap-2 text-end">
            <div>
              <div className="fw-bold text-dark" style={{ fontSize: '14px', lineHeight: 1.2 }}>
                {hotel.reviewScoreWord}
              </div>
              <small className="text-muted" style={{ fontSize: '11px' }}>
                {(hotel.reviewCount || 100).toLocaleString()} {language === 'vi' ? 'đánh giá' : 'reviews'}
              </small>
            </div>
            <div className="review-badge-box">
              {hotel.reviewScore}
            </div>
          </div>

          {/* Price & Action */}
          <div className="text-end mt-3">
            <div className="text-muted" style={{ fontSize: '11px' }}>
              {language === 'vi' ? `${nights} đêm, 2 người lớn` : `${nights} nights, 2 adults`}
            </div>
            {hotel.originalPriceVND && (
              <div className="price-strike">
                {formatPrice(hotel.originalPriceVND * nights, currency)}
              </div>
            )}
            <div className="price-active">
              {formatPrice(hotel.priceVND * nights, currency)}
            </div>
            <div className="text-muted mb-2" style={{ fontSize: '11px' }}>
              {language === 'vi' ? 'Đã bao gồm thuế và phí' : 'Includes taxes & fees'}
            </div>
            <button
              className={`btn-check-avail w-100 justify-content-center ${isSoldOut ? 'btn-secondary bg-secondary' : ''}`}
              onClick={() => onSelectHotel(hotel)}
            >
              <span>{isSoldOut ? (language === 'vi' ? 'Xem chi tiết' : 'View details') : (language === 'vi' ? 'Xem chỗ trống' : 'See availability')}</span>
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </Col>
      </Row>
    </div>
  );
}
