import React, { useState } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import { api } from '../services/api';

export default function AuthModal({ show, onHide, mode, setMode, onLoginSuccess, language }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError(language === 'vi' ? 'Vui lòng nhập đầy đủ email và mật khẩu' : 'Please provide email and password');
      return;
    }
    setError('');
    setLoading(true);

    try {
      let res;
      if (mode === 'register') {
        res = await api.auth.register(name, email, password, phone);
      } else {
        res = await api.auth.login(email, password);
      }

      if (res && res.user) {
        onLoginSuccess(res.user);
        onHide();
      }
    } catch (err) {
      setError(err.message || (language === 'vi' ? 'Đăng nhập không thành công' : 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (presetEmail, presetPassword) => {
    setEmail(presetEmail);
    setPassword(presetPassword);
    setError('');
    setLoading(true);

    try {
      const res = await api.auth.login(presetEmail, presetPassword);
      if (res && res.user) {
        onLoginSuccess(res.user);
        onHide();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fw-bold fs-5">
          {mode === 'login'
            ? (language === 'vi' ? 'Đăng nhập tài khoản' : 'Sign in to your account')
            : (language === 'vi' ? 'Đăng ký tài khoản HotelBooking' : 'Register for HotelBooking')}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-4">
        <p className="text-muted small mb-3">
          {language === 'vi'
            ? 'Xác thực bảo mật qua REST API & lưu trữ trực tiếp trong CSDL (SQLite/MySQL).'
            : 'Authenticated via REST API & persistently stored in the database.'}
        </p>

        {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">
                  {language === 'vi' ? 'Họ và tên của bạn' : 'Your full name'}
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder={language === 'vi' ? 'Nguyễn Văn A' : 'John Doe'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">
                  {language === 'vi' ? 'Số điện thoại' : 'Phone number'}
                </Form.Label>
                <Form.Control
                  type="tel"
                  placeholder="0912 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Form.Group>
            </>
          )}

          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">
              {language === 'vi' ? 'Địa chỉ email' : 'Email address'}
            </Form.Label>
            <Form.Control
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="small fw-semibold">
              {language === 'vi' ? 'Mật khẩu' : 'Password'}
            </Form.Label>
            <Form.Control
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Form.Group>

          <Button variant="primary" type="submit" className="w-100 py-2 fw-bold mb-3" disabled={loading}>
            {loading ? (
              <Spinner size="sm" animation="border" />
            ) : mode === 'login' ? (
              language === 'vi' ? 'Đăng nhập ngay' : 'Sign in'
            ) : (
              language === 'vi' ? 'Tạo tài khoản' : 'Create account'
            )}
          </Button>

          {/* Preset Quick Login Buttons */}
          <div className="border-top pt-3 mb-3">
            <div className="small fw-bold text-muted mb-2 text-uppercase" style={{ fontSize: '11px' }}>
              {language === 'vi' ? 'Đăng nhập nhanh (Tài khoản CSDL):' : 'Quick demo accounts:'}
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="outline-primary"
                type="button"
                size="sm"
                className="w-50 py-1.5 fw-semibold d-flex align-items-center justify-content-center gap-1"
                disabled={loading}
                onClick={() => handleQuickLogin('khachhang@booking.com', 'user123')}
              >
                <i className="bi bi-person-fill"></i>
                Khách hàng
              </Button>
              <Button
                variant="outline-dark"
                type="button"
                size="sm"
                className="w-50 py-1.5 fw-semibold d-flex align-items-center justify-content-center gap-1"
                disabled={loading}
                onClick={() => handleQuickLogin('admin@booking.com', 'admin123')}
              >
                <i className="bi bi-shield-lock-fill text-warning"></i>
                Quản trị viên
              </Button>
            </div>
          </div>

          <div className="text-center small text-muted">
            {mode === 'login' ? (
              <>
                {language === 'vi' ? 'Chưa có tài khoản? ' : "Don't have an account? "}
                <button
                  type="button"
                  className="btn btn-link p-0 fw-semibold text-primary"
                  onClick={() => { setMode('register'); setError(''); }}
                >
                  {language === 'vi' ? 'Đăng ký ngay' : 'Register now'}
                </button>
              </>
            ) : (
              <>
                {language === 'vi' ? 'Đã có tài khoản? ' : 'Already have an account? '}
                <button
                  type="button"
                  className="btn btn-link p-0 fw-semibold text-primary"
                  onClick={() => { setMode('login'); setError(''); }}
                >
                  {language === 'vi' ? 'Đăng nhập' : 'Sign in'}
                </button>
              </>
            )}
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
