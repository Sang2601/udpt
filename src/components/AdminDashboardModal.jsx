import React, { useState, useEffect } from 'react';
import { Modal, Button, Tabs, Tab, Table, Badge, Form, Row, Col, Alert, Spinner, Card } from 'react-bootstrap';
import { api } from '../services/api';
import { formatPrice } from '../utils/formatPrice';

export default function AdminDashboardModal({ show, onHide, currency, language, onDataChanged }) {
  const [activeTab, setActiveTab] = useState('stats');

  // Stats State
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);

  // Bookings State
  const [allBookings, setAllBookings] = useState([]);
  const [bookingFilterStatus, setBookingFilterStatus] = useState('all');
  const [bookingSearch, setBookingSearch] = useState('');

  // Hotels State
  const [hotels, setHotels] = useState([]);
  const [selectedHotelForRooms, setSelectedHotelForRooms] = useState(null);

  // Forms & Modal State
  const [showAddHotelModal, setShowAddHotelModal] = useState(false);
  const [newHotelForm, setNewHotelForm] = useState({
    name: '',
    city: 'Hà Nội',
    address: '',
    type: 'hotel',
    starRating: 4,
    priceVND: 1500000,
    description: '',
    distance: 'Cách trung tâm 1 km'
  });

  const [newRoomForm, setNewRoomForm] = useState({
    name: 'Phòng Deluxe King',
    size: '35 m²',
    priceVND: 1500000,
    capacity: '2 người lớn',
    totalUnits: 5,
    breakfast: true
  });

  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState({ text: '', type: 'success' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, bookingsRes, hotelsRes] = await Promise.all([
        api.admin.getStats(),
        api.admin.getBookings({ status: bookingFilterStatus, search: bookingSearch }),
        api.hotels.getAll({ sortBy: 'price_desc' })
      ]);

      setStats(statsRes.stats);
      setRecentBookings(statsRes.recentBookings || []);
      setAllBookings(bookingsRes.data || []);
      setHotels(hotelsRes.data || []);
    } catch (err) {
      setActionMsg({
        text: (language === 'vi' ? 'Lỗi tải dữ liệu quản trị: ' : 'Admin data loading error: ') + err.message,
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      loadData();
    }
  }, [show, bookingFilterStatus]);

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      await api.admin.updateBookingStatus(bookingId, newStatus);
      setActionMsg({
        text: language === 'vi' ? `Đã cập nhật trạng thái đơn #${bookingId} thành công!` : `Booking #${bookingId} status updated successfully!`,
        type: 'success'
      });
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      setActionMsg({ text: err.message, type: 'danger' });
    }
  };

  const handleCreateHotel = async (e) => {
    e.preventDefault();
    if (!newHotelForm.name || !newHotelForm.city || !newHotelForm.priceVND) {
      alert(language === 'vi' ? 'Vui lòng điền các trường bắt buộc' : 'Please fill required fields');
      return;
    }

    try {
      await api.admin.createHotel(newHotelForm);
      setActionMsg({
        text: language === 'vi' ? 'Đã thêm khách sạn mới vào cơ sở dữ liệu!' : 'New hotel added to database successfully!',
        type: 'success'
      });
      setShowAddHotelModal(false);
      setNewHotelForm({
        name: '',
        city: 'Hà Nội',
        address: '',
        type: 'hotel',
        starRating: 4,
        priceVND: 1500000,
        description: '',
        distance: 'Cách trung tâm 1 km'
      });
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      alert((language === 'vi' ? 'Lỗi tạo khách sạn: ' : 'Create hotel error: ') + err.message);
    }
  };

  const handleDeleteHotel = async (hotel) => {
    const confirmMsg = language === 'vi'
      ? `Bạn có chắc muốn xóa khách sạn "${hotel.name}" khỏi hệ thống?`
      : `Are you sure you want to delete "${hotel.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.admin.deleteHotel(hotel.id);
      setActionMsg({
        text: language === 'vi' ? `Đã xóa khách sạn ${hotel.name}!` : `Deleted hotel ${hotel.name}!`,
        type: 'success'
      });
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      setActionMsg({ text: err.message, type: 'danger' });
    }
  };

  const handleAddRoomToHotel = async (e) => {
    e.preventDefault();
    if (!selectedHotelForRooms) return;
    try {
      await api.admin.addRoom(selectedHotelForRooms.id, newRoomForm);
      setActionMsg({
        text: language === 'vi' ? `Đã thêm loại phòng mới cho ${selectedHotelForRooms.name}!` : `Added new room type to ${selectedHotelForRooms.name}!`,
        type: 'success'
      });
      const updatedHotelRes = await api.hotels.getById(selectedHotelForRooms.id);
      setSelectedHotelForRooms(updatedHotelRes.data);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      alert((language === 'vi' ? 'Lỗi thêm phòng: ' : 'Add room error: ') + err.message);
    }
  };

  const handleUpdateRoomUnits = async (room, newUnits) => {
    try {
      await api.admin.updateRoom(room.id, { totalUnits: parseInt(newUnits) });
      setActionMsg({
        text: language === 'vi'
          ? `Đã cập nhật số lượng phòng "${room.name}" thành ${newUnits} phòng!`
          : `Updated room "${room.name}" to ${newUnits} units!`,
        type: 'success'
      });
      const updatedHotelRes = await api.hotels.getById(selectedHotelForRooms.id);
      setSelectedHotelForRooms(updatedHotelRes.data);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      alert((language === 'vi' ? 'Lỗi cập nhật phòng: ' : 'Update room error: ') + err.message);
    }
  };

  const handleDeleteRoom = async (room) => {
    const confirmMsg = language === 'vi'
      ? `Bạn có chắc muốn xóa loại phòng "${room.name}"?`
      : `Are you sure you want to delete room "${room.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.admin.deleteRoom(room.id);
      setActionMsg({
        text: language === 'vi' ? `Đã xóa loại phòng "${room.name}"!` : `Deleted room "${room.name}"!`,
        type: 'success'
      });
      const updatedHotelRes = await api.hotels.getById(selectedHotelForRooms.id);
      setSelectedHotelForRooms(updatedHotelRes.data);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      alert((language === 'vi' ? 'Lỗi xóa phòng: ' : 'Delete room error: ') + err.message);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed':
        return language === 'vi' ? 'Đã xác nhận' : 'Confirmed';
      case 'completed':
        return language === 'vi' ? 'Hoàn thành' : 'Completed';
      case 'cancelled':
        return language === 'vi' ? 'Đã hủy' : 'Cancelled';
      default:
        return status;
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable>
      <Modal.Header closeButton className="border-bottom text-white" style={{ background: 'linear-gradient(135deg, var(--pka-navy-dark) 0%, var(--pka-navy) 100%)', borderBottom: '3px solid var(--pka-orange)' }}>
        <div className="d-flex align-items-center gap-3">
          <div className="p-2 rounded text-white" style={{ background: 'linear-gradient(135deg, var(--pka-orange) 0%, var(--pka-orange-hover) 100%)', boxShadow: '0 2px 8px var(--pka-orange-glow)' }}>
            <i className="bi bi-speedometer2 fs-4"></i>
          </div>
          <div>
            <Modal.Title className="fw-bold fs-4 mb-0 text-white">
              {language === 'vi' ? 'Trang Quản Trị Hệ Thống PhenikaaHotel' : 'PhenikaaHotel System Admin Panel'}
            </Modal.Title>
            <small className="text-white-50">
              {language === 'vi'
                ? 'Quản lý CSDL Khách sạn, Phòng, Tình trạng phòng trống và Toàn bộ đơn đặt phòng'
                : 'Manage hotels, room inventory, live availability, and guest reservations'}
            </small>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-4 bg-light">
        {actionMsg.text && (
          <Alert variant={actionMsg.type} dismissible onClose={() => setActionMsg({ text: '', type: 'success' })}>
            {actionMsg.text}
          </Alert>
        )}

        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="mb-4 bg-white p-2 rounded-3 border shadow-sm"
          fill
        >
          {/* TAB 1: THỐNG KÊ */}
          <Tab
            eventKey="stats"
            title={
              <span>
                <i className="bi bi-bar-chart-fill me-2 text-primary"></i>
                {language === 'vi' ? 'Tổng quan thống kê' : 'Overview & Stats'}
              </span>
            }
          >
            {loading && !stats ? (
              <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
            ) : stats && (
              <>
                <Row className="g-3 mb-4">
                  <Col md={3}>
                    <Card className="border-0 shadow-sm bg-primary text-white p-3 rounded-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-white-50 text-uppercase fw-bold">
                            {language === 'vi' ? 'Tổng doanh thu' : 'Total Revenue'}
                          </small>
                          <h4 className="fw-bold mt-1 mb-0">{formatPrice(stats.totalRevenueVND, currency)}</h4>
                        </div>
                        <i className="bi bi-cash-stack fs-1 text-white-50"></i>
                      </div>
                    </Card>
                  </Col>

                  <Col md={3}>
                    <Card className="border-0 shadow-sm bg-success text-white p-3 rounded-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-white-50 text-uppercase fw-bold">
                            {language === 'vi' ? 'Đơn hoạt động' : 'Active Bookings'}
                          </small>
                          <h4 className="fw-bold mt-1 mb-0">
                            {stats.activeBookings} {language === 'vi' ? 'đơn' : 'bookings'}
                          </h4>
                        </div>
                        <i className="bi bi-check2-circle fs-1 text-white-50"></i>
                      </div>
                    </Card>
                  </Col>

                  <Col md={3}>
                    <Card className="border-0 shadow-sm bg-info text-white p-3 rounded-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-white-50 text-uppercase fw-bold">
                            {language === 'vi' ? 'Số chỗ nghỉ' : 'Properties'}
                          </small>
                          <h4 className="fw-bold mt-1 mb-0">
                            {stats.totalHotels} {language === 'vi' ? 'khách sạn' : 'properties'}
                          </h4>
                        </div>
                        <i className="bi bi-building fs-1 text-white-50"></i>
                      </div>
                    </Card>
                  </Col>

                  <Col md={3}>
                    <Card className="border-0 shadow-sm bg-warning text-dark p-3 rounded-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-muted text-uppercase fw-bold">
                            {language === 'vi' ? 'Tổng kho phòng' : 'Total Inventory'}
                          </small>
                          <h4 className="fw-bold mt-1 mb-0">
                            {stats.totalRoomUnits} {language === 'vi' ? 'đơn vị' : 'units'}
                          </h4>
                        </div>
                        <i className="bi bi-door-open fs-1 text-black-50"></i>
                      </div>
                    </Card>
                  </Col>
                </Row>

                <div className="bg-white p-3 rounded-3 border shadow-sm">
                  <h6 className="fw-bold text-dark mb-3">
                    <i className="bi bi-clock-history text-primary me-2"></i>
                    {language === 'vi' ? 'Các đơn đặt phòng gần đây nhất' : 'Recent Reservations'}
                  </h6>
                  <div className="table-responsive">
                    <Table hover className="align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>{language === 'vi' ? 'Mã đơn' : 'Code'}</th>
                          <th>{language === 'vi' ? 'Khách hàng' : 'Customer'}</th>
                          <th>{language === 'vi' ? 'Khách sạn' : 'Property'}</th>
                          <th>{language === 'vi' ? 'Ngày lưu trú' : 'Stay Dates'}</th>
                          <th>{language === 'vi' ? 'Tổng tiền' : 'Total'}</th>
                          <th>{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((b) => (
                          <tr key={b.id}>
                            <td className="fw-bold text-primary font-monospace">{b.booking_code}</td>
                            <td>
                              <div className="fw-semibold">{b.guest_name}</div>
                              <small className="text-muted">{b.guest_phone}</small>
                            </td>
                            <td>{b.hotel_name}</td>
                            <td>
                              {b.check_in} → {b.check_out} ({b.nights} {language === 'vi' ? 'đêm' : 'nights'})
                            </td>
                            <td className="fw-bold">{formatPrice(b.total_price_vnd, currency)}</td>
                            <td>
                              <Badge bg={b.status === 'confirmed' ? 'success' : b.status === 'completed' ? 'primary' : 'danger'}>
                                {getStatusText(b.status)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </Tab>

          {/* TAB 2: QUẢN LÝ ĐƠN ĐẶT PHÒNG */}
          <Tab
            eventKey="bookings"
            title={
              <span>
                <i className="bi bi-journal-check me-2 text-success"></i>
                {language === 'vi' ? `Quản lý đơn đặt (${allBookings.length})` : `Reservations (${allBookings.length})`}
              </span>
            }
          >
            <div className="bg-white p-3 rounded-3 border shadow-sm mb-3">
              <Row className="g-2 align-items-center">
                <Col md={6}>
                  <Form onSubmit={(e) => { e.preventDefault(); loadData(); }}>
                    <Form.Control
                      type="text"
                      placeholder={language === 'vi' ? 'Tìm kiếm theo mã đơn, tên khách, số điện thoại, khách sạn...' : 'Search by code, guest name, phone, hotel...'}
                      value={bookingSearch}
                      onChange={(e) => setBookingSearch(e.target.value)}
                    />
                  </Form>
                </Col>
                <Col md={3}>
                  <Form.Select
                    value={bookingFilterStatus}
                    onChange={(e) => setBookingFilterStatus(e.target.value)}
                  >
                    <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>
                    <option value="confirmed">{language === 'vi' ? 'Đang xác nhận (Chờ nhận phòng)' : 'Confirmed (Awaiting check-in)'}</option>
                    <option value="completed">{language === 'vi' ? 'Đã hoàn thành' : 'Completed'}</option>
                    <option value="cancelled">{language === 'vi' ? 'Đã hủy' : 'Cancelled'}</option>
                  </Form.Select>
                </Col>
                <Col md={3} className="text-end">
                  <Button variant="outline-primary" onClick={loadData}>
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    {language === 'vi' ? 'Làm mới danh sách' : 'Refresh'}
                  </Button>
                </Col>
              </Row>
            </div>

            <div className="table-responsive bg-white rounded-3 border shadow-sm">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>{language === 'vi' ? 'Mã đơn' : 'Code'}</th>
                    <th>{language === 'vi' ? 'Khách hàng & SĐT' : 'Customer & Phone'}</th>
                    <th>{language === 'vi' ? 'Khách sạn & Phòng' : 'Property & Room'}</th>
                    <th>{language === 'vi' ? 'Thời gian lưu trú' : 'Stay Dates'}</th>
                    <th>{language === 'vi' ? 'Doanh thu' : 'Revenue'}</th>
                    <th>{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                    <th className="text-center">{language === 'vi' ? 'Hành động' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {allBookings.map((b) => (
                    <tr key={b.id}>
                      <td className="fw-bold text-primary font-monospace">{b.booking_code}</td>
                      <td>
                        <div className="fw-semibold">{b.guest_name}</div>
                        <small className="text-muted">{b.guest_email} · {b.guest_phone}</small>
                      </td>
                      <td>
                        <div className="fw-bold">{b.hotel_name}</div>
                        <small className="text-muted">{b.room_name}</small>
                      </td>
                      <td>
                        <div>{b.check_in} → {b.check_out}</div>
                        <small className="text-muted">
                          {b.nights} {language === 'vi' ? 'đêm' : 'nights'} ({b.rooms_count} {language === 'vi' ? 'phòng' : 'rooms'})
                        </small>
                      </td>
                      <td className="fw-bold text-dark">{formatPrice(b.total_price_vnd, currency)}</td>
                      <td>
                        <Badge bg={b.status === 'confirmed' ? 'success' : b.status === 'completed' ? 'primary' : 'danger'}>
                          {getStatusText(b.status)}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <div className="d-flex gap-1 justify-content-center">
                          {b.status !== 'completed' && b.status !== 'cancelled' && (
                            <Button
                              variant="outline-success"
                              size="sm"
                              title={language === 'vi' ? 'Xác nhận khách đã nhận phòng / Hoàn tất' : 'Confirm completed'}
                              onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                            >
                              <i className="bi bi-check-lg"></i>
                            </Button>
                          )}
                          {b.status !== 'cancelled' && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              title={language === 'vi' ? 'Hủy đơn đặt phòng này (hoàn trả phòng trống)' : 'Cancel booking'}
                              onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                            >
                              <i className="bi bi-x-lg"></i>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Tab>

          {/* TAB 3: QUẢN LÝ KHÁCH SẠN VÀ PHÒNG */}
          <Tab
            eventKey="hotels"
            title={
              <span>
                <i className="bi bi-building-gear me-2 text-warning"></i>
                {language === 'vi' ? `Quản lý khách sạn & Phòng (${hotels.length})` : `Hotels & Rooms (${hotels.length})`}
              </span>
            }
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0">
                {language === 'vi' ? 'Danh sách các cơ sở lưu trú trong CSDL' : 'Properties in Database'}
              </h6>
              <Button variant="primary" onClick={() => setShowAddHotelModal(true)}>
                <i className="bi bi-plus-circle me-1"></i>
                {language === 'vi' ? 'Thêm khách sạn mới' : 'Add New Hotel'}
              </Button>
            </div>

            <div className="table-responsive bg-white rounded-3 border shadow-sm">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>{language === 'vi' ? 'Tên khách sạn' : 'Property Name'}</th>
                    <th>{language === 'vi' ? 'Thành phố' : 'City'}</th>
                    <th>{language === 'vi' ? 'Số sao & Điểm' : 'Rating & Score'}</th>
                    <th>{language === 'vi' ? 'Giá cơ bản' : 'Base Price'}</th>
                    <th>{language === 'vi' ? 'Số loại phòng' : 'Room Types'}</th>
                    <th className="text-center">{language === 'vi' ? 'Quản lý' : 'Manage'}</th>
                  </tr>
                </thead>
                <tbody>
                  {hotels.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <div className="fw-bold text-dark">{h.name}</div>
                        <small className="text-muted">{h.address}</small>
                      </td>
                      <td>
                        <Badge bg="light" text="dark" className="border">{h.city}</Badge>
                      </td>
                      <td>
                        <div className="text-warning">
                          {[...Array(h.starRating || 4)].map((_, i) => (
                            <i key={i} className="bi bi-star-fill me-0.5" style={{ fontSize: '11px' }}></i>
                          ))}
                        </div>
                        <small className="text-muted">{h.reviewScore}</small>
                      </td>
                      <td className="fw-bold text-primary">{formatPrice(h.priceVND, currency)}</td>
                      <td>
                        <span className="badge bg-secondary-subtle text-dark border">
                          {h.rooms?.length || 0} {language === 'vi' ? 'loại phòng' : 'room types'}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="d-flex gap-1 justify-content-center">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => setSelectedHotelForRooms(h)}
                          >
                            <i className="bi bi-door-open me-1"></i>
                            {language === 'vi' ? 'Chi tiết phòng' : 'Rooms'}
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteHotel(h)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Tab>
        </Tabs>

        {/* Modal quản lý chi tiết phòng của khách sạn */}
        {selectedHotelForRooms && (
          <Modal show={true} onHide={() => setSelectedHotelForRooms(null)} size="lg" centered>
            <Modal.Header closeButton>
              <Modal.Title className="fw-bold fs-5">
                {language === 'vi' ? 'Quản lý kho phòng: ' : 'Manage Room Inventory: '}
                {selectedHotelForRooms.name}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-3 bg-light">
              <h6 className="fw-bold text-dark mb-2">
                {language === 'vi' ? 'Danh sách loại phòng hiện có' : 'Existing Room Types'}
              </h6>
              <div className="table-responsive bg-white rounded border mb-4">
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>{language === 'vi' ? 'Loại phòng' : 'Room Type'}</th>
                      <th>{language === 'vi' ? 'Giá/đêm' : 'Price/night'}</th>
                      <th>{language === 'vi' ? 'Sức chứa' : 'Capacity'}</th>
                      <th>{language === 'vi' ? 'Số phòng trong kho' : 'Total Units'}</th>
                      <th>{language === 'vi' ? 'Thao tác' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedHotelForRooms.rooms?.map((rm) => (
                      <tr key={rm.id}>
                        <td className="fw-bold">{rm.name}</td>
                        <td>{formatPrice(rm.priceVND || rm.price_vnd, currency)}</td>
                        <td>{rm.capacity}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="form-control form-control-sm"
                              style={{ width: '80px' }}
                              defaultValue={rm.totalUnits || rm.total_units || 5}
                              onBlur={(e) => handleUpdateRoomUnits(rm, e.target.value)}
                            />
                            <small className="text-muted">{language === 'vi' ? 'phòng' : 'units'}</small>
                          </div>
                        </td>
                        <td>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteRoom(rm)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Form thêm phòng mới */}
              <div className="p-3 bg-white rounded border">
                <h6 className="fw-bold text-dark mb-3">
                  <i className="bi bi-plus-circle text-primary me-2"></i>
                  {language === 'vi' ? 'Thêm loại phòng mới' : 'Add New Room Type'}
                </h6>
                <Form onSubmit={handleAddRoomToHotel}>
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">{language === 'vi' ? 'Tên loại phòng *' : 'Room Type Name *'}</Form.Label>
                        <Form.Control
                          type="text"
                          required
                          value={newRoomForm.name}
                          onChange={(e) => setNewRoomForm({ ...newRoomForm, name: e.target.value })}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">{language === 'vi' ? 'Giá mỗi đêm (VND) *' : 'Price/night (VND) *'}</Form.Label>
                        <Form.Control
                          type="number"
                          required
                          value={newRoomForm.priceVND}
                          onChange={(e) => setNewRoomForm({ ...newRoomForm, priceVND: parseInt(e.target.value) })}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">{language === 'vi' ? 'Số phòng có sẵn *' : 'Total Units *'}</Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          required
                          value={newRoomForm.totalUnits}
                          onChange={(e) => setNewRoomForm({ ...newRoomForm, totalUnits: parseInt(e.target.value) })}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={12} className="text-end mt-3">
                      <Button variant="success" type="submit" size="sm" className="fw-semibold">
                        {language === 'vi' ? 'Lưu loại phòng mới' : 'Save Room Type'}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </div>
            </Modal.Body>
          </Modal>
        )}

        {/* Modal Thêm Khách Sạn Mới */}
        <Modal show={showAddHotelModal} onHide={() => setShowAddHotelModal(false)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title className="fw-bold fs-5">
              {language === 'vi' ? 'Thêm khách sạn mới vào cơ sở dữ liệu' : 'Add New Hotel to Database'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <Form onSubmit={handleCreateHotel}>
              <Row className="g-3">
                <Col md={8}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">{language === 'vi' ? 'Tên khách sạn *' : 'Hotel Name *'}</Form.Label>
                    <Form.Control
                      type="text"
                      required
                      placeholder="VD: Vinpearl Luxury Nha Trang"
                      value={newHotelForm.name}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, name: e.target.value })}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">{language === 'vi' ? 'Thành phố *' : 'City *'}</Form.Label>
                    <Form.Select
                      value={newHotelForm.city}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, city: e.target.value })}
                    >
                      <option value="Hà Nội">Hà Nội</option>
                      <option value="Đà Nẵng">Đà Nẵng</option>
                      <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                      <option value="Nha Trang">Nha Trang</option>
                      <option value="Phú Quốc">Phú Quốc</option>
                      <option value="Đà Lạt">Đà Lạt</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={8}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">{language === 'vi' ? 'Địa chỉ chi tiết' : 'Address'}</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder={language === 'vi' ? 'Số nhà, tên đường, quận/huyện...' : 'Street, district, city...'}
                      value={newHotelForm.address}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, address: e.target.value })}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">{language === 'vi' ? 'Hạng sao' : 'Star Rating'}</Form.Label>
                    <Form.Select
                      value={newHotelForm.starRating}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, starRating: parseInt(e.target.value) })}
                    >
                      <option value="3">3 {language === 'vi' ? 'sao' : 'stars'}</option>
                      <option value="4">4 {language === 'vi' ? 'sao' : 'stars'}</option>
                      <option value="5">5 {language === 'vi' ? 'sao' : 'stars'}</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">{language === 'vi' ? 'Giá niêm yết thấp nhất (VND) *' : 'Lowest Base Price (VND) *'}</Form.Label>
                    <Form.Control
                      type="number"
                      required
                      value={newHotelForm.priceVND}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, priceVND: parseInt(e.target.value) })}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">{language === 'vi' ? 'Loại hình' : 'Property Type'}</Form.Label>
                    <Form.Select
                      value={newHotelForm.type}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, type: e.target.value })}
                    >
                      <option value="hotel">{language === 'vi' ? 'Khách sạn (Hotel)' : 'Hotel'}</option>
                      <option value="resort">{language === 'vi' ? 'Khu nghỉ dưỡng (Resort)' : 'Resort'}</option>
                      <option value="apartment">{language === 'vi' ? 'Căn hộ (Apartment)' : 'Apartment'}</option>
                      <option value="villa">{language === 'vi' ? 'Biệt thự (Villa)' : 'Villa'}</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">{language === 'vi' ? 'Mô tả giới thiệu' : 'Description'}</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      placeholder={language === 'vi' ? 'Mô tả phong cách, tiện ích nổi bật...' : 'Describe property style, key amenities...'}
                      value={newHotelForm.description}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, description: e.target.value })}
                    />
                  </Form.Group>
                </Col>

                <Col md={12} className="text-end mt-4">
                  <Button variant="secondary" className="me-2" onClick={() => setShowAddHotelModal(false)}>
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </Button>
                  <Button variant="primary" type="submit" className="fw-bold">
                    {language === 'vi' ? 'Tạo khách sạn' : 'Create Hotel'}
                  </Button>
                </Col>
              </Row>
            </Form>
          </Modal.Body>
        </Modal>
      </Modal.Body>

      <Modal.Footer className="border-top">
        <Button variant="secondary" onClick={onHide}>
          {language === 'vi' ? 'Đóng' : 'Close'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
