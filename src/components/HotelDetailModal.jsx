import React, { useState, useEffect } from 'react';
import { Modal, Button, Row, Col, Form, Table, Alert, Badge, Spinner } from 'react-bootstrap';
import { formatPrice } from '../utils/formatPrice';
import { api } from '../services/api';

const reviewWordMap = {
  'Xuất sắc': 'Exceptional',
  'Tuyệt hảo': 'Superb',
  'Tuyệt vời': 'Wonderful',
  'Rất tốt': 'Very Good',
  'Tốt': 'Good',
  'Hài lòng': 'Pleasant'
};

const amenityMap = {
  'Hồ bơi vô cực': 'Infinity pool',
  'WiFi miễn phí': 'Free WiFi',
  'Bữa sáng thượng hạng': 'Premium breakfast',
  'Spa cao cấp': 'Luxury spa',
  'Bãi biển riêng': 'Private beach',
  'Phòng gym': 'Fitness center',
  'Đưa đón sân bay': 'Airport shuttle',
  'Bể bơi nước ấm': 'Heated pool',
  'Nhà hàng Pháp': 'French restaurant',
  'Quán bar': 'Cocktail bar',
  'Vườn nhiệt đới': 'Tropical garden',
  'Hồ bơi vô cực ngắm hoàng hôn': 'Sunset infinity pool',
  'Chèo kayak miễn phí': 'Free kayak',
  'Lớp Yoga sáng': 'Morning Yoga',
  'Bếp nướng BBQ': 'BBQ grill',
  'Hồ bơi trẻ em': 'Kids pool',
  'Rạp chiếu phim ngoài trời': 'Outdoor cinema',
  'Dịch vụ quản gia': 'Butler service',
  'Bể bơi tầng thượng': 'Rooftop pool',
  'Nhà hàng tầng 20 view sông': '20th-floor riverview dining',
  'Dịch vụ phòng 24/7': '24/7 room service'
};

const translateCapacity = (cap, lang) => {
  if (lang === 'vi' || !cap) return cap;
  return cap
    .replace('người lớn', 'adults')
    .replace('trẻ em', 'child')
    .replace('1 adults', '1 adult');
};

const translateDistance = (dist, lang) => {
  if (lang === 'vi' || !dist) return dist;
  return dist
    .replace('Cách trung tâm', 'From center:')
    .replace('Giáp biển', 'Beachfront')
    .replace('Gần Nhà Hát Lớn', 'Near Opera House')
    .replace('Gần Bãi biển Mỹ Khê', 'Near My Khe Beach')
    .replace('Sát bờ biển Bãi Dài', 'Direct Bai Dai Beach access')
    .replace('Gần Hồ Hoàn Kiếm', 'Near Hoan Kiem Lake')
    .replace('Cạnh Hồ Tuyền Lâm', 'Next to Tuyen Lam Lake')
    .replace('Gần Bến Bạch Đằng & Phố Đi Bộ', 'Near Bach Dang Wharf & Walking St.')
    .replace('Bãi Trường', 'Truong Beach');
};

