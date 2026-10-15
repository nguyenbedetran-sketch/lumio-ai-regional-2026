# Tương thích phiên gia sư máy chủ — 15/10/2026

Bản vá mã nguồn Flutter0.3, ưu tiên Android. Không tạo APK mới và không thay đổi dữ liệu thư viện hiện có.

## Thay đổi

- `LumioApi.study` gửi `tutorSessionId`/`guidance`; chat gửi lịch sử rỗng vì lịch sử đúng do máy chủ quản lý. Không gửi bộ đếm gợi ý hay quyền mở khóa giả.
- `ApiFailure` giữ bản trạng thái gia sư công khai đã kiểm tra kiểu khi có lỗi409/502; không giữ toàn bộ errorbody, khóa hoặc diagnostic riêng.
- Hai trang Hỏi Lumio/Giọng nói giữ cùng ID qua các lượt trong trang đang mở. Trạng thái lỗi đầu tiên vẫn có thể dùng lại ID khi thử tiếp. Phiên không tồn tại/nguồn đổi thì lần hỏi kế tiếp bắt đầu phiên mới.
- Số gợi ý, trạng thái cần bổ sung dữ kiện và nút Đối chiếu lời giải lấy từ máy chủ. UI không tăng bộ đếm theo tin nhắn. Máy chủ tiếp tục là nơi quyết định cuối cùng.
- Khóa ngữ cảnh gồm tài khoản/máy chủ, ID học liệu, nội dung nguồn và ngôn ngữ. Khi đổi ngữ cảnh, hủy yêu cầu cũ, bỏ trạng thái cũ và không nhận kết quả đến muộn. Bài mới xóa bộ nhớ trang; không xóa học liệu.
- Không tự đọc/thu âm/gọi AI khi nhận trạng thái. Tác vụ cần thao tác chủ động như trước.

## Giới hạn

ID gia sư chỉ giữ trong bộ nhớ trang; chưa lưu/khôi phục hội thoại sau khi đóng trang hoặc khởi động app. Hai trang chữ/giọng nói có phiên riêng, chưa chuyển tiếp cùng một phiên giữa hai trang. Lịch sử máy chủ có thời hạn riêng được giải thích trên web.

Đây không phải bằng chứng rằng APK cũ có chức năng mới. Chưa chạy trên điện thoại vật lý, chưa kiểm tra micro/loa thực hoặc OAuth trên thiết bị ở đợt này. Không dùng phản hồi giả thay kết quả AI trong sản phẩm; mock chỉ nằm trong test.

## Kiểm tra

Dùng Flutter SDK có sẵn trong workspace, Dart 3.13.4; không cài thêm plugin hoặc đổi khóa bí mật.

| Kiểm tra đã chạy | Kết quả | Bằng chứng |
|---|---|---|
| Phân tích Dart/Flutter toàn dự án | PASS — không có issue | `qa-regional-mobile-analyze.log` |
| Bộ kiểm thử Flutter toàn dự án | PASS — 50 kiểm tra | `qa-regional-mobile-all-tests.log` |
| Kiểm tra gia sư mới (chạy lại sau khi sửa font ảnh minh chứng) | PASS — 10 kiểm tra | `qa-regional-mobile-tutor-tests.log` |
| Xem ảnh widget có font thật | PASS — đã xem lại ảnh, tiến trình và nút mở rõ ở chiều rộng 430px | `qa-regional-mobile-tutor.png` |
| APK mới/thiết bị vật lý/micro/loa thật | NOT TESTED — không build hoặc chạy ở đợt này | Không tự nhận kết quả |

`test/tutor_session_test.dart` kiểm tra request có ID/guidance, lỗi khóa giữ trạng thái, schema bảo thủ, khóa do thiếu dữ kiện/hết hạn, ràng buộc ngữ cảnh, không tự tăng gợi ý, luồng ba gợi ý→mở lời giải trong widget thật, khôi phục lỗi, đổi nguồn/ngôn ngữ và bỏ kết quả đến muộn. Ảnh `qa-regional-mobile-tutor.png` là render widget430px với API bị chặn trong test, **không phải ảnh thiết bị thật hoặc phiên gọi API thật**.
