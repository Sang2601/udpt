import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { trendingDestinations } from '../data/destinationsData';

export default function TrendingDestinations({ onSelectDestination, language }) {
  // First 2 featured destinations
  const topTwo = trendingDestinations.slice(0, 2);
  // Next 3 destinations
  const nextThree = trendingDestinations.slice(2, 5);

  return (
    <Container className="my-5">
      <div className="mb-4">
        <h2 className="fw-bold fs-3 mb-1 text-dark">
          {language === 'vi' ? 'Điểm đến thịnh hành' : 'Trending destinations'}
        </h2>
        <p className="text-muted mb-0">
          {language === 'vi'
            ? 'Du khách tìm kiếm về Việt Nam cũng đã đặt chỗ ở những nơi này'
            : 'Travellers searching for Vietnam also booked these'}
        </p>
      </div>

      {/* Row 1: 2 large cards */}
      <Row className="g-3 mb-3">
        {topTwo.map((dest) => (
          <Col md={6} key={dest.id}>
            <div className="dest-card featured" onClick={() => onSelectDestination(dest.name)}>
              <img src={dest.image} alt={dest.name} className="dest-card-img" />
              <div className="dest-card-overlay">
                <span className="dest-card-tag">{dest.tag}</span>
                <div>
                  <div className="dest-card-title">
                    {dest.name} <span style={{ fontSize: '18px' }}>{dest.flag}</span>
                  </div>
                  <div className="dest-card-count">
                    {dest.propertiesCount} {language === 'vi' ? 'chỗ nghỉ' : 'properties'}
                  </div>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Row 2: 3 cards */}
      <Row className="g-3">
        {nextThree.map((dest) => (
          <Col md={4} key={dest.id}>
            <div className="dest-card" onClick={() => onSelectDestination(dest.name)}>
              <img src={dest.image} alt={dest.name} className="dest-card-img" />
              <div className="dest-card-overlay">
                <span className="dest-card-tag">{dest.tag}</span>
                <div>
                  <div className="dest-card-title">
                    {dest.name} <span style={{ fontSize: '18px' }}>{dest.flag}</span>
                  </div>
                  <div className="dest-card-count">
                    {dest.propertiesCount} {language === 'vi' ? 'chỗ nghỉ' : 'properties'}
                  </div>
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </Container>
  );
}
