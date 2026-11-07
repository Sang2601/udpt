# CHAPTER 6 – SYNCHRONIZATION (ĐỒNG BỘ HÓA)

Trong giai đoạn hiện tại, mỗi service quản lý dữ liệu riêng biệt và không chia sẻ database với service khác. Việc này giúp tránh xung đột dữ liệu và đảm bảo tính nhất quán ở mức service.

Các cơ chế đồng bộ nâng cao như distributed lock sẽ được triển khai trong các service đặt phòng ở giai đoạn tiếp theo.