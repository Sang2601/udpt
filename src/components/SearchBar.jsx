import React, { useState, useRef, useEffect } from 'react';
import { Container, Form, Button } from 'react-bootstrap';
import { popularSearchSuggestions } from '../data/destinationsData';

export default function SearchBar({
  destination,
  setDestination,
  checkInDate,
  setCheckInDate,
  checkOutDate,
  setCheckOutDate,
  guests,
  setGuests,
  isWorkTravel,
  setIsWorkTravel,
  onSearch,
  language
}) {
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);

  const destRef = useRef(null);
  const dateRef = useRef(null);
  const guestRef = useRef(null);

  // Close popups on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (destRef.current && !destRef.current.contains(event.target)) {
        setShowDestDropdown(false);
      }
      if (dateRef.current && !dateRef.current.contains(event.target)) {
        setShowDateDropdown(false);
      }
      if (guestRef.current && !guestRef.current.contains(event.target)) {
        setShowGuestDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (city) => {
    setDestination(city);
    setShowDestDropdown(false);
  };

  const handleGuestChange = (field, delta) => {
    setGuests(prev => {
      const newVal = prev[field] + delta;
      if (field === 'adults' && newVal < 1) return prev;
      if (field === 'children' && newVal < 0) return prev;
      if (field === 'rooms' && newVal < 1) return prev;
      return { ...prev, [field]: newVal };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowDestDropdown(false);
    setShowDateDropdown(false);
    setShowGuestDropdown(false);
    onSearch();
  };

  return (
    <div className="search-container">
      <Container>
        <form onSubmit={handleSubmit}>
          <div className="search-bar-frame">
            <div className="search-bar-inner">
              {/* Segment 1: Destination */}
              <div className="search-bar-segment" ref={destRef}>
                <i className="bi bi-buildings"></i>
                <div className="w-100 position-relative">
                  <input
                    type="text"
                    className="search-input-field"
                    placeholder={language === 'vi' ? 'Bạn muốn đến đâu?' : 'Where are you going?'}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    onFocus={() => setShowDestDropdown(true)}
                  />
                  {destination && (
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-muted position-absolute end-0 top-50 translate-middle-y p-0 border-0"
                      onClick={() => setDestination('')}
                    >
                      <i className="bi bi-x-circle-fill"></i>
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showDestDropdown && (
                  <div className="search-dropdown-menu">
                    <div className="text-uppercase fw-bold text-muted mb-2" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                      {language === 'vi' ? 'Điểm đến phổ biến gần đây' : 'Popular destinations nearby'}
                    </div>
                    {popularSearchSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        onClick={() => handleSelectSuggestion(item.name)}
                      >
                        <div className="suggestion-icon">
                          <i className={`bi ${item.icon}`}></i>
                        </div>
                        <div>
                          <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                            {item.name}
                          </div>
                          <div className="text-muted" style={{ fontSize: '12px' }}>
                            {item.desc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Segment 2: Dates */}
              <div
                className="search-bar-segment"
                ref={dateRef}
                onClick={() => setShowDateDropdown(!showDateDropdown)}
              >
                <i className="bi bi-calendar3"></i>
                <div className="search-text-display">
                  <span className="search-text-main">
                    {checkInDate} — {checkOutDate}
                  </span>
                  <span className="search-text-sub">
                    {language === 'vi' ? '2 đêm' : '2 nights'}
                  </span>
                </div>

                {/* Dates Selector Dropdown */}
                {showDateDropdown && (
                  <div
                    className="search-dropdown-menu"
                    style={{ width: '300px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="fw-bold mb-2" style={{ fontSize: '14px' }}>
                      {language === 'vi' ? 'Chọn ngày nhận và trả phòng' : 'Select check-in & check-out'}
                    </div>
                    <Form.Group className="mb-2">
                      <Form.Label className="small text-muted">{language === 'vi' ? 'Ngày nhận phòng' : 'Check-in'}</Form.Label>
                      <Form.Control
                        type="date"
                        size="sm"
                        value={checkInDate}
                        onChange={(e) => {
                          if (e.target.value) setCheckInDate(e.target.value);
                        }}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label className="small text-muted">{language === 'vi' ? 'Ngày trả phòng' : 'Check-out'}</Form.Label>
                      <Form.Control
                        type="date"
                        size="sm"
                        value={checkOutDate}
                        onChange={(e) => {
                          if (e.target.value) setCheckOutDate(e.target.value);
                        }}
                      />
                    </Form.Group>
                    <div className="d-flex justify-content-between">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          const in2 = new Date(today);
                          in2.setDate(today.getDate() + 2);
                          const in4 = new Date(today);
                          in4.setDate(today.getDate() + 4);
                          setCheckInDate(in2.toISOString().split('T')[0]);
                          setCheckOutDate(in4.toISOString().split('T')[0]);
                          setShowDateDropdown(false);
                        }}
                      >
                        {language === 'vi' ? 'Cuối tuần này' : 'This weekend'}
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowDateDropdown(false)}
                      >
                        {language === 'vi' ? 'Áp dụng' : 'Apply'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Segment 3: Guests & Rooms */}
              <div
                className="search-bar-segment"
                ref={guestRef}
                onClick={() => setShowGuestDropdown(!showGuestDropdown)}
              >
                <i className="bi bi-person"></i>
                <div className="search-text-display">
                  <span className="search-text-main">
                    {language === 'vi'
                      ? `${guests.adults} người lớn · ${guests.children} trẻ em · ${guests.rooms} phòng`
                      : `${guests.adults} adults · ${guests.children} children · ${guests.rooms} room`}
                  </span>
                  <span className="search-text-sub">
                    {language === 'vi' ? 'Tùy chỉnh số lượng' : 'Customize occupancy'}
                  </span>
                </div>

                {/* Guest dropdown popup */}
                {showGuestDropdown && (
                  <div
                    className="search-dropdown-menu"
                    style={{ width: '320px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Adults */}
                    <div className="counter-row">
                      <div>
                        <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                          {language === 'vi' ? 'Người lớn' : 'Adults'}
                        </div>
                        <div className="text-muted" style={{ fontSize: '12px' }}>
                          {language === 'vi' ? 'Từ 18 tuổi trở lên' : 'Ages 18 or above'}
                        </div>
                      </div>
                      <div className="counter-btns">
                        <button
                          type="button"
                          className="btn-counter"
                          disabled={guests.adults <= 1}
                          onClick={() => handleGuestChange('adults', -1)}
                        >
                          -
                        </button>
                        <span className="fw-bold" style={{ minWidth: '20px', textAlign: 'center' }}>
                          {guests.adults}
                        </span>
                        <button
                          type="button"
                          className="btn-counter"
                          onClick={() => handleGuestChange('adults', 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Children */}
                    <div className="counter-row">
                      <div>
                        <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                          {language === 'vi' ? 'Trẻ em' : 'Children'}
                        </div>
                        <div className="text-muted" style={{ fontSize: '12px' }}>
                          {language === 'vi' ? 'Độ tuổi từ 0 - 17' : 'Ages 0 to 17'}
                        </div>
                      </div>
                      <div className="counter-btns">
                        <button
                          type="button"
                          className="btn-counter"
                          disabled={guests.children <= 0}
                          onClick={() => handleGuestChange('children', -1)}
                        >
                          -
                        </button>
                        <span className="fw-bold" style={{ minWidth: '20px', textAlign: 'center' }}>
                          {guests.children}
                        </span>
                        <button
                          type="button"
                          className="btn-counter"
                          onClick={() => handleGuestChange('children', 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Rooms */}
                    <div className="counter-row">
                      <div>
                        <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                          {language === 'vi' ? 'Phòng' : 'Rooms'}
                        </div>
                        <div className="text-muted" style={{ fontSize: '12px' }}>
                          {language === 'vi' ? 'Số lượng phòng' : 'Number of rooms'}
                        </div>
                      </div>
                      <div className="counter-btns">
                        <button
                          type="button"
                          className="btn-counter"
                          disabled={guests.rooms <= 1}
                          onClick={() => handleGuestChange('rooms', -1)}
                        >
                          -
                        </button>
                        <span className="fw-bold" style={{ minWidth: '20px', textAlign: 'center' }}>
                          {guests.rooms}
                        </span>
                        <button
                          type="button"
                          className="btn-counter"
                          onClick={() => handleGuestChange('rooms', 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="primary"
                        className="w-100 py-1"
                        size="sm"
                        onClick={() => setShowGuestDropdown(false)}
                      >
                        {language === 'vi' ? 'Xong' : 'Done'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Segment 4: Search Button */}
              <div className="search-bar-segment action-segment">
                <button type="submit" className="btn-search-main">
                  <i className="bi bi-search text-white"></i>
                  <span>{language === 'vi' ? 'Tìm' : 'Search'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Work travel option */}
          <div className="work-checkbox-wrapper">
            <Form.Check
              type="checkbox"
              id="work-travel-checkbox"
              checked={isWorkTravel}
              onChange={(e) => setIsWorkTravel(e.target.checked)}
              label={
                <span className="text-dark">
                  {language === 'vi' ? 'Tôi đi công tác' : 'I’m traveling for work'}
                </span>
              }
            />
          </div>
        </form>
      </Container>
    </div>
  );
}
