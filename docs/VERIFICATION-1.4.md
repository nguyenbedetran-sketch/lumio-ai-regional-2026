# Lumio Web 1.4 / Android 0.3 — kết quả bàn giao 03/10/2026

Bản nâng cấp giao diện và tương tác học tập trên source hiện tại. Web và Android cùng dùng logo Lumio, màu kem/xanh rừng, điểm nhấn tím/lime. Không tuyên bố hoàn thành toàn bộ hơn 200 mục đặc tả hoặc đã phát hành bản production.

## Đã thêm

- Tổng quan web: bước học tiếp theo theo timer, thẻ đến hạn, mục tiêu hôm nay, kết quả quiz gần đây và học liệu vừa dùng; bản đồ học liệu có liên kết, vòng mục tiêu, chỉ số/nhịp học từ dữ liệu thật. Workspace mới hiện zero hoặc chưa có kết quả.
- Chuyển cảnh ngắn bằng Motion/WAAPI, thẻ lật 3D, phản hồi quiz và vòng kết quả. Web có Đầy đủ/Nhẹ/Tắt; Android có Tự động/Nhẹ nhàng/Đầy đủ. Cài đặt thiết bị giảm chuyển động luôn ưu tiên; không gọi AI, phát âm thanh hay thêm streak bằng animation.
- Thẻ và quiz hỗ trợ bàn phím, phản hồi bằng chữ và biểu tượng, xem lại đáp án. Quiz chụp snapshot câu hỏi; giữ nháp và lượt đang làm khi chuyển tab của cùng tài liệu; chặn ghi nhận lặp khi thao tác nhanh.
- Đọc thoải mái: cỡ chữ/giãn dòng lưu riêng trên trình duyệt; nếu lưu bị chặn, giao diện nói rõ tùy chọn chỉ dùng trong phiên hiện tại. Nháp chưa lưu không tồn tại sau khi đóng tài liệu/tải lại.
- Android: giữ tìm kiếm/bộ lọc/cuộn khi đổi tab; tìm tiếng Việt không dấu; lọc/sắp xếp; Studio mới và vòng focus theo deadline thật. Không có chuông nền bảo đảm khi khóa màn hình.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| Logic và hồi quy web | 238/238 đạt; database tạm và provider giả lập, không gọi AI trả phí |
| TypeScript | `tsc --noEmit` đạt; Next build cũng kiểm tra type trên source cuối |
| Tìm nhanh, focus, nháp, sáng/tối, phone và reduced motion | 20/20 kiểm tra UI đạt |
| Luồng học, quiz, motion lưu/OS override/storage failure | 25/25 kiểm tra UI đạt |
| Dữ liệu và bố cục dashboard | 29/29 kiểm tra UI đạt |
| Tổng kiểm tra trình duyệt | 74/74 đạt, Playwright CLI 0.1.21 + Edge, profile khách riêng |
| Next.js production build | Compile, type và tạo trang thành công |
| Flutter tests | 40/40 đạt, gồm motion, legacy settings, state, dữ liệu và bố cục |
| Flutter analyze | Không phát hiện vấn đề |
| Android build | APK debug 0.3.0 / versionCode3 thành công |
| Manifest và chữ ký | aapt xác nhận appID/minSDK24/target36; apksigner xác nhận chữ ký debug v2 |

Web có ảnh 1440px, dark mode, phone375px, kiểm tra dashboard325/375/768px và5 ngôn ngữ. Flutter thử bố cục360px/cỡ chữ130%, sáng/tối; ảnh native được render từ widget thật với nội dung ví dụ được ghi nhãn, không phải ảnh chụp điện thoại.

Log trong ZIP ở `verification/`; browser report/ảnh ở `web/docs/qa-*`; report logic, scope và hướng dẫn trong `web/docs`. Có thể chạy lại `pnpm test`, `pnpm test:ui`, `pnpm test:ux`, `pnpm test:dashboard`, `pnpm build`, `flutter analyze`, `flutter test` và `flutter build apk --debug`.

APK: **Lumio-AI-Android-0.3.0-debug.apk**, **168,774,375 bytes**.

SHA256: `5f4b44e6f31e4f961bbfb4e255904d538398dbece6b12ceb4a9b1fdee8ad8c3f`.

## Phạm vi và giới hạn

Không có điện thoại/emulator kết nối ADB. Menu chia sẻ hệ điều hành, microphone/loa/Bluetooth, secure storage và hoạt động nền cần thử trên điện thoại thật. iOS giữ code nhưng chưa build/ký IPA. APK debug chưa là bản Google Play/AAB release.

Các kiểm tra mới không gọi mạng AI trả phí hay checkout. AI/giọng nói trực tuyến vẫn cần backend cấu hình và tài khoản đủ credit/quyền; giọng nói theo lượt, chưa realtime voice. Dữ liệu học lưu riêng theo trình duyệt/thiết bị/tài khoản; pairing không tự đồng bộ toàn bộ thư viện. Giá thương mại và thanh toán thật chưa bật. Không có DeepSeek; người học chỉ nhìn tên Lumio.

Playwright CLI, Motion, cmdk, Flutter Animate và Share Plus đã có trong lockfile/source; không thêm dịch vụ trả phí mới. Supabase MCP chưa có project/OAuth để kết nối; Strix chưa chạy, bộ skill yêu cầu email/newsletter chưa được tải. Không coi kiểm thử này là quét Strix hoặc chứng nhận hết lỗ hổng.

ZIP được tạo từ source cuối, bỏ node_modules, SDK, cache build, env riêng, database, token và khóa ký. Bộ đóng gói kiểm tra CRC, hash từng source, chuỗi credential được cấu hình trong source/APK; kết quả cuối ở `LUMIO-1.4-SHA256.txt` cạnh artifact. Không kèm API keys; cấu hình private trên máy gốc giữ riêng.

Website Render và tài khoản cửa hàng chưa được cập nhật trong lượt này. Mở `README-MO-CODE.md` trong ZIP để chạy web và Dart; bản hướng dẫn cạnh artifact là `LUMIO-1.4-MO-CODE.md`.
