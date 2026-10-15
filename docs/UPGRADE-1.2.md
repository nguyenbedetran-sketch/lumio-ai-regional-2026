# Lumio 1.2 preview — web và Android

Đây là bản nâng cấp mã nguồn có công cụ học chạy được và nền tảng tích hợp. Không gọi bản này là đã hoàn tất mọi mục trong master prompt hoặc sẵn sàng thu tiền đại trà.

## Thay đổi web

- Phòng giọng nói riêng: thu âm cục bộ, tải tệp, xem/sửa bản chép lời, hỏi gia sư theo lượt, tạo bản đọc. Chọn ngôn ngữ/giọng, nghe/dừng, tốc độ nghe, tải audio và hội thoại. Xin quyền mic khi người dùng bấm; đóng màn hình dừng stream và hủy tác vụ.
- Tác vụ trực tuyến yêu cầu đăng nhập và quyền gói. Credit được kiểm tra ở backend; credit đang giữ được hoàn khi máy chủ nhận hủy trước khi quyết toán. Các bước đã hoàn tất vẫn được tính credit; chi phí nhà cung cấp có thể vẫn phát sinh nếu họ đã xử lý trước lúc nhận hủy.
- Chuyển động mới cho bảng tổng quan, mục tiêu, Studio, loading và trang điện thoại; hover dành cho chuột, hỗ trợ giảm chuyển động. Studio trả focus về nút mở khi đóng bằng Escape.
- Trang `/mobile` để ghép Android, xem và thu hồi phiên; phiên mobile dùng cùng phân quyền và credit với web.
- Giữ nguyên công cụ học trước đó: tài liệu, ghi chú, Toán/KaTeX, tóm tắt/bản đồ kiến thức, flashcards, quiz, mục tiêu, streak, tập trung, đề xuất cục bộ, admin và ví credit.

## Mã Flutter

Thư mục mobile có mã Dart và cấu trúc Android/iOS. Android là nền tảng kiểm tra trước; iOS cần macOS/Xcode và kiểm tra riêng. Các công cụ ngoại tuyến không cần API key. AI/giọng nói dùng backend Lumio đã cấu hình, token thiết bị nằm trong secure storage.

Xem README của app để biết chính xác các màn hình native đã có và cách build; xem [MOBILE-CONNECTION.md](MOBILE-CONNECTION.md) để ghép tài khoản. Thiết kế mobile không phải một WebView bọc website.

## Những phần còn cần làm trước phát hành thương mại

- Đồng bộ học liệu đa thiết bị, upload/lưu trữ cloud, hàng đợi xử lý video dài; hiện một yêu cầu video tối đa 30 phút.
- Voice realtime hai chiều, podcast nhiều người nói và phát sinh video AI. Bản mới là hội thoại có từng lượt rõ ràng.
- Giá chính thức, cổng thanh toán, webhook, hóa đơn/hoàn tiền và Google Play Billing/Apple IAP. Các gói trả phí chưa mở checkout.
- OAuth public review theo cấu hình thật; hạ tầng database/lưu tệp bền vững, backup, rate limit chia sẻ nếu chạy nhiều máy chủ.
- Kiểm tra trên điện thoại thật: quyền mic, tai nghe/Bluetooth, âm thanh khi khóa máy, hiệu năng, accessibility và chất lượng giọng tiếng Việt. Mock test không xác minh được chất lượng dịch vụ thực.
- Ký release, chính sách dữ liệu, tài khoản nhà phát triển và xét duyệt trước khi lên Google Play/App Store.

Mô hình đề xuất cục bộ ở web chỉ huấn luyện khi đủ phản hồi, không có nghiên cứu chứng minh hiệu quả học tập thực tế. Không có DeepSeek trong router.

## Nguồn mở

Web dùng CSS/WAAPI sẵn có và thư viện hiện hữu; app chọn các package Flutter chuyên cho HTTP, lưu trữ an toàn, ghi/phát âm thanh và đọc tệp. Danh sách nguồn, phiên bản và giấy phép nằm trong [OPEN-SOURCE.md](OPEN-SOURCE.md) và tài liệu mobile; lockfile đi kèm source.