export default function HotelDetailModal({
  hotel,
  show,
  onHide,
  currency,
  onConfirmBooking,
  language,
  checkInDate,
  checkOutDate,
  user
}) {
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState(hotel?.rooms?.[0]?.id || '');
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    requests: '',
    paymentMethod: 'hotel'
  });
  const [validated, setValidated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [hotelDetails, setHotelDetails] = useState(hotel);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Auto-fill user details if logged in or changed
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || ''
      }));
    }
  }, [user]);

  // Load fresh real-time room availability for selected dates from backend
  useEffect(() => {
    if (hotel?.id && show) {
      setLoadingRooms(true);
      api.hotels.getById(hotel.id, { checkIn: checkInDate, checkOut: checkOutDate })
        .then(res => {
          if (res.data) {
            setHotelDetails(res.data);
            const firstAvailable = res.data.rooms?.find(r => (r.availableUnits ?? 1) > 0);
            if (firstAvailable) {
              setSelectedRoomId(firstAvailable.id);
            }
          }
        })
        .catch(err => {
          console.error('Lỗi tải tình trạng phòng:', err);
        })
        .finally(() => {
          setLoadingRooms(false);
        });
    }
  }, [hotel?.id, show, checkInDate, checkOutDate]);

  if (!hotel) return null;

  const currentHotel = hotelDetails || hotel;
  const getGalleryImages = () => {
    let list = [];
    if (Array.isArray(currentHotel?.images) && currentHotel.images.length > 0) {
      list = currentHotel.images;
    } else if (currentHotel?.images_json) {
      try {
        list = typeof currentHotel.images_json === 'string' ? JSON.parse(currentHotel.images_json) : currentHotel.images_json;
      } catch (e) {
        list = [];
      }
    }
    if (!list || !list.length) {
      if (currentHotel?.image_url) list = [currentHotel.image_url];
      else list = [
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1000&q=80'
      ];
    }
    return list;
  };
  const galleryImages = getGalleryImages();
  const roomsList = currentHotel.rooms || [];
  const selectedRoom = roomsList.find(r => r.id === selectedRoomId) || roomsList[0];

  // Tính số đêm lưu trú thực tế từ checkInDate và checkOutDate
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

      const diffTime = dOut - dIn;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 2;
    }
  };

  const nights = calculateNights();
  const roomPricePerNight = selectedRoom?.priceVND || currentHotel.priceVND;
  const totalEstimatedPrice = roomPricePerNight * nights;

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.phone) {
      setValidated(true);
      return;
    }

    if ((selectedRoom?.availableUnits ?? 1) <= 0) {
      setBookingError(
        language === 'vi'
          ? 'Loại phòng này hiện đã hết trong khoảng ngày bạn chọn!'
          : 'This room type is sold out for your selected dates!'
      );
      return;
    }

    setSubmitting(true);
    setBookingError('');

    try {
      // Gửi yêu cầu đặt phòng lưu trực tiếp vào CSDL qua REST API
      const bookingPayload = {
        hotelId: currentHotel.id,
        roomId: selectedRoom?.id,
        guestName: formData.fullName,
        guestEmail: formData.email,
        guestPhone: formData.phone,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights,
        roomsCount: 1,
        specialRequests: formData.requests,
        paymentMethod: formData.paymentMethod,
        userId: user?.id || null
      };

      const res = await api.bookings.create(bookingPayload);

      // Thông báo thành công và gọi callback
      onConfirmBooking({
        hotel: currentHotel,
        room: selectedRoom,
        guest: formData,
        booking: res.booking,
        nights,
        totalPrice: res.booking.total_price_vnd
      });

      onHide();
    } catch (err) {
      setBookingError(err.message || (language === 'vi' ? 'Có lỗi xảy ra khi xử lý đơn đặt phòng.' : 'An error occurred while booking.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable>
      <Modal.Header closeButton className="border-bottom pb-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <Modal.Title className="fw-bold text-dark fs-4 mb-0">
              {currentHotel.name}
            </Modal.Title>
            <div className="text-warning">
              {[...Array(currentHotel.starRating || 5)].map((_, i) => (
                <i key={i} className="bi bi-star-fill me-0.5"></i>
              ))}
            </div>
          </div>
          <small className="text-muted d-flex align-items-center gap-1 mt-1">
            <i className="bi bi-geo-alt-fill text-danger"></i>
            {currentHotel.address} · <span className="text-primary fw-medium">{translateDistance(currentHotel.distance, language)}</span>
          </small>
        </div>
      </Modal.Header>

      <Modal.Body className="p-4">
        {/* Photo Gallery */}
        <div className="mb-4">
          <div style={{ height: '400px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
            <img
              src={galleryImages[activeImgIdx] || galleryImages[0]}
              onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80'; }}
              alt={currentHotel.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          {galleryImages.length > 1 && (
            <Row className="g-2 mt-2">
              {galleryImages.map((img, idx) => (
                <Col xs={3} key={idx}>
                  <img
                    src={img}
                    alt={`Thumbnail ${idx}`}
                    className={`gallery-thumbnail ${activeImgIdx === idx ? 'active' : ''}`}
                    onClick={() => setActiveImgIdx(idx)}
                  />
                </Col>
              ))}
            </Row>
          )}
        </div>

        {/* Highlights & Description */}
        <Row className="mb-4">
          <Col lg={8}>
            <h5 className="fw-bold text-dark mb-2">
              {language === 'vi' ? 'Tổng quan về chỗ nghỉ' : 'Property overview'}
            </h5>
            <p className="text-muted" style={{ lineHeight: 1.6 }}>
              {currentHotel.description}
            </p>

            <h6 className="fw-bold text-dark mt-3 mb-2">
              {language === 'vi' ? 'Tiện nghi được ưa chuộng nhất' : 'Most popular amenities'}
            </h6>
            <div className="d-flex flex-wrap gap-2">
              {currentHotel.amenities?.map((item, idx) => (
                <span
                  key={idx}
                  className="badge bg-light text-dark border p-2 fw-medium d-flex align-items-center gap-1"
                >
                  <i className="bi bi-check-circle-fill text-success"></i>
                  {language === 'vi' ? item : (amenityMap[item] || item)}
                </span>
              ))}
            </div>
          </Col>

          <Col lg={4} className="mt-3 mt-lg-0">
            <div className="p-3 bg-light rounded-3 border">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <div className="fw-bold">
                    {language === 'vi' ? currentHotel.reviewScoreWord : (reviewWordMap[currentHotel.reviewScoreWord] || currentHotel.reviewScoreWord || 'Superb')}
                  </div>
                  <small className="text-muted">
                    {currentHotel.reviewCount} {language === 'vi' ? 'đánh giá thực tế' : 'verified reviews'}
                  </small>
                </div>
                <div className="review-badge-box fs-5">
                  {currentHotel.reviewScore}
                </div>
              </div>

              <div className="border-top pt-3">
                <div className="fw-bold text-dark mb-2">
                  <i className="bi bi-calendar-event text-primary me-2"></i>
                  {language === 'vi' ? 'Khoảng ngày bạn chọn:' : 'Selected Dates:'}
                </div>
                <div className="bg-white p-2 rounded border small mb-2">
                  <span className="fw-semibold text-primary">{checkInDate}</span>
                  <i className="bi bi-arrow-right mx-2 text-muted"></i>
                  <span className="fw-semibold text-primary">{checkOutDate}</span>
                  <span className="badge bg-secondary-subtle text-dark ms-2">
                    {nights} {language === 'vi' ? 'đêm' : (nights > 1 ? 'nights' : 'night')}
                  </span>
                </div>
                <div className="small text-muted">
                  <i className="bi bi-check-circle-fill text-success me-1"></i>
                  {language === 'vi'
                    ? 'Hệ thống kiểm tra trực tiếp tình trạng phòng trống từ CSDL'
                    : 'Live availability checked directly against database'}
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {/* Room Selection Table with Real Availability */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">
              {language === 'vi' ? 'Kiểm tra phòng trống & Lựa chọn loại phòng' : 'Room Availability & Selection'}
            </h5>
            {loadingRooms && <Spinner size="sm" animation="border" variant="primary" />}
          </div>

          <div className="table-responsive border rounded-3">
            <Table hover className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>{language === 'vi' ? 'Loại phòng' : 'Room type'}</th>
                  <th>{language === 'vi' ? 'Sức chứa' : 'Capacity'}</th>
                  <th>{language === 'vi' ? 'Tình trạng phòng' : 'Availability'}</th>
                  <th>{language === 'vi' ? `Giá (${nights} đêm)` : `Price (${nights} ${nights > 1 ? 'nights' : 'night'})`}</th>
                  <th className="text-center">{language === 'vi' ? 'Lựa chọn' : 'Select'}</th>
                </tr>
              </thead>
              <tbody>
                {roomsList.map((rm) => {
                  const isSelected = selectedRoomId === rm.id;
                  const availableUnits = rm.availableUnits ?? 5;
                  const isSoldOut = availableUnits <= 0;

                  return (
                    <tr
                      key={rm.id}
                      className={isSoldOut ? 'table-secondary opacity-75' : isSelected ? 'table-primary table-opacity-10' : ''}
                    >
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {rm.image_url && (
                            <img
                              src={rm.image_url}
                              alt={rm.name}
                              style={{ width: '56px', height: '42px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <div>
                            <div className="fw-bold text-dark">{rm.name}</div>
                            <small className="text-muted">
                              {language === 'vi' ? 'Diện tích:' : 'Size:'} {rm.size || '35 m²'}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <i className="bi bi-person-fill text-muted me-1"></i>
                        {translateCapacity(rm.capacity, language)}
                      </td>
                      <td>
                        {isSoldOut ? (
                          <Badge bg="danger" className="px-2 py-1">
                            <i className="bi bi-x-circle me-1"></i>
                            {language === 'vi' ? 'HẾT PHÒNG' : 'SOLD OUT'}
                          </Badge>
                        ) : availableUnits === 1 ? (
                          <Badge bg="warning" text="dark" className="px-2 py-1">
                            <i className="bi bi-exclamation-triangle me-1"></i>
                            {language === 'vi' ? 'Chỉ còn 1 phòng!' : 'Only 1 room left!'}
                          </Badge>
                        ) : (
                          <Badge bg="success" className="px-2 py-1">
                            <i className="bi bi-check-circle me-1"></i>
                            {language === 'vi' ? `Còn ${availableUnits} phòng trống` : `${availableUnits} rooms available`}
                          </Badge>
                        )}
                        {rm.breakfast && (
                          <div className="text-success small fw-semibold mt-1">
                            <i className="bi bi-check2"></i> {language === 'vi' ? 'Bao gồm ăn sáng' : 'Breakfast included'}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="fw-bold text-dark fs-6">
                          {formatPrice((rm.priceVND || rm.price_vnd) * nights, currency)}
                        </div>
                        <small className="text-muted">
                          {formatPrice(rm.priceVND || rm.price_vnd, currency)}/{language === 'vi' ? 'đêm' : 'night'}
                        </small>
                      </td>
                      <td className="text-center">
                        <Button
                          variant={isSoldOut ? 'secondary' : isSelected ? 'primary' : 'outline-primary'}
                          size="sm"
                          disabled={isSoldOut}
                          onClick={() => setSelectedRoomId(rm.id)}
                        >
                          {isSoldOut
                            ? (language === 'vi' ? 'Hết phòng' : 'Sold out')
                            : isSelected
                            ? (language === 'vi' ? '✓ Đã chọn' : '✓ Selected')
                            : (language === 'vi' ? 'Chọn phòng' : 'Select')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </div>

        {/* Booking Form */}
        <div className="p-4 bg-light rounded-3 border">
          <h5 className="fw-bold text-dark mb-3">
            <i className="bi bi-shield-check text-success me-2"></i>
            {language === 'vi' ? 'Thông tin người đặt phòng & Xác nhận CSDL' : 'Guest Information & Reservation'}
          </h5>

          {bookingError && <Alert variant="danger" dismissible onClose={() => setBookingError('')}>{bookingError}</Alert>}

          {validated && (!formData.fullName || !formData.email || !formData.phone) && (
            <Alert variant="danger" className="py-2 small">
              {language === 'vi' ? 'Vui lòng điền đầy đủ Họ tên, Email và Số điện thoại!' : 'Please enter your full name, email, and phone number!'}
            </Alert>
          )}

          <Form onSubmit={handleBookingSubmit}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{language === 'vi' ? 'Họ và tên khách *' : 'Full Name *'}</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Nguyễn Văn A"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{language === 'vi' ? 'Email nhận xác nhận *' : 'Confirmation Email *'}</Form.Label>
                  <Form.Control
                    type="email"
                    placeholder="example@gmail.com"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{language === 'vi' ? 'Số điện thoại *' : 'Phone *'}</Form.Label>
                  <Form.Control
                    type="tel"
                    placeholder="0912 345 678"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="small fw-semibold">{language === 'vi' ? 'Yêu cầu đặc biệt (tùy chọn)' : 'Special requests (optional)'}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder={language === 'vi' ? 'Tầng cao, phòng không hút thuốc, nhận phòng muộn...' : 'High floor, non-smoking, late check-in...'}
                    value={formData.requests}
                    onChange={(e) => setFormData({ ...formData, requests: e.target.value })}
                  />
                </Form.Group>
              </Col>

              <Col md={12} className="pt-2">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                  <div>
                    <span className="text-muted small">{language === 'vi' ? `Tổng tiền (${nights} đêm): ` : `Total (${nights} ${nights > 1 ? 'nights' : 'night'}): `}</span>
                    <span className="fw-bold text-primary fs-4 ms-2">
                      {formatPrice(totalEstimatedPrice, currency)}
                    </span>
                    <span className="badge bg-success-subtle text-success border ms-2">
                      {language === 'vi' ? 'Thanh toán tại chỗ nghỉ' : 'Pay at property'}
                    </span>
                  </div>

                  <div className="d-flex gap-2">
                    <Button variant="secondary" onClick={onHide} disabled={submitting}>
                      {language === 'vi' ? 'Đóng' : 'Close'}
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      className="px-4 fw-bold"
                      disabled={submitting || (selectedRoom?.availableUnits ?? 1) <= 0}
                    >
                      {submitting ? (
                        <><Spinner size="sm" animation="border" className="me-2" />{language === 'vi' ? 'Đang lưu vào CSDL...' : 'Saving reservation...'}</>
                      ) : (
                        <><i className="bi bi-check2-circle me-1"></i>{language === 'vi' ? 'Xác nhận & Lưu đơn đặt' : 'Confirm & Book Now'}</>
                      )}
                    </Button>
                  </div>
                </div>
              </Col>
            </Row>
          </Form>
        </div>
      </Modal.Body>
    </Modal>
  );
}
