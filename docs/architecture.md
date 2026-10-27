# Kiến Trúc Hệ Thống Phân Tán PhenikaaHotel
## Tài Liệu Báo Cáo Kỹ Thuật - Môn Ứng Dụng Phân Tán

---

### 1. Tổng Quan Kiến Trúc (Architecture Overview)

Hệ thống **PhenikaaHotel** được chuyển đổi từ mô hình Monolithic nguyên khối sang mô hình **Microservices phân tầng**, kết hợp cơ sở dữ liệu phân tán **CockroachDB**, hàng đợi thông điệp **RabbitMQ**, và giải thuật định danh phân tán **Chord DHT**.

Toàn bộ hệ thống tuân thủ 4 nguyên lý trọng tâm theo 4 bài học:
1. **Bài 1: Tổng quan hệ phân tán** – Phân tầng dịch vụ (Tiering), Che giấu chi tiết phân tán (Access & Location Transparency qua API Gateway), Tính mở qua hợp đồng giao diện, Co giãn ngang qua Replicas.
2. **Bài 2: Tiến trình và luồng** – Tách biệt ranh giới tiến trình (Independent OS Processes), Luồng xử lý công việc có giới hạn (`worker_threads` Bounded Worker Pool) cho tác vụ tổng hợp báo cáo nặng CPU.
3. **Bài 3: Trao đổi thông tin** – Đa dạng hóa giao thức: REST HTTP cho client, RPC (JSON-RPC 2.0) cho giao tiếp đồng bộ giữa các service nội bộ, Message Broker (RabbitMQ) và Transactional Outbox cho sự kiện bất đồng bộ.
4. **Bài 4: Định danh** – Phân định rõ Tên, Địa chỉ và Định danh. Chuẩn hóa toàn bộ khóa chính thành UUIDv4, tách biệt mã hiển thị thân thiện, triển khai thuật toán Bảng băm phân tán (Chord DHT) theo chuẩn lý thuyết.

---

### 2. Sơ Đồ Kiến Trúc Tổng Thể

```
[ Frontend: React 19 + Vite ] (Port 3000 / 5173)
           │
           │ (HTTP / JSON REST)
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Port 5000)                  │
│   - Reverse Proxy & URL Path Routing                        │
│   - X-Request-Id Tracing Middleware                         │
│   - 10s Request Deadline Timeout Handling                   │
│   - Round-Robin Load Balancer with Health Check Eviction    │
└──────────────┬─────────────┬─────────────┬──────────────────┘
               │             │             │
        /api/auth       /api/hotels   /api/bookings
               │             │             │
               ▼             ▼             ▼
      ┌─────────────┐ ┌─────────────┐ ┌───────────────────────────┐
      │ Auth Service│ │Hotel Service│ │ Booking Service Replicas  │
      │ (Port 5001) │ │ (Port 5002) │ │   Node 1 (Port 5003)      │
      └──────┬──────┘ └──────┬──────┘ │   Node 2 (Port 5004)      │
             │               │        └─────┬───────────────┬─────┘
             │               │              │               │
             │      JSON-RPC 2.0 (Pricing)  │               │
             │   ◄──────────────────────────┘               │
             │                                     Transactional Outbox
             │                                              │
             │                                              ▼
             │                                    ┌───────────────────┐
             │                                    │ RabbitMQ Exchange │
             │                                    │  'hotel.events'   │
             │                                    └─────────┬─────────┘
             │                                              │ Topic: booking.*
             │                                              ▼
             │                                    ┌───────────────────┐
             │                                    │Notification Svc   │
             │                                    │   (Port 5005)     │
             │                                    └─────────┬─────────┘
             │                                              │
             ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              HAProxy Cluster Load Balancer (Port 26250)             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│ Roach Node 1 │ ◄──Raft──►  │ Roach Node 2 │ ◄──Raft──►  │ Roach Node 3 │
│ (Port 26257) │  Consensus  │ (Port 26258) │  Consensus  │ (Port 26259) │
│ Vol: roach1  │             │ Vol: roach2  │             │ Vol: roach3  │
└──────────────┘             └──────────────┘             └──────────────┘
  - auth_db (auth_user)       - hotel_db (hotel_user)
  - booking_db (booking_user) - notification_db (notification_user)
```

---

### 3. Thiết Kế Cơ Sở Dữ Liệu Phân Tán (CockroachDB)

#### 3.1 Cụm 3 Node Phân Tán Thực Sự
- 3 node CockroachDB độc lập (`roach1`, `roach2`, `roach3`) tham gia cùng một cluster thông qua cờ `--join=roach1:26257,roach2:26257,roach3:26257`.
- Quá trình khởi tạo cluster được kích hoạt chính thống bằng lệnh `cockroach init`.
- Dữ liệu được phân vùng thành các Range (mặc định 64MB) và sao chép theo giải thuật đồng thuận **Raft** (Replication Factor = 3).
- Mỗi node sở hữu một Persistent Volume riêng biệt (`roach1-data`, `roach2-data`, `roach3-data`), bảo toàn dữ liệu khi container bị dừng hoặc khởi động lại.
- Tầng truy cập được bảo vệ bởi **HAProxy**, tự động kiểm tra health check qua HTTP endpoint `http://roachX:8080/health?ready=1` và điều hướng kết nối đến các node đang sống.

