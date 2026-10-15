# Kết nối app Android với Lumio

Mã Flutter nằm trong `lumio-mobile` khi làm việc trên máy hiện tại, hoặc `mobile` trong gói source chung. Backend vẫn là dự án Next.js này. App lưu tài liệu riêng trên thiết bị; kết nối tài khoản **chưa đồng bộ thư viện**.

## Thử trên Android bằng cáp USB

1. Chạy web bằng `pnpm dev`, mở `http://localhost:3000` trên máy tính và đăng nhập Google/Facebook.
2. Cắm điện thoại, bật Developer options → USB debugging và xác nhận máy tính trên điện thoại. Chạy `adb devices` để kiểm tra thiết bị.
3. Chạy `adb reverse tcp:3000 tcp:3000`. Lệnh này chuyển cổng localhost của điện thoại về web đang chạy trên máy tính, không công khai web ra Internet.
4. Chạy app bằng `flutter run` hoặc cài APK debug được bàn giao. Trong Cài đặt, nhập server `http://127.0.0.1:3000`. HTTP chỉ dùng cho bản debug và địa chỉ loopback; bản release yêu cầu HTTPS.
5. Trên máy tính mở `http://localhost:3000/mobile`. Bấm **Tạo mã kết nối 5 phút**, chép mã vào phần kết nối tài khoản của app Android rồi xác nhận. Chỉ nhập mã vào app Lumio của bạn, không đưa mã lên hồ sơ dự thi hay ảnh công khai.
6. App dùng cùng tài khoản và ví credit. Thu hồi từng thiết bị ở `/mobile`, hoặc dùng **Thu hồi và ngắt kết nối** trong app khi có mạng. **Gỡ kết nối ngoại tuyến** chỉ xóa token trên điện thoại; phiên trên máy chủ vẫn còn hiệu lực tới khi hết hạn hoặc được thu hồi trên web. Mã cấp phiên chỉ dùng một lần; phiên điện thoại có hạn 7 ngày. Nếu đổi server, phải kết nối lại.

Nếu web yêu cầu đăng nhập lại, đó là bước kiểm tra phiên OAuth mới trong vòng một giờ trước khi cấp quyền điện thoại. Tối đa 5 thiết bị còn hiệu lực mỗi tài khoản. Tài khoản bị khóa hoặc thu hồi tất cả phiên trong admin cũng mất quyền trên điện thoại.

## Android Emulator

Chạy emulator rồi vẫn dùng `adb reverse tcp:3000 tcp:3000` và `http://127.0.0.1:3000`. Cách này giữ nguyên bộ lọc Host an toàn của web. Không đổi backend thành nhận mọi Host để bỏ qua lỗi kết nối. Khi có nhiều thiết bị, thêm `adb -s DEVICE_ID reverse tcp:3000 tcp:3000`.

## Máy chủ HTTPS

Điền URL HTTPS của **bản backend có bật đăng nhập và AI**. OAuth phải có callback đúng URL; backend cần database bền vững và `NEXTAUTH_URL` là URL HTTPS chuẩn. Không dùng địa chỉ Render demo hiện tại để kỳ vọng AI hoạt động: demo công khai chặn mọi route tài khoản, mobile và AI.

Các giới hạn gói vẫn được máy chủ áp dụng. Có khóa AI hoặc ghép nối thành công không tự cấp gói có quyền giọng nói. Trong môi trường development (`pnpm dev`), admin có quyền phù hợp có thể cấp gói sandbox và credit để thử từ trang Gói & credit; đó không phải thanh toán thật. Không nhét API key vào `.dart`, APK hoặc tham số `--dart-define`.

## Hợp đồng HTTP

- `POST /api/mobile/devices`: cookie web hợp lệ + Origin cùng website + OAuth gần đây. Trả `{code,expiresAt}`; code 256-bit, 5 phút, hash lưu ở máy chủ. Mã mới vô hiệu mã cũ.
- `POST /api/mobile/pair/exchange`: JSON `{code,deviceName}` từ native; trả `{accessToken,expiresAt,user:{id,name,email}}`. Không chấp nhận Cookie/Origin/browser fetch metadata. Đổi mã và ghi session nằm trong cùng giao dịch SQLite.
- `GET /api/mobile/account`: `Authorization: Bearer ACCESS_TOKEN`; trả `user`, `expiresAt`, `capabilities`, `credits`. Không trả OAuth token hay khóa AI.
- `DELETE /api/mobile/account`: thu hồi phiên đang dùng.
- `GET /api/mobile/devices`: xem thiết bị của người đăng nhập web; `DELETE` với JSON `{id}` thu hồi thiết bị thuộc chính tài khoản.
- `/api/ai` và `/api/voice`: dùng chính route của web, thêm Bearer; cùng kiểm tra trạng thái tài khoản, gói, credit, giới hạn tốc độ và ghi nhận sử dụng. Credit đang giữ được hoàn khi máy chủ xử lý lỗi hoặc nhận hủy trước khi quyết toán; các bước đã hoàn tất vẫn được tính credit. Không có endpoint AI riêng bỏ qua ví.

Token ngẫu nhiên 256-bit, hash SHA-256 trong SQLite; app lưu token bằng secure storage của hệ điều hành. Không có refresh token trong bản này: hết hạn thì ghép lại. Giới hạn 15 thao tác AI/phút, 150/ngày và một yêu cầu đồng thời cho cả web + app; một lượt giọng nói gồm tối đa ba thao tác.

## Phạm vi vận hành

Backend SQLite dành cho một máy chủ. Rate limit hiện ở bộ nhớ tiến trình; triển khai nhiều instance cần limiter dùng chung. Quyền dùng AI thực tế còn phụ thuộc nhà cung cấp, số dư API và credit tài khoản. Android/iOS không thanh toán trực tiếp và chưa có Google Play Billing/Apple IAP.
