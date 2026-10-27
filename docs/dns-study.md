# Hướng Dẫn Thực Hành Nghiên Cứu Hệ Thống Phân Giải Tên Miền (DNS)
## Chuyên Đề Bài 4: Định Danh Trong Hệ Phân Tán

> **Lưu ý quan trọng dành cho sinh viên:** 
> Tài liệu này cung cấp cơ sở lý thuyết, các lệnh quan sát thực nghiệm và bảng mẫu để người học **tự thực hiện quan sát thực tế trên máy tính cá nhân**, ghi lại kết quả và tự đưa ra nhận xét khoa học. Tuyệt đối không sao chép nguyên văn câu trả lời tạo sẵn từ AI.

---

### 1. Cơ Sở Lý Thuyết & Nguồn Tài Liệu Chính Thức

Hệ thống tên miền (Domain Name System - DNS) là một trong những hệ phân tán quy mô toàn cầu thành công nhất trong lịch sử máy tính.
- **RFC 1034:** *Domain Names - Concepts and Facilities* (P. Mockapetris, 1987) – Mô tả kiến trúc tổng thể, không gian tên dạng cây phân cấp (Hierarchical Tree) và mô hình phân quyền quản lý (Delegation).
- **RFC 1035:** *Domain Names - Implementation and Specification* (P. Mockapetris, 1987) – Đặc tả cấu trúc gói tin DNS (Header 12 byte, Question, Answer, Authority, Additional), các loại bản ghi tài nguyên (Resource Records - RR) và cơ chế bộ đệm (Caching/TTL).

#### Ba Thành Phần Chính:
1. **Không gian tên miền (Domain Name Space):** Cấu trúc cây có gốc (Root `.`), các miền cấp cao nhất (Top-Level Domain - TLD như `.vn`, `.com`, `.edu`), miền cấp hai (SLD như `phenikaa-uni.edu.vn`) và các miền con (Subdomains).
2. **Máy chủ tên miền (Name Servers):**
   - **Root Name Servers:** 13 cụm máy chủ gốc toàn cầu (từ A đến M).
   - **TLD Servers:** Quản lý các đuôi miền (`.com`, `.net`, `.vn`).
   - **Authoritative Name Servers (Máy chủ có thẩm quyền):** Giữ bản ghi chính thức của từng tổ chức.
3. **Bộ phân giải tên (Resolvers):** Phía client gửi yêu cầu đệ quy (Recursive Query) hoặc lặp (Iterative Query) để tìm kiếm địa chỉ IP từ tên miền.

---

### 2. Các Lệnh Thực Hành Quan Sát Dành Cho Người Học

Người học mở **Command Prompt (CMD)** hoặc **PowerShell** trên Windows để thực thi lần lượt các lệnh sau:

#### Thao tác 1: Quan sát phân giải tên miền mặc định với `nslookup`
```bash
nslookup phenikaa-uni.edu.vn
```
- **Mục tiêu quan sát:** Server DNS mặc định mà máy tính bạn đang dùng là gì? Địa chỉ IP trả về của trường Đại học Phenikaa là gì? Kết quả có kèm dòng chữ `Non-authoritative answer` không?

#### Thao tác 2: Truy vấn trực tiếp tới một DNS Server công cộng (Google DNS `8.8.8.8` hoặc Cloudflare DNS `1.1.1.1`)
```bash
nslookup phenikaa-uni.edu.vn 8.8.8.8
```
- **Mục tiêu quan sát:** So sánh kết quả và thời gian phản hồi giữa DNS nhà mạng cục bộ và Google Public DNS.

#### Thao tác 3: Tra cứu các loại bản ghi tài nguyên (Resource Record Types)
1. **Bản ghi Mail Server (MX):**
   ```bash
   nslookup -type=MX phenikaa-uni.edu.vn
   ```
2. **Bản ghi Name Server (NS):**
   ```bash
   nslookup -type=NS phenikaa-uni.edu.vn
   ```
3. **Bản ghi CNAME (Tên bí danh):**
   ```bash
   nslookup -type=CNAME www.phenikaa-uni.edu.vn
   ```

#### Thao tác 4: Quan sát bộ nhớ đệm DNS cục bộ (Local DNS Cache & TTL)
1. Hiển thị danh sách các bản ghi đang được lưu đệm trên máy tính:
   ```bash
   ipconfig /displaydns
   ```
2. Xóa sạch bộ nhớ đệm DNS cục bộ (Flush DNS):
   ```bash
   ipconfig /flushdns
   ```
3. Truy vấn lại và quan sát thời gian sống (TTL - Time to Live) của bản ghi giảm dần theo từng giây.

---

### 3. Bảng Mẫu Ghi Nhận Kết Quả Thực Nghiệm Dành Cho Sinh Viên

*(Sinh viên hãy điền kết quả quan sát thực tế từ màn hình terminal của mình vào bảng dưới đây)*

| Bước Thử Nghiệm | Lệnh Thực Hiện | Kết Quả Thực Tế Thu Được | Giải Thích Bản Chất Theo Lý Thuyết Bài 4 |
| :--- | :--- | :--- | :--- |
| **1. Tra cứu A record** | `nslookup phenikaa-uni.edu.vn` | *(Điền Server IP và Address IP)* | Ánh xạ Tên (Name) sang Điểm truy cập/Địa chỉ (Address) dạng phẳng. |
| **2. Tra cứu MX record** | `nslookup -type=MX phenikaa-uni.edu.vn` | *(Điền danh sách Mail Exchanger)* | Định danh dịch vụ thư điện tử của tổ chức. |
| **3. Tra cứu NS record** | `nslookup -type=NS phenikaa-uni.edu.vn` | *(Điền các Name Server có thẩm quyền)* | Xác định máy chủ Authoritative chịu trách nhiệm quản lý zone. |
| **4. Kiểm tra Cache & TTL** | `ipconfig /displaydns` | *(Điền tên bản ghi và số giây TTL)* | Cơ chế Caching giúp giảm tải cho Name Server gốc và giảm độ trễ truy cập. |

---

### 4. Câu Hỏi Phân Tích & Nhận Xét Chuyên Sâu

1. **Vì sao DNS không dùng một máy chủ tập trung duy nhất trên toàn thế giới?**
   - *Gợi ý phân tích:* Phân tích theo 3 chiều co giãn (Số lượng, Địa lý, Tổ chức) của Bài 1. Điểm nghẽn băng thông, nguy cơ Single Point of Failure (SPOF) và chủ quyền quản trị mạng.
2. **Tại sao truy vấn DNS thông thường lại sử dụng giao thức UDP cổng 53 thay vì TCP? Khi nào DNS bắt buộc phải dùng TCP?**
   - *Gợi ý phân tích:* Đối chiếu với Bài 3. Chi phí bắt tay 3 bước của TCP so với datagram không kết nối, nhẹ của UDP. Trường hợp kích thước phản hồi vượt quá 512 byte (EDNS0) hoặc Zone Transfer (AXFR) giữa các Name Server.
3. **Mối quan hệ giữa Docker DNS trong hệ phân tán và DNS Internet:**
   - Docker DNS là một resolver nội bộ nhúng trong Docker Engine, phân giải `service_name` (như `hotel-service`) thành IP container trong bridge network. Nó không sử dụng bảng băm phân tán DHT (Chord) mà dựa trên cơ chế tra cứu cục bộ của daemon.
