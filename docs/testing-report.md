# Báo Cáo Kết Quả Kiểm Thử Thực Nghiệm (Testing Report)
## Hệ Thống Phân Tán PhenikaaHotel - Môn Ứng Dụng Phân Tán

---

### 1. Thông Tin Môi Trường Kiểm Thử Thực Tế

- **Hệ điều hành:** Microsoft Windows 11 Home / Pro (x64)
- **Node.js Runtime:** `v24.18.0`
- **NPM Package Manager:** `11.6.0`
- **Công cụ dòng lệnh:** PowerShell 5.1 / Node.js native child_process
- **Trạng thái Docker trên máy hiện tại:** Chưa có Docker / Docker Compose trong biến môi trường PATH.
- **Quy tắc báo cáo:** Phản ánh trung thực 100% những kiểm thử đã chạy trực tiếp trên môi trường máy host và đánh dấu rõ ràng phần chưa kiểm chứng do giới hạn công cụ.

---

### 2. Kết Quả Kiểm Thử Thực Nghiệm Natively (Đã Chạy & Đạt 100%)

Lệnh thực thi toàn bộ:
```bash
npm test
```
*(hoặc `node tests/run_all_tests.js`)*

| Bộ Kiểm Thử (Test Suite) | File Mã Nguồn | Số Assertions | Kết Quả Thực Tế | Nội Dung Đã Được Xác Minh |
| :--- | :--- | :--- | :--- | :--- |
| **1. Mô phỏng thuật toán Chord DHT (Bài 4)** | `tests/chord.test.js` | 17/17 | **PASS (100%)** | - Bảng Finger Table tại Node 8 khớp 100% slide ($i=0..5$).<br>- Phân bổ 5 khóa (10, 24, 30, 38, 54) đúng các node.<br>- Node 26 tham gia vòng, khóa 24 tự động chuyển từ Node 32 sang 26.<br>- Ghi log vết đường đi (hop tracing) chính xác. |
| **2. Bounded Worker Pool đa luồng (Bài 2)** | `tests/worker_pool.test.js` | 12/12 | **PASS (100%)** | - Khởi tạo 2 worker threads độc lập.<br>- Phân phối tác vụ tổng hợp báo cáo nặng CPU mà không nghẽn Event Loop.<br>- Log rõ ràng PID, ThreadId, JobId.<br>- Cơ chế Backpressure: từ chối tác vụ vượt ngưỡng hàng đợi (queue saturation). |
| **3. Giao tiếp JSON-RPC 2.0 (Bài 3)** | `tests/json_rpc.test.js` | 11/11 | **PASS (100%)** | - Tra cứu giá chốt có thẩm quyền qua HTTP JSON-RPC 2.0.<br>- Xử lý chuẩn mã lỗi: `-32601` (Method not found), `-32602` (Invalid params), `-32001` (Room not found).<br>- Cơ chế Timeout ngắt kết nối với AbortController khi server trễ hạn. |
| **4. Tính bất khả biến Idempotency** | `tests/idempotency.test.js` | 4/4 | **PASS (100%)** | - Gửi lại cùng `Idempotency-Key` với cùng nội dung: trả lại kết quả cũ, không tạo đơn thứ hai.<br>- Gửi lại cùng khóa nhưng thay đổi nội dung (số phòng, giá): phát hiện xung đột và từ chối `422 Unprocessable Entity`. |
| **5. Chống đặt trùng phòng tương tranh cao** | `tests/concurrency_overbooking.test.js` | 5/5 | **PASS (100%)** | - 25 yêu cầu đồng thời tranh giành 2 phòng cuối cùng.<br>- **Đúng 2 đơn thành công, 23 đơn bị từ chối** với lỗi `ROOM_UNAVAILABLE`.<br>- Tồn kho `booked_rooms` chốt đúng bằng 2, không bao giờ vượt quá `total_rooms`. |
| **6. Rollback giao dịch đặt phòng đa đêm** | `tests/multi_night_rollback.test.js` | 8/8 | **PASS (100%)** | - Khách đặt 3 đêm (Đêm 1 còn phòng, Đêm 2 hết phòng, Đêm 3 còn phòng).<br>- Giao dịch bị hủy toàn bộ, không có bản ghi đơn đặt phòng rác.<br>- Đêm 1 và Đêm 3 được hoàn tồn phòng nguyên tử về 0. |
| **7. Hủy đơn bất khả biến (Cancellation Idempotency)** | `tests/cancellation_idempotency.test.js` | 7/7 | **PASS (100%)** | - Hủy lần đầu: hoàn trả 2 phòng vào tồn kho.<br>- Hủy lặp lại lần 2 và lần 3: nhận diện đơn đã hủy trước đó, **không trừ tiếp làm sinh ra phòng ảo**. |

**Tổng kết:** `7/7 Test Suites PASSED (64/64 Assertions Passed)`.

---

### 3. Phần Kiểm Thử Chịu Lỗi Cụm (Chaos Testing Với Docker)

> **TRẠNG THÁI HIỆN TẠI TRÊN MÁY HOST:** 
> `[CHƯA KIỂM CHỨNG TRỰC TIẾP TRÊN MÁY HOST NÀY DO CHƯA CÀI ĐẶT DOCKER/DOCKER DESKTOP TRONG PATH]`.
> 
> Toàn bộ cấu hình `docker-compose.yml`, scripts khởi tạo cụm `init.sql`, cấu hình `haproxy.cfg` đã được viết hoàn chỉnh theo chuẩn chính thức của CockroachDB v23.2.9 và RabbitMQ v3.13.

#### Hướng Dẫn Sinh Viên / Thầy Cô Tự Kiểm Chứng Khi Có Docker Desktop:

1. **Khởi động cụm phân tán:**
   ```bash
   cd infra
   docker compose up -d
   ```
2. **Kiểm tra trạng thái cụm 3 node CockroachDB:**
   ```bash
   docker exec -it roach1 /cockroach/cockroach node status --insecure
   ```
   *Kỳ vọng:* Cả 3 node `roach1`, `roach2`, `roach3` đều hiển thị trạng thái `is_available: true` và `is_live: true`.

3. **Thử nghiệm mất 1 node CockroachDB (Khả năng chịu lỗi Raft):**
   ```bash
   docker stop roach2
   ```
   - Thực hiện thao tác đặt phòng trên web `http://localhost:3000`.
   - *Kết quả kỳ vọng:* Giao dịch đặt phòng vẫn thành công do cụm còn 2/3 nodes đạt đa số Quorum. HAProxy tự động loại `roach2` ra khỏi vòng round-robin mà ứng dụng không bị crash.

4. **Thử nghiệm tạm dừng RabbitMQ (Khả năng chịu lỗi của Outbox Pattern):**
   ```bash
   docker stop rabbitmq
   ```
   - Tạo đơn đặt phòng mới.
   - *Kết quả kỳ vọng:* Đơn đặt phòng vẫn được lưu thành công vào `booking_db`, sự kiện được giữ an toàn trong bảng `outbox_events` với `published = FALSE`.
   - Khởi động lại RabbitMQ:
     ```bash
     docker start rabbitmq
     ```
   - *Kết quả kỳ vọng:* Tiến trình `OutboxPublisher` tự động kết nối lại, gửi thông điệp còn đọng sang RabbitMQ, và Notification Service nhận được thông báo sau khi broker phục hồi.
