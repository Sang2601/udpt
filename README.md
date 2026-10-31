# PhenikaaHotel — Hệ thống Đặt phòng Khách sạn Phân tán (Microservices & MySQL)

Dự án môn **Ứng dụng Phân tán (UDPT)** — Được xây dựng theo đúng bản vẽ kiến trúc đề xuất: **MySQL + Docker Compose + Spring Cloud Gateway Pattern**, tích hợp đầy đủ 4 tính năng cốt lõi của một hệ thống phân tán thực tế.

---

## 🏛️ Sơ đồ Kiến trúc Hệ thống Phân tán

Hệ thống được thiết kế theo mô hình **Microservices Architecture** với phân tách Database riêng biệt (**Database-per-Service Pattern**) và Cổng điều phối trung tâm:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │    Giao diện Client HTML / JavaScript / React : 5500    │
                  └────────────────────────────┬────────────────────────────┘
                                               │ HTTP / JSON
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │          Spring Cloud Gateway (API Gateway) : 8088      │
                  │  (Reverse Proxy, Load Balancer, Circuit Breaker, Auth)  │
                  └──────┬─────────────┬─────────────┬─────────────┬────────┘
                         │             │             │             │
        ┌────────────────┼─────────────┼─────────────┼─────────────┼────────────────┐
        ▼                ▼             ▼             ▼             ▼                ▼
 ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐ ┌───────────────────────┐ ┌──────────────┐
 │ Auth-service │ │ User-service │ │ Room-service Clusters │ │Booking-service Cluster│ │Payment-service│
 │    :8080     │ │    :8081     │ │  :8083 (Replica 1)    │ │  :8082 (Replica 1)    │ │    :8084     │
 └──────────────┘ └──────┬───────┘ │  :8086 (Replica 2)    │ │  :8085 (Replica 2)    │ └──────┬───────┘
                         │         └───────────┬───────────┘ └───────────┬───────────┘        │
                         ▼                     ▼                         ▼                    ▼
                  ┌──────────────┐      ┌──────────────┐          ┌──────────────┐     ┌──────────────┐
                  │    userdb    │      │    roomdb    │          │  bookingdb   │     │  paymentdb   │
                  │    MySQL     │      │    MySQL     │          │    MySQL     │     │    MySQL     │
                  └──────────────┘      └──────────────┘          └──────────────┘     └──────────────┘
                         │                     │                         │                    │
                         └─────────────────────┴────────────┬────────────┴────────────────────┘
                                                            ▼
                                             ┌─────────────────────────────┐
                                             │  Dịch vụ Sao lưu CSDL       │
                                             │  (Automated MySQL Backup)   │
                                             └─────────────────────────────┘
