# HotelBooking — hệ thống đặt phòng khách sạn

## Phạm vi yêu cầu
Người dùng tìm kiếm khách sạn, xem thông tin và giá phòng, kiểm tra phòng trống, đặt phòng và quản lý đơn. Quản trị viên quản lý khách sạn, phòng nghỉ và đơn đặt phòng. Kiến trúc đích là ứng dụng phân tán, giao tiếp qua REST API.

## Trạng thái hiện tại
Đây là frontend React + Vite sử dụng dữ liệu mẫu. Đã có tìm kiếm, bộ lọc, sắp xếp, xem chi tiết phòng và biểu mẫu đặt phòng mô phỏng. Đăng nhập là mô phỏng; thông báo đặt phòng không tạo đơn thực tế, gửi email hay giữ phòng.

Chưa triển khai: backend REST API, cơ sở dữ liệu, xác thực/phân quyền, tồn phòng theo ngày, lưu và quản lý đơn, trang quản trị khách sạn/phòng/đơn. Không coi bản frontend này là hệ thống phân tán đã hoàn chỉnh.

## Kiến trúc đích trong phạm vi đề tài
- Client: giao diện khách hàng và giao diện quản trị.
- API Gateway: điểm vào REST API.
- Auth/User: tài khoản và quyền khách hàng/quản trị viên.
- Hotel/Room: khách sạn, phòng, giá và tồn phòng theo ngày.
- Booking: tạo, xem và hủy đơn theo chính sách; phối hợp giữ/giải phóng phòng.
- Lưu trữ do từng dịch vụ sở hữu. Xác định rõ quyền sở hữu dữ liệu tài khoản.

Không bao gồm chuyến bay, combo, thuê xe, tham quan, taxi, chương trình khách hàng thân thiết, bản tin quảng cáo hoặc thanh toán trực tuyến.

## Chạy dự án
Cài Node.js đáp ứng yêu cầu của Vite trong package-lock.json, sau đó:

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run lint
```

Bản ZIP không chứa node_modules và dist cũ. Cần cài dependency và build lại.
