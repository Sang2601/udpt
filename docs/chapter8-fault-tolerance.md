# CHAPTER 8 – FAULT TOLERANCE & MONITORING (CHỊU LỖI & GIÁM SÁT)

Hệ thống được thiết kế theo hướng chịu lỗi cơ bản:

- Các service khởi động độc lập

- Lỗi kết nối giữa các service được ghi log rõ ràng

- Service vẫn hoạt động bình thường khi service khác gặp lỗi

Hệ thống đã được kiểm thử thành công trên GitHub Codespaces, chứng minh khả năng triển khai trên môi trường cloud.