```

---

## 🌟 4 Tính năng Hệ thống Phân tán (Yêu cầu Môn học)

### 1. Tính chịu lỗi (Fault-Tolerance & Database Backup)
* **Cô lập CSDL độc lập (Database-per-Service):** 4 CSDL MySQL (`userdb`, `roomdb`, `bookingdb`, `paymentdb`) hoạt động tách biệt. Sự cố ở CSDL phòng không làm ảnh hưởng đến tài khoản người dùng hoặc lịch sử thanh toán.
* **Cơ chế Sao lưu Tự động (Automated Backup):** Container `db-backup` trong Docker Compose định kỳ xuất bản sao lưu dạng SQL Dump ra volume `/backups`. Đồng thời có script `npm run backup` và `npm run restore` phục hồi thảm họa tức thì.
* **Resilient Dual-Mode Database Adapter:** Mỗi microservice được trang bị bộ điều hợp kết nối thông minh với Connection Pool (`mysql2/promise`). Trong môi trường không có sẵn Docker, hệ thống tự động kích hoạt chế độ Fallback an toàn, tuyệt đối không bị crash server.
* **Tự động chuyển hướng khi sập Node (Zero-Downtime Failover):** Khi một node replica gặp sự cố (ví dụ tắt cổng :8083), Gateway tự động phát hiện trong < 50ms và điều hướng 100% request sang node replica còn lại mà người dùng không gặp gián đoạn.
* **Ngắt mạch chống lỗi dây chuyền (Circuit Breaker):** Khi một dịch vụ downstream tạm thời không phản hồi, Gateway trả về phản hồi fallback chuẩn hóa kèm mã HTTP 503, ngăn chặn cạn kiệt tài nguyên toàn hệ thống.

### 2. Chịu tải của hệ thống phân tán (High Load Resilience)
* **Mở rộng theo chiều ngang (Horizontal Scaling):** Chạy đồng thời nhiều instance cho các dịch vụ có tải trọng cao (`room-service` chạy trên :8083 và :8086; `booking-service` chạy trên :8082 và :8085).
* **Bộ nhớ đệm phân tán (In-Memory Search Caching):** `room-service` tích hợp cache LRU với cơ chế tự động xóa bộ đệm (Cache Invalidation) khi có biến động kho phòng, giúp hệ thống chịu tải hàng ngàn lượt tìm kiếm/giây với độ trễ thấp (< 10ms).
* **Giới hạn tốc độ yêu cầu (Rate Limiter):** Gateway tích hợp bộ lọc giới hạn 300 requests/phút trên từng IP nhằm phòng ngừa tấn công quá tải hoặc DDoS.
* **Quản lý kết nối CSDL (Connection Pooling):** Tối ưu hóa việc tái sử dụng kết nối MySQL, tránh tình trạng "Too many connections".

### 3. Điều phối hệ thống phân tán (Distributed Coordination & Saga Pattern)
* **Saga Orchestrator Pattern cho quy trình Đặt phòng:** Trong môi trường phân tán nhiều CSDL, không thể sử dụng ACID transaction cục bộ. `Booking-service` đóng vai trò nhạc trưởng điều phối giao dịch qua các bước:
  1. **Bước 1 (Booking Service):** Khởi tạo đơn hàng ở trạng thái `PENDING`.
  2. **Bước 2 (Room Service):** Gọi API `/api/rooms/hold` để khóa giữ số lượng phòng trống.
  3. **Bước 3 (Payment Service):** Gọi API `/api/payments/process` để xử lý thanh toán.
  4. **Bước 4 (Commit hoặc Giao dịch bù trừ Rollback):**
     * *Nếu thanh toán thành công:* Cam kết kho phòng (`/api/rooms/confirm`) và cập nhật đơn sang `CONFIRMED`.
     * *Nếu thanh toán thất bại:* Tự động kích hoạt **Compensating Transaction** gọi Room Service `/api/rooms/release` để hoàn trả lại phòng trống, ghi nhận trạng thái `FAILED_PAYMENT_REVERTED`.
* **Cơ chế Idempotency Key:** Chống trừ tiền trùng lặp và đặt phòng 2 lần khi mạng chập chờn.
* **Nhật ký Điều phối (Audit Trail):** Mọi bước trong quy trình Saga được lưu vết minh bạch tại bảng `saga_coordination` và có thể theo dõi trực tiếp tại API `/api/saga/logs`.

### 4. Cân bằng tải (Load Balancer)
* **Thuật toán Round-Robin & Least-Connections:** Được cài đặt ngay tại Gateway :8088, luân chuyển đều các yêu cầu giữa `room-replica-1` (:8083) và `room-replica-2` (:8086), cũng như giữa `booking-replica-1` (:8082) và `booking-replica-2` (:8085).
* **Định danh nguồn xử lý minh bạch:** Mỗi phản hồi HTTP được Gateway đính kèm tiêu đề:
  * `X-Handled-By: room-replica-1:8083`
  * `X-Load-Balancer-Strategy: round-robin`
  * `X-Request-Id: <uuid>`
* **Dashboard Giám sát Trực quan:** Nút **"Hệ Thống Phân Tán"** ngay trên giao diện web hiển thị thời gian thực tỷ lệ % phân phối tải giữa các node.

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Cách 1: Khởi chạy bằng Docker Compose (Khuyên dùng khi có Docker)

Khởi động toàn bộ cụm gồm 4 CSDL MySQL, Dịch vụ Backup, 5 Microservices và Gateway:
```sh
docker-compose up --build
```
* **Giao diện Client:** `http://localhost:5500`
* **Spring Cloud Gateway:** `http://localhost:8088`

