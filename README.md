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

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### Yêu cầu môi trường
- **Node.js**: >= 18.x
- **npm**: >= 9.x

### Các bước khởi chạy:

1. **Cài đặt thư viện dependencies:**
```sh
npm install
```

2. **Khởi chạy đồng thời cả Frontend và Backend API:**
```sh
npm run dev
```
- **Frontend (Vite):** `http://localhost:5173/`
- **Backend API (Express):** `http://localhost:5000/api`

3. **Biên dịch sản phẩm (Production Build):**
```sh
npm run build
```

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
