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

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="border-0 pb-0">
        <Modal.Title className="fw-bold fs-5">
          {mode === 'login'
            ? (language === 'vi' ? 'Đăng nhập tài khoản PhenikaaHotel' : 'Sign in to PhenikaaHotel')
            : (language === 'vi' ? 'Đăng ký tài khoản PhenikaaHotel' : 'Register for PhenikaaHotel')}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-4">
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