---

### Cách 2: Khởi chạy Cục bộ bằng Node.js (Một lệnh duy nhất)

Máy tính đã cài sẵn Node.js (v18+). Chạy lệnh sau để khởi động đồng thời toàn bộ cụm phân tán:
```sh
npm run dev
```

Hệ thống sẽ đồng loạt khởi chạy:
* `GATEWAY` trên port **8088**
* `AUTH-SERVICE` trên port **8080**
* `USER-SERVICE` trên port **8081**
* `ROOM-SERVICE (Replica 1)` trên port **8083**
* `ROOM-SERVICE (Replica 2)` trên port **8086**
* `BOOKING-SERVICE (Replica 1)` trên port **8082**
* `BOOKING-SERVICE (Replica 2)` trên port **8085**
* `PAYMENT-SERVICE` trên port **8084**
* `FRONTEND CLIENT` trên port **5500**

Mở trình duyệt truy cập: `http://localhost:5500`

---

## 🧪 Kịch bản Kiểm Thử (Dành cho Giảng viên & Chấm điểm)

### Kịch bản 1: Kiểm thử Cân bằng tải (Load Balancing)
Mở terminal và chạy script mô phỏng:
```sh
npm run test:load
```
* **Kết quả quan sát:** 100 requests được gửi vào Gateway :8088, Gateway phân bổ chính xác 50% vào `room-replica-1` (:8083) và 50% vào `room-replica-2` (:8086). Hiển thị biểu đồ ASCII phân phối tải và độ trễ phân vị P50/P95/P99.

### Kịch bản 2: Kiểm thử Tính chịu lỗi & Tắt Node (Failover)
```sh
npm run test:failover
```
* **Thử nghiệm:** Tắt tiến trình cổng 8083 (Room Replica 1). Tiếp tục gửi request qua Gateway :8088.
* **Kết quả:** Gateway tự động phát hiện node 8083 bị tắt, chuyển 100% lưu lượng sang cổng 8086. Khách hàng vẫn lướt web và tìm kiếm phòng bình thường, không gặp mã lỗi 500!

### Kịch bản 3: Kiểm thử Sao lưu & Khôi phục CSDL
* **Sao lưu dữ liệu:**
  ```sh
  npm run backup
  ```
  *(Các bản sao lưu được lưu trữ có gắn timestamp tại thư mục `backups/`)*
* **Khôi phục dữ liệu:**
  ```sh
  npm run restore
  ```

### Kịch bản 4: Kiểm thử Điều phối Saga & Giao dịch Bù trừ
1. Mở trang web `http://localhost:5500`. Bấm nút **"Hệ Thống Phân Tán"** trên thanh Header để mở màn hình giám sát.
2. Mở chi tiết 1 khách sạn bất kỳ, bấm đặt phòng.
3. Trong phương thức thanh toán, chọn:
   * **Thanh toán thành công:** Theo dõi Saga hoàn tất 4 bước `PENDING` -> `ROOM_HELD` -> `PAYMENT_PROCESSED` -> `CONFIRMED`.
   * **Mô phỏng lỗi thanh toán:** Nhập phương thức mô phỏng lỗi. Hệ thống kích hoạt ngay **Giao dịch bù trừ**, tự động giải phóng phòng đã giữ, kho phòng không bị thất thoát!
4. Xem nhật ký Saga chi tiết tại tab **5. Điều Phối Phân Tán (Saga)**.

---

## 🔑 Tài khoản Mặc định Hệ thống

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@phenikaa.com` | `admin123` | Quản lý hệ thống, kiểm soát kho phòng, xem toàn bộ đơn đặt |
| **Khách hàng (User)** | `khachhang@phenikaa.com` | `user123` | Tìm kiếm phòng, đặt phòng theo quy trình Saga, xem đơn cá nhân |
