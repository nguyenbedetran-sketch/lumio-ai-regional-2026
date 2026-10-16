# Thông báo nơi lưu dữ liệu

Phạm vi: trạng thái công khai và nội dung giải thích; không thay đổi cơ sở dữ liệu, quyền tài khoản, thời hạn lưu hoặc kết nối dịch vụ AI.

- `/api/config` chỉ trả `storage: {mode: "local-sqlite" | "remote-libsql", ready: true}` sau khi `getStore()` mở xong và `databaseAvailable()` còn cho phép sử dụng. Không trả URL, thông tin xác thực hoặc cấu hình nội bộ. Lỗi mở, kết nối đã bị vô hiệu hóa hoặc chế độ không hợp lệ trả lỗi 503 an toàn.
- `ready` là trạng thái kết nối đã mở và chưa bị vô hiệu hóa tại lúc đọc. Đây không phải phép đo mạng mới, chứng nhận lưu bền vững, kiểm tra bản sao lưu hay cam kết SLA.
- Thông báo bản dự thi nhận trạng thái từ API. Chế độ từ xa có câu ngắn riêng trong cả năm ngôn ngữ; nội dung mở rộng phân biệt máy chạy web với database riêng và học liệu lưu trong trình duyệt. Hosting miễn phí vẫn có thể ngủ. Chọn database riêng không tự gửi dữ liệu tới AI.
- Chế độ cục bộ hoặc chưa có trạng thái giữ nguyên thông báo trước đó. Bản desktop và public demo giữ đường trả cấu hình riêng, không bị buộc mở database máy chủ.
- Trang riêng tư chỉ đọc lựa chọn `LUMIO_DATABASE_MODE`, mặc định cục bộ và xử lý riêng cấu hình không hợp lệ. Trang không mở database, không đọc URL/token và luôn nói rõ đây là mô tả cấu hình, không phải xác nhận kết nối. Những mốc 7 ngày, metadata 31 ngày và dữ liệu lớp/giáo viên không có TTL vẫn giữ nguyên.

## Kiểm tra

`node tests/v9-storage-status.cjs`: **18 PASS**. Báo cáo: [qa-storage-status.json](qa-storage-status.json).

Phép kiểm tra chạy helper thuần, route `/api/config` thực tế với ranh giới store/auth/features giả lập và static SSR của component React thật. Bao gồm chế độ cục bộ/từ xa, AI tắt, lỗi mở, kết nối bị vô hiệu hóa, cấu hình không hợp lệ, nhánh desktop/demo, năm ngôn ngữ và trang riêng tư không mở database. Không gọi mạng/database từ xa/provider; chưa phải kiểm chứng triển khai, lưu bền vững hay thiết bị thật.
