# PhenikaaHotel — Hệ thống Đặt phòng Khách sạn & Nghỉ dưỡng Cao cấp

Ứng dụng đặt phòng trực tuyến hiện đại mang nhận diện thương hiệu Tập đoàn Phenikaa (**PhenikaaHotel**), được phát triển trên kiến trúc ứng dụng web phân tán kết hợp **React 19 + Vite** (Frontend) và **Express.js + SQLite / REST API** (Backend & CSDL).

---

## 🌟 Tính năng chính

### 1. Dành cho Khách hàng & Người dùng
- **Tìm kiếm & Bộ lọc linh hoạt:** Tìm kiếm theo điểm đến thịnh hành (Hà Nội, Đà Nẵng, TP. HCM, Phú Quốc, Đà Lạt...), xếp hạng sao, điểm đánh giá, tiện ích và mức ngân sách.
- **Kiểm tra phòng trống thời gian thực (Live Availability):** Hệ thống kết nối trực tiếp CSDL kiểm tra số lượng phòng trống theo từng khoảng ngày nhận/trả phòng.
- **Đặt phòng & Xác nhận CSDL tức thì:** Điền thông tin đặt phòng, lưu trực tiếp vào CSDL hệ thống và cấp mã đặt phòng duy nhất (`BK-xxxxxx`).
- **Quản lý đơn cá nhân (My Bookings):** Tra cứu đơn đặt phòng theo mã đơn hoặc email, theo dõi trạng thái đơn và hủy phòng (tự động hoàn trả số lượng phòng trống vào kho).
- **Hỗ trợ đa ngôn ngữ & Tiền tệ:** Chuyển đổi linh hoạt giữa **Tiếng Việt 🇻🇳** và **English 🇬🇧**, định dạng tiền tệ **VND (₫)** và **USD ($)**.

### 2. Dành cho Quản trị viên (Admin Panel)
- **Bảo mật & Phân quyền chặt chẽ:** Chỉ tài khoản có quyền `admin` mới hiển thị nút và truy cập được vào Bảng điều khiển quản trị.
- **Thống kê tổng quan:** Theo dõi tổng doanh thu thực tế, số lượng đơn đặt phòng hoạt động, số lượng khách sạn và tổng kho phòng.
- **Quản lý đơn đặt phòng:** Tìm kiếm, lọc theo trạng thái (*Đã xác nhận*, *Hoàn thành*, *Đã hủy*), xác nhận khách nhận phòng hoặc hủy đơn hoàn trả phòng trống.
- **Quản lý khách sạn & Kho phòng:** Xem danh sách chỗ nghỉ, thêm khách sạn mới, tùy chỉnh số lượng phòng trong kho (`totalUnits`) cho từng loại phòng theo thời gian thực.

---

## 🔑 Tài khoản mặc định hệ thống

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@phenikaa.com` | `admin123` | Toàn quyền truy cập Trang Quản Trị và quản lý dữ liệu CSDL |
| **Khách hàng (User)** | `khachhang@phenikaa.com` | `user123` | Đặt phòng, tự động điền form, quản lý đơn cá nhân |

*(Người dùng cũng có thể bấm **Đăng ký** để tạo tài khoản mới bất kỳ lúc nào)*

---

---

---

## 🌐 Kiến trúc Ứng dụng Phân tán & Cơ chế Chịu lỗi Đa Cổng (Môn Ứng dụng phân tán)

Hệ thống được thiết kế theo đúng mô hình **Kiến trúc phân tán chịu lỗi cao (High-Availability Fault-Tolerant Distributed Cluster)** với **5 Cổng Backend độc lập**:

```
           [ Client Trình Duyệt / Frontend React (Port 5173) ]
                    │                                 ▲
                    │ (Tự động chuyển cổng Failover)  │
                    ▼                                 │
     ┌─────────────────────────────────────────────────────────────────┐
     │  Cụm Máy Chủ Phân Tán (5 Cổng Backend Độc Lập + 1 Cổng Gateway) │
     ├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
     │   Cổng 5001 │   Cổng 5002 │   Cổng 5003 │   Cổng 5004 │Cổng 5005│
     │  (Node-1)   │  (Node-2)   │  (Node-3)   │  (Node-4)   │(Node-5) │
     └──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
            │             │             │             │           │
            └─────────────┴─────────────┼─────────────┴───────────┘
                                        ▼
                  ┌──────────────────────────────────────────┐
                  │  Cơ sở Dữ liệu Tập trung Đồng thời       │
                  │  (SQLite WAL Concurrency Mode)           │
                  └──────────────────────────────────────────┘
