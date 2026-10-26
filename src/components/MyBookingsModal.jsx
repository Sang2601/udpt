import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Badge, Form, InputGroup, Alert, Spinner } from 'react-bootstrap';
import { api } from '../services/api';
import { formatPrice } from '../utils/formatPrice';

export default function MyBookingsModal({ show, onHide, user, currency, language, onBookingsChanged }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [searchEmail, setSearchEmail] = useState(user?.email || '');
  const [cancellingId, setCancellingId] = useState(null);

  const fetchBookings = async () => {
    const emailToUse = user?.email || searchEmail;
    if (!emailToUse) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.bookings.getMyBookings(emailToUse, user?.id);
      setBookings(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      if (user?.email) {
        setSearchEmail(user.email);
      }
      fetchBookings();
    }
  }, [show, user]);

  const handleLookupByCode = async (e) => {
    e.preventDefault();
    if (!searchCode.trim()) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.bookings.getByCode(searchCode.trim());
      if (res.data) {
        setBookings([res.data]);
      }
    } catch (err) {
      setError(err.message || 'Không tìm thấy đơn đặt phòng với mã này');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (booking) => {
    const confirmText = language === 'vi'
      ? `Bạn có chắc chắn muốn hủy đơn đặt phòng #${booking.booking_code} tại "${booking.hotel_name}"?`
      : `Are you sure you want to cancel booking #${booking.booking_code}?`;

    if (!window.confirm(confirmText)) return;

    setCancellingId(booking.id);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.bookings.cancel(booking.id);
      setSuccessMsg(res.message || 'Đã hủy đơn đặt phòng thành công!');
      await fetchBookings();
      if (onBookingsChanged) onBookingsChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <Badge bg="success" className="px-2 py-1"><i className="bi bi-check-circle me-1"></i>Đã xác nhận</Badge>;
      case 'completed':
        return <Badge bg="primary" className="px-2 py-1"><i className="bi bi-building-check me-1"></i>Đã hoàn thành</Badge>;
      case 'cancelled':
        return <Badge bg="danger" className="px-2 py-1"><i className="bi bi-x-circle me-1"></i>Đã hủy đơn</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable>
      <Modal.Header closeButton className="border-bottom">
        <div>
          <Modal.Title className="fw-bold fs-4 d-flex align-items-center gap-2">
            <i className="bi bi-journal-text text-primary"></i>
            {language === 'vi' ? 'Lịch sử & Quản lý đơn đặt phòng' : 'My Bookings & Reservations'}
          </Modal.Title>
          <small className="text-muted">
            {language === 'vi'
              ? 'Dữ liệu được lưu trữ và truy vấn trực tiếp từ cơ sở dữ liệu (SQLite/MySQL).'
              : 'Directly stored and queried from the relational database.'}
          </small>
        </div>
      </Modal.Header>

      <Modal.Body className="p-4 bg-light">
        {/* Search / Filter bar */}
        <div className="bg-white p-3 rounded-3 border shadow-sm mb-4">
          <div className="row g-3 align-items-center">
            <div className="col-md-6">
              <Form onSubmit={handleLookupByCode}>
                <Form.Label className="small fw-semibold text-muted mb-1">
                  {language === 'vi' ? 'Tra cứu nhanh theo mã đơn (VD: BK-928174)' : 'Lookup by Booking Code'}
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Nhập mã đơn (BK-xxxxxx)..."
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                  />
                  <Button variant="primary" type="submit" disabled={loading}>
                    <i className="bi bi-search me-1"></i> {language === 'vi' ? 'Tra cứu' : 'Find'}
                  </Button>
                </InputGroup>
              </Form>
            </div>

            <div className="col-md-6">
              <Form onSubmit={(e) => { e.preventDefault(); fetchBookings(); }}>
                <Form.Label className="small fw-semibold text-muted mb-1">
                  {language === 'vi' ? 'Tìm theo email đặt phòng' : 'Search by Guest Email'}
                </Form.Label>
                <InputGroup>
                  <Form.Control
                    type="email"
                    placeholder="email@example.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                  />
                  <Button variant="outline-secondary" type="submit" disabled={loading}>
                    <i className="bi bi-arrow-clockwise me-1"></i> {language === 'vi' ? 'Tải lại đơn' : 'Refresh'}
                  </Button>
                </InputGroup>
              </Form>
            </div>
          </div>
        </div>

        {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
        {successMsg && <Alert variant="success" dismissible onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

        {/* Bookings List */}
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">{language === 'vi' ? 'Đang truy vấn CSDL...' : 'Fetching database...'}</p>
          </div>
        ) : bookings.length > 0 ? (
          <div className="table-responsive bg-white rounded-3 border shadow-sm">
            <Table hover className="align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Mã đơn</th>
                  <th>Chỗ nghỉ & Loại phòng</th>
                  <th>Thời gian lưu trú</th>
                  <th>Thông tin khách</th>
                  <th>Tổng thanh toán</th>
                  <th>Trạng thái</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="fw-bold text-primary font-monospace fs-6">
                        {b.booking_code}
                      </span>
                      <div className="text-muted small">
                        {new Date(b.created_at).toLocaleDateString('vi-VN')}
                      </div>
                    </td>

                    <td>
                      <div className="fw-bold text-dark">{b.hotel_name}</div>
                      <div className="text-muted small">
                        <i className="bi bi-door-closed me-1"></i>{b.room_name}
                      </div>
                      <div className="text-muted small">
                        <i className="bi bi-geo-alt me-1"></i>{b.hotel_city}
                      </div>
                    </td>

                    <td>
                      <div className="fw-semibold">
                        {b.check_in} <i className="bi bi-arrow-right text-muted mx-1"></i> {b.check_out}
                      </div>
                      <span className="badge bg-light text-dark border">
                        {b.nights} đêm · {b.rooms_count} phòng
                      </span>
                    </td>

                    <td>
                      <div className="fw-semibold">{b.guest_name}</div>
                      <div className="small text-muted">{b.guest_email}</div>
                      <div className="small text-muted">{b.guest_phone}</div>
                    </td>

                    <td>
                      <div className="fw-bold text-dark fs-6">
                        {formatPrice(b.total_price_vnd, currency)}
                      </div>
                      <small className="text-muted">Thanh toán tại chỗ nghỉ</small>
                    </td>

                    <td>{getStatusBadge(b.status)}</td>

                    <td className="text-center">
                      {b.status === 'confirmed' ? (
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancelBooking(b)}
                        >
                          {cancellingId === b.id ? (
                            <Spinner size="sm" animation="border" />
                          ) : (
                            <><i className="bi bi-x-circle me-1"></i>Hủy phòng</>
                          )}
                        </Button>
                      ) : (
                        <span className="text-muted small">Không khả dụng</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-5 bg-white rounded-3 border">
            <i className="bi bi-inbox text-muted" style={{ fontSize: '48px' }}></i>
            <h5 className="fw-bold mt-3 text-dark">
              {language === 'vi' ? 'Chưa tìm thấy đơn đặt phòng nào' : 'No reservations found'}
            </h5>
            <p className="text-muted small">
              {language === 'vi'
                ? 'Hãy thực hiện đặt phòng từ danh sách khách sạn hoặc tra cứu theo mã đơn BK-xxxxxx.'
                : 'Book a room from the featured hotel list or look up using your booking code.'}
            </p>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="border-top">
        <Button variant="secondary" onClick={onHide}>
          {language === 'vi' ? 'Đóng' : 'Close'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
