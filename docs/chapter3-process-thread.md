# CHAPTER 3 – PROCESS & THREAD MANAGEMENT (TIẾN TRÌNH & LUỒNG)

Mỗi microservice được triển khai bằng Spring Boot và chạy như một process độc lập.

- User Service chạy trên port 8081

- Auth Service chạy trên port 8080

Spring Boot sử dụng Tomcat Embedded Server để xử lý nhiều request đồng thời thông qua cơ chế đa luồng (multi-threading). Việc tách các service thành các process riêng giúp hệ thống tránh xung đột tài nguyên và tăng khả năng chịu tải.