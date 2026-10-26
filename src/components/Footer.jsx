import { Container } from 'react-bootstrap';
export default function Footer({ language }) {
  return <footer className="border-top py-4 mt-auto bg-light"><Container>
    <strong>HotelBooking</strong>
    <p className="small text-muted mb-0">{language === 'vi'
      ? 'Hệ thống đặt phòng khách sạn trực tuyến — bản giao diện sử dụng dữ liệu mẫu.'
      : 'Online hotel booking — frontend demonstration with sample data.'}</p>
  </Container></footer>;
}
