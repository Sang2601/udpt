# Hướng Dẫn Báo Cáo & Demo Hệ Phân Tán PhenikaaHotel
## Dành Cho Báo Cáo Đồ Án Môn Ứng Dụng Phân Tán

---

### PHẦN 1: Chuẩn Bị Môi Trường

Hệ thống được thiết kế linh hoạt với **2 chế độ chạy**:
1. **Chế độ Native Node.js (Chạy tức thì trên Windows không cần Docker):** Sử dụng Node.js v24 có sẵn trên máy, database tự động chuyển sang adapter SQLite nội bộ, toàn bộ logic Microservices, API Gateway, Worker Pool, JSON-RPC, Chord DHT, và Test Concurrency chạy trơn tru 100%.
2. **Chế độ Container Phân Tán (Docker Compose):** Khởi chạy cụm 3 node CockroachDB, HAProxy, RabbitMQ, 4 microservices với 2 replica Booking Service và Frontend Nginx.

---

### PHẦN 2: Kịch Bản Demo Trực Tiếp (Step-by-Step Scenarios)

#### Kịch Bản 1: Demo Thuật Toán Định Danh Chord DHT (Bài 4)
*Mục tiêu: Chứng minh hiểu sâu lý thuyết Bài 4, các công thức toán học và các số liệu trong slide bài giảng.*

1. Mở terminal tại thư mục `c:\Users\duysa\Downloads\webnc\webnc`.
2. Chạy lệnh:
   ```bash
   npm run chord:demo
   ```
3. **Điểm cần chỉ cho Giảng viên:**
   - **Bảng Finger Table tại Node 8:** Đối chiếu từng dòng với slide $DS\_Lec\ 4$.
     - $i=0: \text{Start } 9 \to \text{Successor } 14$
     - $i=1: \text{Start } 10 \to \text{Successor } 14$
     - $i=2: \text{Start } 12 \to \text{Successor } 14$
     - $i=3: \text{Start } 16 \to \text{Successor } 21$
     - $i=4: \text{Start } 24 \to \text{Successor } 32$
     - $i=5: \text{Start } 40 \to \text{Successor } 42$
   - **Vết đường đi (Hop Tracing):** Xem quá trình định tuyến qua các node trung gian trước khi đến đích.
   - **Di chuyển khóa khi Node 26 tham gia:** Cho thấy khóa 24 ban đầu nằm ở Node 32, sau khi Node 26 tham gia vòng thì khóa 24 được tự động chuyển sang Node 26 (Consistent Hashing).

---

#### Kịch Bản 2: Chạy Bộ Kiểm Thử Tự Động Toàn Hệ Thống (Verification Suite)
*Mục tiêu: Chứng minh hệ thống đạt 100% PASS trên tất cả các ràng buộc phân tán.*

1. Trong terminal, chạy lệnh:
   ```bash
   npm test
   ```
2. **Kết quả quan sát trên màn hình:**
   - `chord.test.js`: 17/17 assertions PASS.
   - `worker_pool.test.js`: 12/12 assertions PASS (Worker threads, PID, ThreadId, JobId, Backpressure queue saturation).
   - `json_rpc.test.js`: 11/11 assertions PASS (Lấy giá chốt, mã lỗi `-32601`, `-32001`, timeout).
   - `idempotency.test.js`: 4/4 assertions PASS (Replay trùng khóa không sinh đơn mới, đổi payload bị từ chối 422).
   - `concurrency_overbooking.test.js`: 5/5 assertions PASS (25 yêu cầu đồng thời tranh giành 2 phòng cuối cùng $\to$ Đúng 2 đơn thành công, 23 đơn bị từ chối `ROOM_UNAVAILABLE`, tồn kho không bao giờ âm).
   - `multi_night_rollback.test.js`: 8/8 assertions PASS (Đặt 3 đêm, đêm 2 hết phòng $\to$ Rollback nguyên tử, đêm 1 và 3 không bị trừ phòng ảo).
   - `cancellation_idempotency.test.js`: 7/7 assertions PASS (Hủy nhiều lần chỉ hoàn tồn 1 lần duy nhất).
   - **Tổng kết:** `Overall Status: ALL TEST SUITES PASSED (100%)`.