#### 3.2 Cô Lập Cơ Sở Dữ Liệu Theo Dịch Vụ (Database-per-Service)
Để đảm bảo tính tự trị (autonomy) của microservice:
- `auth_db`: Thuộc quyền quản lý của Auth Service, tài khoản `auth_user`.
- `hotel_db`: Thuộc quyền quản lý của Hotel Service, tài khoản `hotel_user`.
- `booking_db`: Thuộc quyền quản lý của Booking Service, tài khoản `booking_user`.
- `notification_db`: Thuộc quyền quản lý của Notification Service, tài khoản `notification_user`.

**Nguyên tắc bất khả xâm phạm:**
- Không dùng tài khoản `root` trong cấu hình ứng dụng microservice.
- Không thực hiện truy vấn `JOIN` chéo database giữa các service.
- Mọi tương tác lấy dữ liệu của service khác bắt buộc phải thông qua API hoặc RPC.

---

### 4. Cơ Chế Chống Đặt Trùng Phòng & Tính Nhất Quán Giao Dịch

#### 4.1 Bảng Tồn Phòng Theo Ngày (`room_daily_inventory`)
Thay vì tính toán phòng trống bằng cách quét toàn bộ lịch sử đơn đặt (dễ gây nghẽn và race condition), hệ thống thiết kế bảng tồn phòng chuyên biệt:
```sql
CREATE TABLE room_daily_inventory (
    room_type_id UUID NOT NULL,
    stay_date DATE NOT NULL,
    total_rooms INT NOT NULL CHECK (total_rooms >= 0),
    booked_rooms INT NOT NULL DEFAULT 0 CHECK (booked_rooms >= 0),
    PRIMARY KEY (room_type_id, stay_date),
    CONSTRAINT check_inventory_capacity CHECK (booked_rooms <= total_rooms)
);
```

#### 4.2 Giao Dịch Đặt Phòng Nguyên Tử Đa Đêm
Khi khách đặt phòng từ ngày $D_{in}$ đến $D_{out}$:
1. Hệ thống xác định danh sách tất cả các ngày lưu trú: $[D_{in}, D_{out})$.
2. Trong một giao dịch mức `SERIALIZABLE`, hệ thống thực hiện kiểm tra và cập nhật nguyên tử:
   ```sql
   UPDATE room_daily_inventory
   SET booked_rooms = booked_rooms + :count
   WHERE room_type_id = :roomTypeId AND stay_date = :date
     AND (total_rooms - booked_rooms) >= :count;
   ```
3. Nếu bất kỳ một đêm nào không còn đủ phòng, câu lệnh update trả về 0 row affected $\to$ Giao dịch ngay lập tức bị **ROLLBACK toàn bộ**, giải phóng tất cả các đêm đã trừ trước đó mà không để lại dữ liệu rác.
4. Xử lý **CockroachDB Retry Loop**: Khi xảy ra xung đột tương tranh ở mức Serializable, CockroachDB trả về mã lỗi `SQLSTATE 40001` (`serialization_failure`). Adapter tự động áp dụng giải thuật **Exponential Backoff with Jitter** và thử lại giao dịch tối đa 5 lần.

#### 4.3 Đảm Bảo Tính Bất Khả Biến (Idempotency)
- Client gửi header `Idempotency-Key` (chuỗi UUID duy nhất cho mỗi thao tác nhấn nút Đặt phòng).
- Server băm nội dung yêu cầu bằng `SHA-256`.
- Nếu phát hiện trùng khóa và cùng mã băm: Trả lại kết quả đơn hàng đã tạo trước đó, không trừ tồn kho lần hai.
- Nếu phát hiện trùng khóa nhưng nội dung bị thay đổi: Từ chối với mã lỗi `422 Unprocessable Entity`.

---

### 5. Giao Tiếp Giữa Các Dịch Vụ (Inter-Service Communication)

#### 5.1 JSON-RPC 2.0 (Authoritative Pricing)
- Trước khi khởi tạo giao dịch đặt phòng, Booking Service gọi phương thức từ xa `hotel.getRoomTypeRate` đến Hotel Service qua giao thức `JSON-RPC 2.0`.
- Lời gọi mạng này được đặt **bên ngoài** giao dịch database của Booking Service để tránh giữ khóa lâu.
- Dữ liệu trả về gồm giá chốt có thẩm quyền, đơn vị tiền tệ và tên phòng. Giá này được lưu trực tiếp vào bản ghi `bookings.unit_price` và `bookings.total_price`, ngăn chặn hoàn toàn việc client tự sửa giá trong request.

