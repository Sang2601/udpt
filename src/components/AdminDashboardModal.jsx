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
      setActionMsg({ text: 'Lỗi tải dữ liệu quản trị: ' + err.message, type: 'danger' });
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
      setActionMsg({ text: `Đã cập nhật trạng thái đơn #${bookingId} thành công!`, type: 'success' });
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      setActionMsg({ text: err.message, type: 'danger' });
    }
  };

  const handleCreateHotel = async (e) => {
    e.preventDefault();
    if (!newHotelForm.name || !newHotelForm.city || !newHotelForm.priceVND) {
      alert('Vui lòng điền các trường bắt buộc');
      return;
    }

    try {
      await api.admin.createHotel(newHotelForm);
      setActionMsg({ text: 'Đã thêm khách sạn mới vào cơ sở dữ liệu!', type: 'success' });
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
      alert('Lỗi tạo khách sạn: ' + err.message);
    }
  };

  const handleDeleteHotel = async (hotel) => {
    if (!window.confirm(`Bạn có chắc muốn xóa khách sạn "${hotel.name}" khỏi hệ thống?`)) return;
    try {
      await api.admin.deleteHotel(hotel.id);
      setActionMsg({ text: `Đã xóa khách sạn ${hotel.name}!`, type: 'success' });
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
      setActionMsg({ text: `Đã thêm loại phòng mới cho ${selectedHotelForRooms.name}!`, type: 'success' });
      const updatedHotelRes = await api.hotels.getById(selectedHotelForRooms.id);
      setSelectedHotelForRooms(updatedHotelRes.data);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      alert('Lỗi thêm phòng: ' + err.message);
    }
  };

  const handleUpdateRoomUnits = async (room, newUnits) => {
    try {
      await api.admin.updateRoom(room.id, { totalUnits: parseInt(newUnits) });
      setActionMsg({ text: `Đã cập nhật số lượng phòng "${room.name}" thành ${newUnits} phòng!`, type: 'success' });
      const updatedHotelRes = await api.hotels.getById(selectedHotelForRooms.id);
      setSelectedHotelForRooms(updatedHotelRes.data);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      alert('Lỗi cập nhật phòng: ' + err.message);
    }
  };

  const handleDeleteRoom = async (room) => {
    if (!window.confirm(`Bạn có chắc muốn xóa loại phòng "${room.name}"?`)) return;
    try {
      await api.admin.deleteRoom(room.id);
      setActionMsg({ text: `Đã xóa loại phòng "${room.name}"!`, type: 'success' });
      const updatedHotelRes = await api.hotels.getById(selectedHotelForRooms.id);
      setSelectedHotelForRooms(updatedHotelRes.data);
      loadData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      alert('Lỗi xóa phòng: ' + err.message);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable>
      <Modal.Header closeButton className="border-bottom bg-dark text-white">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-primary p-2 rounded text-white">
            <i className="bi bi-speedometer2 fs-4"></i>
          </div>
          <div>
            <Modal.Title className="fw-bold fs-4 mb-0 text-white">
              Trang Quản Trị Hệ Thống (Admin Control Panel)
            </Modal.Title>
            <small className="text-white-50">
              Quản lý CSDL Khách sạn, Phòng, Tình trạng phòng trống và Toàn bộ đơn đặt phòng
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
          <Tab eventKey="stats" title={<span><i className="bi bi-bar-chart-fill me-2 text-primary"></i>Tổng quan thống kê</span>}>
            {loading && !stats ? (
              <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
            ) : stats && (
              <>
                <Row className="g-3 mb-4">
                  <Col md={3}>
                    <Card className="border-0 shadow-sm bg-primary text-white p-3 rounded-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-white-50 text-uppercase fw-bold">Tổng doanh thu</small>
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
                          <small className="text-white-50 text-uppercase fw-bold">Đơn hoạt động</small>
                          <h4 className="fw-bold mt-1 mb-0">{stats.activeBookings} đơn</h4>
                        </div>
                        <i className="bi bi-check2-circle fs-1 text-white-50"></i>
                      </div>
                    </Card>
                  </Col>

                  <Col md={3}>
                    <Card className="border-0 shadow-sm bg-info text-white p-3 rounded-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-white-50 text-uppercase fw-bold">Số chỗ nghỉ</small>
                          <h4 className="fw-bold mt-1 mb-0">{stats.totalHotels} khách sạn</h4>
                        </div>
                        <i className="bi bi-building fs-1 text-white-50"></i>
                      </div>
                    </Card>
                  </Col>

                  <Col md={3}>
                    <Card className="border-0 shadow-sm bg-warning text-dark p-3 rounded-3">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-muted text-uppercase fw-bold">Tổng kho phòng</small>
                          <h4 className="fw-bold mt-1 mb-0">{stats.totalRoomUnits} đơn vị</h4>
                        </div>
                        <i className="bi bi-door-open fs-1 text-black-50"></i>
                      </div>
                    </Card>
                  </Col>
                </Row>

                <div className="bg-white p-3 rounded-3 border shadow-sm">
                  <h6 className="fw-bold text-dark mb-3">
                    <i className="bi bi-clock-history text-primary me-2"></i>Các đơn đặt phòng gần đây nhất
                  </h6>
                  <div className="table-responsive">
                    <Table hover className="align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Mã đơn</th>
                          <th>Khách hàng</th>
                          <th>Khách sạn</th>
                          <th>Ngày lưu trú</th>
                          <th>Tổng tiền</th>
                          <th>Trạng thái</th>
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
                            <td>{b.check_in} → {b.check_out} ({b.nights} đêm)</td>
                            <td className="fw-bold">{formatPrice(b.total_price_vnd, currency)}</td>
                            <td>
                              <Badge bg={b.status === 'confirmed' ? 'success' : b.status === 'completed' ? 'primary' : 'danger'}>
                                {b.status === 'confirmed' ? 'Đã xác nhận' : b.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
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
          <Tab eventKey="bookings" title={<span><i className="bi bi-journal-check me-2 text-success"></i>Quản lý đơn đặt ({allBookings.length})</span>}>
            <div className="bg-white p-3 rounded-3 border shadow-sm mb-3">
              <Row className="g-2 align-items-center">
                <Col md={6}>
                  <Form onSubmit={(e) => { e.preventDefault(); loadData(); }}>
                    <Form.Control
                      type="text"
                      placeholder="Tìm kiếm theo mã đơn, tên khách, số điện thoại, khách sạn..."
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
                    <option value="all">Tất cả trạng thái</option>
                    <option value="confirmed">Đang xác nhận (Chờ nhận phòng)</option>
                    <option value="completed">Đã hoàn thành</option>
                    <option value="cancelled">Đã hủy</option>
                  </Form.Select>
                </Col>
                <Col md={3} className="text-end">
                  <Button variant="outline-primary" onClick={loadData}>
                    <i className="bi bi-arrow-clockwise me-1"></i>Làm mới danh sách
                  </Button>
                </Col>
              </Row>
            </div>

            <div className="table-responsive bg-white rounded-3 border shadow-sm">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng & SĐT</th>
                    <th>Khách sạn & Phòng</th>
                    <th>Thời gian lưu trú</th>
                    <th>Doanh thu</th>
                    <th>Trạng thái</th>
                    <th className="text-center">Hành động</th>
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
                        <small className="text-muted">{b.nights} đêm ({b.rooms_count} phòng)</small>
                      </td>
                      <td className="fw-bold text-dark">{formatPrice(b.total_price_vnd, currency)}</td>
                      <td>
                        <Badge bg={b.status === 'confirmed' ? 'success' : b.status === 'completed' ? 'primary' : 'danger'}>
                          {b.status === 'confirmed' ? 'Đã xác nhận' : b.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <div className="d-flex gap-1 justify-content-center">
                          {b.status !== 'completed' && b.status !== 'cancelled' && (
                            <Button
                              variant="outline-success"
                              size="sm"
                              title="Xác nhận khách đã nhận phòng / Hoàn tất"
                              onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                            >
                              <i className="bi bi-check-lg"></i>
                            </Button>
                          )}
                          {b.status !== 'cancelled' && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              title="Hủy đơn đặt phòng này (hoàn trả phòng trống)"
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
          <Tab eventKey="hotels" title={<span><i className="bi bi-building-gear me-2 text-warning"></i>Quản lý khách sạn & Phòng ({hotels.length})</span>}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0">Danh sách các cơ sở lưu trú trong CSDL</h6>
              <Button variant="primary" onClick={() => setShowAddHotelModal(true)}>
                <i className="bi bi-plus-circle me-1"></i>Thêm khách sạn mới
              </Button>
            </div>

            <div className="table-responsive bg-white rounded-3 border shadow-sm">
              <Table hover className="align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Tên khách sạn</th>
                    <th>Thành phố</th>
                    <th>Số sao & Điểm</th>
                    <th>Giá cơ bản</th>
                    <th>Số loại phòng</th>
                    <th className="text-center">Quản lý</th>
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
                        <small className="text-muted">{h.reviewScore} ({h.reviewScoreWord})</small>
                      </td>
                      <td className="fw-bold text-primary">{formatPrice(h.priceVND, currency)}</td>
                      <td>
                        <span className="badge bg-secondary-subtle text-dark border">
                          {h.rooms?.length || 0} loại phòng
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="d-flex gap-1 justify-content-center">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => setSelectedHotelForRooms(h)}
                          >
                            <i className="bi bi-door-open me-1"></i>Chi tiết phòng
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
                Quản lý kho phòng: {selectedHotelForRooms.name}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-3 bg-light">
              <h6 className="fw-bold text-dark mb-2">Danh sách loại phòng hiện có</h6>
              <div className="table-responsive bg-white rounded border mb-4">
                <Table hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Loại phòng</th>
                      <th>Giá/đêm</th>
                      <th>Sức chứa</th>
                      <th>Số phòng trong kho (totalUnits)</th>
                      <th>Thao tác</th>
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
                            <small className="text-muted">phòng</small>
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
                  <i className="bi bi-plus-circle text-primary me-2"></i>Thêm loại phòng mới
                </h6>
                <Form onSubmit={handleAddRoomToHotel}>
                  <Row className="g-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Tên loại phòng *</Form.Label>
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
                        <Form.Label className="small fw-semibold">Giá mỗi đêm (VND) *</Form.Label>
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
                        <Form.Label className="small fw-semibold">Số phòng có sẵn *</Form.Label>
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
                        Lưu loại phòng mới
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
            <Modal.Title className="fw-bold fs-5">Thêm khách sạn mới vào cơ sở dữ liệu</Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-4">
            <Form onSubmit={handleCreateHotel}>
              <Row className="g-3">
                <Col md={8}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">Tên khách sạn *</Form.Label>
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
                    <Form.Label className="small fw-semibold">Thành phố *</Form.Label>
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
                    <Form.Label className="small fw-semibold">Địa chỉ chi tiết</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Số nhà, tên đường, quận/huyện..."
                      value={newHotelForm.address}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, address: e.target.value })}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">Hạng sao</Form.Label>
                    <Form.Select
                      value={newHotelForm.starRating}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, starRating: parseInt(e.target.value) })}
                    >
                      <option value="3">3 sao</option>
                      <option value="4">4 sao</option>
                      <option value="5">5 sao</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">Giá niêm yết thấp nhất (VND) *</Form.Label>
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
                    <Form.Label className="small fw-semibold">Loại hình</Form.Label>
                    <Form.Select
                      value={newHotelForm.type}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, type: e.target.value })}
                    >
                      <option value="hotel">Khách sạn (Hotel)</option>
                      <option value="resort">Khu nghỉ dưỡng (Resort)</option>
                      <option value="apartment">Căn hộ (Apartment)</option>
                      <option value="villa">Biệt thự (Villa)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label className="small fw-semibold">Mô tả giới thiệu</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      placeholder="Mô tả phong cách, tiện ích nổi bật..."
                      value={newHotelForm.description}
                      onChange={(e) => setNewHotelForm({ ...newHotelForm, description: e.target.value })}
                    />
                  </Form.Group>
                </Col>

                <Col md={12} className="text-end mt-4">
                  <Button variant="secondary" className="me-2" onClick={() => setShowAddHotelModal(false)}>
                    Hủy
                  </Button>
                  <Button variant="primary" type="submit" className="fw-bold">
                    Tạo khách sạn
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
