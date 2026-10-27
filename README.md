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

## 🌐 Kiến trúc Ứng dụng Phân tán & Cơ chế Chịu lỗi (Môn Ứng dụng phân tán)

Hệ thống được thiết kế theo đúng mô hình **Kiến trúc phân tán chịu lỗi cao (High-Availability Fault-Tolerant Distributed Cluster)**:

```
[ Client Trình Duyệt / Frontend React (Port 5173) ]
                     │ (Giao thức HTTP / REST API)
                     ▼
       ┌───────────────────────────────┐
       │   API Gateway & Load Balancer │
       │         (Port 5000)           │
       │  - Cân bằng tải Round-Robin   │
       │  - Heartbeat Health Check 1.5s│
       │  - Tự động Failover < 50ms    │
       └───────┬──────────────┬────────┘
               │              │
    ┌──────────┴──┐    ┌──────┴──────┐    ┌─────────────┐
    │   Node-1    │    │   Node-2    │    │   Node-3    │
    │ (Port 5001) │    │ (Port 5002) │    │ (Port 5003) │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              ▼
        ┌──────────────────────────────────────────┐
        │  Cơ sở Dữ liệu Tập trung Đồng thời       │
        │  (SQLite WAL Concurrency Mode)           │
        └──────────────────────────────────────────┘
```

### 1. Nguyên lý phân tán & Chịu lỗi:
1. **Đa tiến trình backend độc lập:** Chạy đồng thời 3 Node backend worker trên 3 cổng khác nhau (`5001`, `5002`, `5003`). Mỗi node là 1 tiến trình Node.js riêng biệt có PID riêng.
2. **Cân bằng tải Round-Robin:** API Gateway phân phối đều các yêu cầu từ người dùng qua các Node đang hoạt động (Online).
3. **Giám sát nhịp tim (Heartbeat 1.5s):** Gateway liên tục thăm dò trạng thái `/api/health` của từng Node. Nếu Node không phản hồi hoặc bị sập, Gateway lập tức loại Node đó ra khỏi danh sách định tuyến.
4. **Chịu lỗi tức thì (Zero-Downtime Failover):** Khi một Node đang xử lý yêu cầu mà bất ngờ bị ngắt kết nối (crash/sập), Gateway ngay lập tức bắt lỗi mạng và chuyển tiếp nguyên vẹn request đó sang Node còn sống. **Người dùng không hề bị gián đoạn, không gặp màn hình lỗi!**
5. **Đồng bộ dữ liệu an toàn:** Kích hoạt chế độ `PRAGMA journal_mode = WAL;` và `PRAGMA busy_timeout = 10000;`, cho phép nhiều Node cùng đọc ghi đồng thời vào CSDL mà không bị khóa (locking).

---

## 🧪 Hướng dẫn Giảng viên Kiểm tra & Chấm điểm Phân tán

Giảng viên có thể kiểm tra tính năng chịu lỗi của cụm theo 2 cách:

### Cách 1: Thử nghiệm trực quan trên Giao diện Web (Khuyên dùng)
1. Mở web tại `http://localhost:5173/`.
2. Trên thanh menu, quan sát nhãn: **`🟢 Cụm phân tán: 3/3 Node`**.
3. Bấm vào nhãn này để mở **Bảng Giám Sát Cụm Phân Tán**.
4. Bấm nút **`[🔴 Mô phỏng Sập Node]`** tại **Node-1** (Port 5001). Trạng thái Node-1 chuyển sang màu đỏ `OFFLINE`.
5. Bấm nút **`[Gửi 5 Request Kiểm Tra Cân Bằng Tải]`** hoặc thực hiện tìm kiếm / đặt phòng:
   - Hệ thống vẫn trả về kết quả 200 OK bình thường.
   - Các request tự động được phục vụ bởi **Node-2** và **Node-3**.
   - Số lần chuyển đổi dự phòng (**Failovers**) tăng lên minh chứng tính năng hoạt động.
6. Bấm **`[🟢 Khôi phục Node]`** để kích hoạt lại Node-1. Cụm trở lại trạng thái `3/3 Node Online`.

### Cách 2: Tắt tiến trình thực tế bằng Terminal / Task Manager
- **Chạy toàn bộ cụm:**
  ```sh
  npm run dev
  ```
  *(Khởi chạy Gateway + 3 Node backend + Frontend)*
- Mở **Task Manager** trên Windows hoặc PowerShell:
  - Tra cứu PID của Node-1 (được hiển thị trên cửa sổ terminal hoặc bảng giám sát web).
  - Tắt Node-1 bằng lệnh:
    ```powershell
    Stop-Process -Id <PID_NODE1>
    ```
- Reload lại trang web hoặc thực hiện đặt phòng: **Trang web vẫn hoạt động bình thường nhờ Node-2 và Node-3!**

---

## 🚀 Các lệnh chạy dự án

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `npm run dev` | Khởi chạy toàn bộ hệ thống phân tán: Gateway (5000), Node 1 (5001), Node 2 (5002), Node 3 (5003) và Frontend Vite (5173) |
| `npm run cluster` | Chỉ chạy cụm backend phân tán (Gateway + 3 Node) |
| `npm run gateway` | Chỉ chạy riêng API Gateway (Port 5000) |
| `npm run node1` | Chạy riêng Node-1 (Port 5001) |
| `npm run node2` | Chạy riêng Node-2 (Port 5002) |
| `npm run node3` | Chạy riêng Node-3 (Port 5003) |
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
