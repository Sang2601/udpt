import React from 'react';
import { Form, Button } from 'react-bootstrap';

export default function FilterSidebar({
  filters,
  setFilters,
  onResetFilters,
  language
}) {
  const handleStarToggle = (star) => {
    setFilters(prev => {
      const exists = prev.stars.includes(star);
      return {
        ...prev,
        stars: exists ? prev.stars.filter(s => s !== star) : [...prev.stars, star]
      };
    });
  };

  const handleAmenityToggle = (amenity) => {
    setFilters(prev => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists ? prev.amenities.filter(a => a !== amenity) : [...prev.amenities, amenity]
      };
    });
  };

  const amenitiesList = [
    'Hồ bơi vô cực',
    'WiFi miễn phí',
    'Bữa sáng thượng hạng',
    'Bãi biển riêng',
    'Spa cao cấp',
    'Phòng gym'
  ];

  return (
    <div className="filter-box">
      <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
        <div className="fw-bold fs-5 text-dark">
          {language === 'vi' ? 'Lọc theo:' : 'Filter by:'}
        </div>
        <Button
          variant="link"
          size="sm"
          className="text-decoration-none p-0 text-primary"
          onClick={onResetFilters}
        >
          {language === 'vi' ? 'Đặt lại' : 'Reset'}
        </Button>
      </div>

      {/* Free cancellation quick filter */}
      <div className="mb-4">
        <Form.Check
          type="checkbox"
          id="filter-cancellation"
          label={
            <span className="fw-semibold text-success">
              <i className="bi bi-check-circle-fill me-1"></i>
              {language === 'vi' ? 'Miễn phí hủy phòng' : 'Free cancellation'}
            </span>
          }
          checked={filters.freeCancellation}
          onChange={(e) => setFilters(prev => ({ ...prev, freeCancellation: e.target.checked }))}
        />
      </div>

      {/* Star Rating */}
      <div className="mb-4">
        <div className="filter-title">
          {language === 'vi' ? 'Xếp hạng sao' : 'Star rating'}
        </div>
        {[5, 4, 3].map(star => (
          <div key={star} className="mb-2">
            <Form.Check
              type="checkbox"
              id={`star-${star}`}
              checked={filters.stars.includes(star)}
              onChange={() => handleStarToggle(star)}
              label={
                <span className="d-flex align-items-center gap-1">
                  <span>{star} {language === 'vi' ? 'sao' : 'stars'}</span>
                  <span className="text-warning" style={{ fontSize: '12px' }}>
                    {[...Array(star)].map((_, i) => (
                      <i key={i} className="bi bi-star-fill me-0.5"></i>
                    ))}
                  </span>
                </span>
              }
            />
          </div>
        ))}
      </div>

      {/* Review Score */}
      <div className="mb-4">
        <div className="filter-title">
          {language === 'vi' ? 'Điểm đánh giá' : 'Review score'}
        </div>
        {[
          { score: 9, label: language === 'vi' ? 'Tuyệt hảo: 9+' : 'Superb: 9+' },
          { score: 8.5, label: language === 'vi' ? 'Rất tốt: 8.5+' : 'Very good: 8.5+' },
          { score: 8, label: language === 'vi' ? 'Tốt: 8+' : 'Good: 8+' }
        ].map(item => (
          <div key={item.score} className="mb-2">
            <Form.Check
              type="radio"
              name="review-score"
              id={`score-${item.score}`}
              checked={filters.minScore === item.score}
              onChange={() => setFilters(prev => ({ ...prev, minScore: prev.minScore === item.score ? 0 : item.score }))}
              label={item.label}
            />
          </div>
        ))}
      </div>

      {/* Max Budget Slider */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <div className="filter-title mb-0">
            {language === 'vi' ? 'Ngân sách tối đa' : 'Max budget'}
          </div>
          <span className="small text-primary fw-bold">
            {(filters.maxPrice / 1000000).toFixed(1)} tr ₫
          </span>
        </div>
        <Form.Range
          min={1000000}
          max={15000000}
          step={500000}
          value={filters.maxPrice}
          onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: Number(e.target.value) }))}
        />
        <div className="d-flex justify-content-between small text-muted">
          <span>1 tr ₫</span>
          <span>15 tr ₫</span>
        </div>
      </div>

      {/* Popular Amenities */}
      <div className="mb-2">
        <div className="filter-title">
          {language === 'vi' ? 'Tiện nghi phổ biến' : 'Popular amenities'}
        </div>
        {amenitiesList.map(amenity => (
          <div key={amenity} className="mb-2">
            <Form.Check
              type="checkbox"
              id={`amenity-${amenity}`}
              checked={filters.amenities.includes(amenity)}
              onChange={() => handleAmenityToggle(amenity)}
              label={amenity}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