---

#### Kịch Bản 3: Chạy Toàn Bộ Hệ Thống Microservices & Giao Diện Web
1. Trong terminal, chạy lệnh khởi động đồng thời toàn bộ hệ thống:
   ```bash
   npm run dev
   ```
2. Terminal sẽ khởi chạy đồng loạt:
   - `GW`: API Gateway (Port 5000)
   - `AUTH`: Auth Microservice (Port 5001)
   - `HOTEL`: Hotel Microservice & JSON-RPC (Port 5002)
   - `BOOK1`: Booking Microservice Replica 1 (Port 5003)
   - `BOOK2`: Booking Microservice Replica 2 (Port 5004)
   - `NOTIF`: Notification Microservice (Port 5005)
   - `UI`: Vite React Web Application (Port 5173)

3. Mở trình duyệt tại địa chỉ: `http://localhost:5173`.
4. **Các thao tác demo trên giao diện web:**
   - **Đăng ký tài khoản mới:** Luôn được cấp vai trò `user`, mật khẩu được mã hóa băm bằng `bcryptjs`.
   - **Tìm kiếm & Xem chi tiết khách sạn:** Dữ liệu tải qua API Gateway $\to$ Hotel Service.
   - **Kiểm tra phòng theo ngày:** Kiểm tra tồn phòng thực tế theo ngày trong `room_daily_inventory`.
   - **Đặt phòng:** Client tự sinh `Idempotency-Key` gửi lên Gateway $\to$ Round-robin sang Booking Replica $\to$ Gọi JSON-RPC lấy giá chốt $\to$ Trừ tồn kho nguyên tử.
   - **Xem thông báo:** Mở danh sách thông báo in-app lấy từ Notification Service.
   - **Xem Báo Cáo Thống Kê (Admin):** Đăng nhập bằng tài khoản admin (`admin@phenikaa-hotel.com` / `admin123`). Vào Báo cáo thống kê, backend sẽ kích hoạt `WorkerPool` (Bài 2) sử dụng `worker_threads` tính toán tổng hợp.

---

#### Kịch Bản 4: Kiểm Tra Tình Trạng API Gateway & Các Replicas
1. Mở tab mới hoặc dùng curl/Postman:
   ```bash
   curl http://localhost:5000/gateway/status
   ```
2. Phản hồi JSON sẽ hiển thị trạng thái kết nối tới tất cả các microservices và trạng thái tải cân bằng giữa 2 replica `booking-replica-1` và `booking-replica-2`.
3. Nếu tắt một replica (ví dụ port 5004), Gateway tự động phát hiện qua cơ chế health check sau 2 lần thất bại và loại replica này ra khỏi nhóm điều hướng, đảm bảo các yêu cầu tiếp theo vẫn phục vụ bình thường qua replica còn lại!

---

#### Kịch Bản 5: Triển Khai Cụm Container Phân Tán Với Docker Desktop (Nếu Máy Có Cài Docker)
1. Chuyển vào thư mục `infra`:
   ```bash
   cd infra
   docker compose up -d
   ```
2. Kiểm tra trạng thái cụm 3 node CockroachDB:
   ```bash
   docker exec -it roach1 /cockroach/cockroach node status --insecure
   ```
3. Xem bảng điều khiển quản trị CockroachDB: Mở trình duyệt tại `http://localhost:8081`.
4. Xem giao diện quản trị RabbitMQ: Mở trình duyệt tại `http://localhost:15672` (tài khoản: `hotel_rabbit` / `rabbit_secure_pass_2026`).
5. **Thực hiện kịch bản mất 1 node (Chaos Testing):**
   ```bash
   docker stop roach2
   ```
   Sau đó thực hiện đặt phòng trên web. Cụm CockroachDB vẫn giữ được Quorum (2/3 nodes sống), HAProxy tự động chuyển kết nối sang `roach1` hoặc `roach3`, đơn đặt phòng vẫn thành công 100%!