#### 5.2 RabbitMQ & Transactional Outbox Pattern
Để giải quyết bài toán "Dual-Write" (ghi database thành công nhưng gửi message thất bại):
1. **Tại Booking Service:** Trong cùng một giao dịch commit đơn đặt phòng, một bản ghi sự kiện được ghi vào bảng `outbox_events`.
2. **Tiến trình Outbox Publisher:** Quét các sự kiện chưa publish, gửi lên RabbitMQ topic exchange `hotel.events` với chế độ `persistent: true` và `publisher confirms`. Sau khi nhận được ACK từ broker, sự kiện mới được đánh dấu `published = true`.
3. **Tại Notification Service:** Consumer đăng ký hàng đợi bền vững `notification.bookings.queue`. Khi nhận sự kiện, tiến trình kiểm tra `event_id`. Nếu đã xử lý rồi thì bỏ qua (Idempotent Consumer), sau đó gửi `channel.ack(msg)` xác nhận thủ công.

---

### 6. Mô Hình Dispatcher & Bounded Worker Pool (Bài 2)

Để minh họa quản lý tiến trình và luồng theo Bài 2:
- **Main Thread (Dispatcher):** Tiếp nhận yêu cầu HTTP `GET /api/bookings/admin/report`, thực hiện truy vấn thô từ database.
- **Worker Pool:** Duy trì 4 `worker_threads` độc lập và một hàng đợi FIFO có giới hạn (50 tasks).
- Tác vụ tính toán thống kê (occupancy rate, room nights, doanh thu dự kiến) được đẩy vào Worker Thread qua `parentPort.postMessage()`.
- Mỗi lần thực thi, Worker Thread in ra log gồm `PID`, `ThreadId`, và `JobId`.
- **Bảo vệ tài nguyên:** Nếu hàng đợi đạt ngưỡng 50 tasks, hệ thống từ chối nhận thêm việc và trả về mã lỗi `429 Too Many Requests / 503 Overloaded` (Backpressure), ngăn ngừa cạn kiệt bộ nhớ hệ thống.

---

### 7. Định Danh Phân Tán & Mô Phỏng Chord DHT (Bài 4)

- **Trong ứng dụng:** Toàn bộ ID thực thể (`users.id`, `hotels.id`, `room_types.id`, `bookings.id`, `outbox_events.id`) sử dụng **UUIDv4** chuẩn quốc tế (128-bit), loại bỏ xung đột khi mở rộng đa node.
- **Mã hiển thị:** Người dùng tra cứu qua mã dạng `PK-XXXXXX` (như `PK-849201`), không dùng mã này làm khóa chính toàn cục.
- **Mô phỏng Chord DHT (`examples/chord/`):**
  - Không gian định danh $m = 6$ ($2^6 = 64$ slots, từ 0 đến 63).
  - Khởi tạo 10 node: 1, 8, 14, 21, 32, 38, 42, 48, 51, 56.
  - Bảng Finger Table tại Node 8:
    - $i=0: \text{start } 9 \to \text{succ } 14$
    - $i=1: \text{start } 10 \to \text{succ } 14$
    - $i=2: \text{start } 12 \to \text{succ } 14$
    - $i=3: \text{start } 16 \to \text{succ } 21$
    - $i=4: \text{start } 24 \to \text{succ } 32$
    - $i=5: \text{start } 40 \to \text{succ } 42$
  - Phân bổ khóa: $10 \to 14$, $24 \to 32$, $30 \to 32$, $38 \to 38$, $54 \to 56$.
  - Node 26 tham gia vòng: Khóa 24 được tự động di chuyển từ Node 32 sang Node 26 (Consistent Hashing).

---

### 8. Các Giới Hạn Còn Lại & Điểm Nghẽn Vật Lý (Honest Limitations)

1. **Môi Trường Triển Khai Thực Nghiệm:** Cấu hình Docker Compose trong dự án chạy toàn bộ các container trên cùng **một máy vật lý host**. Đây là mô phỏng hệ phân tán qua mạng container (Docker bridge network), không phải nhiều máy chủ đặt tại các trung tâm dữ liệu địa lý khác nhau. Nếu máy host sập, toàn bộ hệ thống sẽ dừng.
2. **Single RabbitMQ Broker:** Trong cấu hình demo, RabbitMQ chạy dưới dạng 1 instance đơn lẻ. Nếu RabbitMQ bị tắt, đơn đặt phòng vẫn được bảo toàn trong `outbox_events`, nhưng việc gửi thông báo sẽ bị hoãn lại cho đến khi broker phục hồi. Trong môi trường production, cần triển khai RabbitMQ Quorum Queues cluster.
3. **API Gateway:** Hiện tại API Gateway đóng vai trò Single Point of Entry. Nếu Gateway gặp sự cố, client không thể gửi yêu cầu đến các microservices. Trong kiến trúc quy mô lớn, cần đặt Gateway phía sau các tầng cân bằng tải phần cứng (F5) hoặc DNS Anycast đa vùng.
