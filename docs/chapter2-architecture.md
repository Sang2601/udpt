# CHAPTER 2 – SYSTEM ARCHITECTURE (KIẾN TRÚC HỆ THỐNG)

Hệ thống được thiết kế theo kiến trúc Microservices, trong đó mỗi service đảm nhiệm một chức năng riêng biệt và hoạt động độc lập.

## Các service chính đã triển khai:

- User Service: quản lý thông tin người dùng

- Auth Service: xác thực và cấp JWT token

## Mỗi service:

- Có source code riêng

- Chạy trên port riêng

- Không dùng chung database

- Giao tiếp với nhau thông qua REST API

Kiến trúc này giúp hệ thống dễ mở rộng, dễ bảo trì và dễ triển khai trên môi trường cloud.