```

### 1. Nguyên lý phân tán & Chịu lỗi Đa Cổng:
1. **5 Cổng Backend độc lập:** Chạy đồng thời 5 Node backend worker trên 5 cổng khác nhau: **`5001`**, **`5002`**, **`5003`**, **`5004`**, **`5005`**. Mỗi node là 1 tiến trình Node.js riêng biệt.
2. **Cân bằng tải Round-Robin giữa các cổng:** Client tự động luân chuyển đều các yêu cầu qua các cổng đang hoạt động.
3. **Chịu lỗi tức thì khi tắt cổng (Zero-Downtime Multi-Port Failover):**
   - Khi bất kỳ 1 cổng nào bị tắt (ví dụ tắt cổng `5001`), Client ngay lập tức phát hiện lỗi kết nối và tự động chuyển sang cổng tiếp theo (`5002`, `5003`, `5004`, `5005`) trong < 50ms.
   - **Người dùng không hề bị gián đoạn, không gặp màn hình lỗi, website vẫn tìm kiếm và đặt phòng hoàn toàn bình thường!**
4. **Đồng bộ dữ liệu an toàn:** Kích hoạt chế độ `PRAGMA journal_mode = WAL;` và `PRAGMA busy_timeout = 10000;`, cho phép cả 5 cổng cùng đọc ghi đồng thời vào CSDL mà không bị xung đột khóa (locking).

---

## 🧪 Hướng dẫn Giảng viên Kiểm tra Tắt Cổng (Failover Test)

Giảng viên có thể kiểm tra tắt bất kỳ cổng nào theo các bước:

1. **Khởi chạy toàn bộ hệ thống phân tán:**
   ```sh
   npm run dev
   ```
   *(Lệnh này sẽ khởi động 5 cổng backend 5001, 5002, 5003, 5004, 5005, cổng Gateway 5000 và Frontend 5173)*

2. **Mở website tại:** `http://localhost:5173/`
   - Bấm F12 mở tab **Console** để theo dõi log điều hướng cổng phân tán.

3. **Thực hiện tắt 1 cổng bất kỳ để kiểm tra:**
   - Mở PowerShell hoặc Task Manager:
     - Tắt tiến trình cổng 5001 (hoặc dùng `Stop-Process -Id <PID_PORT_5001>`).
     - Hoặc nếu chạy từng cổng ở từng cửa sổ terminal riêng biệt: bấm `Ctrl + C` ở cửa sổ cổng 5001 để tắt.
   - Quay lại trang web bấm **Tìm kiếm**, **Xem chi tiết khách sạn** hoặc **Đặt phòng**:
     - **Kết quả:** Trang web **vẫn hoạt động bình thường 100%**, không hề bị sập!
     - Trong Console sẽ hiển thị:
       ```
       [Hệ Thống Phân Tán] ⚠️ Cổng http://localhost:5001/api/... đã bị tắt! Tự động chuyển request sang cổng tiếp theo...
       ```
     - Request được cổng 5002 hoặc 5003 xử lý thành công ngay lập tức!
   - Thầy có thể tiếp tục tắt thêm cổng 5002, 5003: Hệ thống vẫn tiếp tục chạy mượt mà trên cổng 5004, 5005!

---

## 🚀 Các lệnh chạy dự án

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `npm run dev` | Khởi chạy toàn bộ cụm: 5 cổng backend (5001-5005), Gateway (5000) và Frontend Vite (5173) |
| `npm run nodes` | Chạy đồng thời 5 cổng backend (5001, 5002, 5003, 5004, 5005) |
| `npm run cluster` | Chạy 5 cổng backend + cổng Gateway 5000 |
| `npm run node1` | Chạy riêng lẻ Cổng 5001 |
| `npm run node2` | Chạy riêng lẻ Cổng 5002 |
| `npm run node3` | Chạy riêng lẻ Cổng 5003 |
| `npm run node4` | Chạy riêng lẻ Cổng 5004 |
| `npm run node5` | Chạy riêng lẻ Cổng 5005 |
| `npm run gateway` | Chạy riêng cổng Gateway (Port 5000) |
| `npm run client` | Chạy riêng Frontend Vite (Port 5173) |
| `npm run build` | Biên dịch bản tối ưu sản phẩm (Production Build) |

---

## 📂 Cấu trúc thư mục

```
webnc/
├── server/
│   ├── database/
│   │   ├── db.js             # Kết nối SQLite, khởi tạo schema & seed dữ liệu
│   │   └── schema.sql        # Định nghĩa cấu trúc bảng users, hotels, rooms, bookings
│   └── server.js             # REST API server (Auth, Hotels, Rooms, Bookings, Admin)
├── src/
│   ├── components/           # Các component React (Header, SearchBar, FilterSidebar,
│   │                         # HotelCard, HotelDetailModal, MyBookingsModal,
│   │                         # AdminDashboardModal, TrendingDestinations, Footer)
│   ├── data/                 # Dữ liệu khởi tạo & danh sách điểm đến
│   ├── services/             # Axios API client kết nối REST API backend
│   ├── utils/                # Hàm định dạng tiền tệ & thời gian
│   ├── App.jsx               # Logic trang chính & điều phối modal
│   └── index.css             # Hệ màu thương hiệu Phenikaa (#002855 & #F37021)
├── index.html
├── package.json
└── vite.config.js
```
