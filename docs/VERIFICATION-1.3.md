# Lumio Web 1.3 / Android 0.2 — kết quả bàn giao

Kiểm tra ngày 27/09/2026. Đây là mã nguồn + bản Android debug, chưa cập nhật website Render và chưa phát hành cửa hàng.

## Phần đã thay đổi

- Web: tìm nhanh Ctrl/Cmd+K bằng cmdk, tiếng Việt không dấu, tìm trong tên/ghi chú/nội dung/không gian. Giữ bản nháp và trang hiện tại khi mở rồi hủy; chỉ điều hướng khi chọn kết quả.
- Motion mini 13.4.4: hiệu ứng mở palette ngắn, base UI luôn hiển thị; giảm chuyển động có hiệu lực ngay khi thay đổi. Bố cục được kiểm tra ở 375 px và desktop, theme sáng/tối, bàn phím.
- Flutter 0.2.0+2: flutter_animate 4.5.2 cho phản hồi/chuyển động ngắn; share_plus 13.3.0 cho nguồn, ghi chú, tóm tắt và thẻ đang chọn. Xem trước và sửa văn bản trước khi chọn app nhận; không tự gửi.
- Playwright CLI 0.1.21, SkillUI 1.3.4 đã cài theo project và chạy. Ponytail Review đã cài theo project và dùng để rà độ phức tạp.
- Helper Supabase MCP tạo mẫu chỉ đọc theo project, không tự kết nối hoặc migrate. Strix mới có phạm vi kiểm thử, chưa chạy. Bộ 37 skill Parker chưa tải do yêu cầu email/newsletter.

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Web logic/API | 209/209 đạt; database tạm và provider giả lập |
| Playwright CLI, Edge | 20/20 đạt; profile riêng, UI mẫu, không gọi AI trả phí |
| Next.js production build | Đạt compile, kiểm tra type và tạo trang |
| Flutter test | 28/28 đạt |
| Flutter analyze | Không phát hiện vấn đề |
| Android assembleDebug | Thành công, phiên bản 0.2.0 / versionCode 2 |
| APK | aapt xác nhận app ID, minSDK24; apksigner xác nhận chữ ký debug v2 |

Các log trong ZIP nằm ở `verification/`; ảnh và kết quả UI ở `web/docs/qa-command-*`. Ảnh Flutter là widget render thực tế trong test, không phải ảnh chụp điện thoại. Đã kiểm tra trực quan ảnh sáng/tối/mobile trước khi bàn giao.

APK: `Lumio-AI-Android-0.2.0-debug.apk`, 168,740,423 byte.

SHA256: `cd33d6a61f28a3bfe6047bd15e14caf2bd4a3b1854de71724ea0df95e7761407`.

## Giới hạn

Chưa có điện thoại thật/emulator gắn vào máy để kiểm tra menu chia sẻ hệ điều hành, microphone, Bluetooth hoặc hoạt động nền. iOS giữ scaffold, chưa build/ký IPA. APK debug dành cho thử nghiệm, không phải AAB release.

AI/giọng nói trực tuyến cần backend được cấu hình và tài khoản có quyền/credit. Thư viện vẫn lưu riêng theo thiết bị/tài khoản; ghép điện thoại không tự đồng bộ tài liệu. Không thêm DeepSeek hay nhà cung cấp mới. Giá gói thương mại/thanh toán thật chưa được bật.

Supabase chưa có project ref/OAuth; Strix chưa có Docker/inference để quét. Không tính kiểm thử hồi quy của Lumio là kết quả Strix hoặc tuyên bố không còn lỗ hổng.

Mở `README-MO-CODE.md` trong gốc ZIP để chạy web và mã `.dart`. Bản đầy đủ trên máy nằm tại `LUMIO-PLUGIN-MO-CODE.md` cạnh ZIP/APK. ZIP không kèm node_modules, SDK, cache build, `.env.local`, database, token hoặc khóa ký riêng.
