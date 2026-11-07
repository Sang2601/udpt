# CHAPTER 5 – IDENTIFICATION & AUTHENTICATION (ĐỊNH DANH & XÁC THỰC)

## Hệ thống sử dụng JWT (JSON Web Token) để thực hiện xác thực người dùng.

Quy trình đăng nhập:

1. Người dùng gửi email và mật khẩu đến Auth Service

2. Auth Service gọi User Service để lấy thông tin người dùng

3. Nếu thông tin hợp lệ, Auth Service sinh JWT token

4. Token chứa thông tin email, role và thời gian hết hạn

JWT token là nền tảng cho việc phân quyền và bảo vệ các API trong hệ thống.