# V7 — client Dart và mã chống trùng yêu cầu AI

Trạng thái: **PARTIAL, mã nguồn và kiểm thử tự động**. Client native sử dụng hợp đồng web hiện có cho `POST /api/ai` và `POST /api/voice`: bearer phiên thiết bị, `X-Lumio-User` lấy từ `MobileSession.id` chuẩn và `Idempotency-Key` UUIDv4. Không đưa API key của provider vào Dart. Không đổi provider, database hoặc thư viện phụ thuộc.

## Cách hoạt động

`AppStore.api` gắn tài khoản hiện tại vào từng API instance và dùng chung registry có `FlutterSecureStorage` đã có. Registry tách theo origin/tài khoản; lưu duy nhất SHA-256 của nội dung yêu cầu, UUID và thời gian. Không lưu raw câu hỏi, tài liệu, file ghi âm, đầu ra AI hoặc bản sao token trong registry này. Token phiên vẫn nằm trong vùng secure-storage phiên hiện có. Hash không được gọi là dữ liệu ẩn danh tuyệt đối hoặc mã hóa nội dung.

Registry ghi thành công **trước transport**. Read/write lỗi hoặc metadata hỏng làm yêu cầu dừng; không âm thầm bỏ bảo vệ rồi gửi AI. Các API instance cùng isolate dùng khóa tuần tự khi cập nhật registry. Cùng intent đang gửi bị chặn tại client; máy chủ vẫn là nơi quyết định quyền, receipt, quota và credit.

Mất mạng, JSON chưa đọc đủ hoặc audio sai MIME giữ nguyên mã để lần người dùng chủ động thử lại không tạo mã mới. Audio transcription dùng bytes có giới hạn 8 MiB, hash và filename/language/MIME; không dùng multipart boundary ngẫu nhiên. Bytes thực gửi lấy từ chính bộ dữ liệu đã hash. TTS chỉ xác nhận sau nhận đủ bytes với MIME audio, không chứng minh file phát ra loa.

Một response đã nhận đầy đủ và đọc được là ACK: success hoặc lỗi JSON xác định dưới HTTP 500 giải phóng intent. Mọi HTTP 5xx vẫn giữ mã vì gateway có thể trả JSON lỗi sau khi origin đã hoàn tất và trừ credit. Lần thử lại do người dùng chủ động dùng đúng UUID cũ; `AI_REQUEST_FAILED` xác nhận thất bại để giải phóng mã, còn `AI_REQUEST_COMPLETED` giữ mã và không chạy AI lần nữa. Các mã `AI_REQUEST_IN_PROGRESS`, `AI_REQUEST_CONFLICT`, `AI_REQUEST_UNSETTLED` cũng tiếp tục giữ mã cũ. Không có tự retry hoặc tự cấp UUID mới khi gặp những trạng thái chưa chắc chắn. Nếu metadata không xóa được sau ACK thành công, intent cũ được giữ theo hướng an toàn thay vì cho phép duplicate không có bản ghi.

Tối đa 64 intent chưa xác nhận trên mỗi origin/tài khoản. Không tự đẩy bản cũ ra để tạo chỗ cho lượt có thể tốn phí. Intent quá bảy ngày bị dừng bằng thông báo quá hạn; khác với việc tự quên rồi phát sinh UUID mới. Core API `clearUncertainPaidRequests()` là thao tác tạo ý định mới có chủ đích, cần thông báo rằng có thể tốn credit; không được gọi tự động. Chưa có trang quản lý toàn bộ receipt/reset trong giao diện native.

API instance không đổi sang canonical user khác. AppStore kiểm lại tài khoản/token/expiry trước khi gửi và sau response; phản hồi tới muộn của tài khoản trước bị từ chối. Chức năng này không tự xác thực quyền sở hữu bearer ở client; máy chủ vẫn kiểm tài khoản/phiên thật. Đổi thiết bị hoặc process độc lập không dùng chung secure storage không được xem là có chung client lock.

## Kiểm thử và minh chứng

Đã dùng Flutter SDK sẵn có, `flutter pub get --enforce-lockfile`; không thêm package hoặc đổi `pubspec.lock`. Từ `apps/lumio-mobile`:

```powershell
flutter analyze --no-pub
flutter test --no-pub --machine
```

Report kết quả cuối: `docs/v7/reports/native-compatibility.json`, log `mobile-analyze.log` và `mobile-tests.jsonl`. Bộ mới gồm 21 case về canonical headers, UUIDv4, same-intent concurrency, lost ACK, gateway JSON 5xx sau settlement giả lập, nhiều API/registry instance, lỗi metadata, giới hạn, hết hạn, scope, multipart/TTS, response tài khoản cũ và lời nhắc về credit. Toàn bộ bộ test native hiện có được chạy cùng, không chỉ bộ mới.

HTTP và secure storage trong test là fixture; một số test dùng file tạm thật. Không có request provider, bearer/OAuth production, kết nối backend thật, thiết bị vật lý, microphone/speaker, APK/IPA hoặc phát hành store. Không biến số case thành tỷ lệ chính xác AI.

Test font helper tìm cache SDK từ `flutter_tester`/`FLUTTER_ROOT`, không dựa đường dẫn tương đối của checkout cũ. Khi thiếu font, capture dừng thay vì xuất Ahem rồi gọi là ảnh UI hoàn chỉnh. Screenshot mới đặt riêng ở `docs/v7/evidence/native`; ảnh tutor có nhãn `QA FIXTURE`. Ảnh lịch sử3.2 đã được giữ nguyên. Đây là render Flutter widget, không phải ảnh điện thoại thật.

## Giới hạn cần giữ trong bàn giao

- Không replay/khôi phục đầu ra đã mất khi máy chủ báo completed. Message giải thích rõ lượt mới có thể tốn credit; chưa có màn hình phục hồi toàn bộ kết quả.
- Registry tồn tại qua API instance và được ghi vào secure storage, nhưng phần bền vững trên Android/iOS thật chưa được kiểm thiết bị. Mô phỏng restart ở test tạo registry mới đọc cùng storage fixture.
- Free host có thể reset SQLite/receipt; metadata client không biến máy chủ miễn phí thành hệ thống bền vững hoặc bảo đảm dedupe vô hạn.
- Đồng bộ web snapshot/native library vẫn giữ phạm vi trước; không nhân thay đổi request adapter thành full native classroom/sync.
- Source Flutter vẫn phiên bản `0.4.0+4` trong subproject hiện có; chưa build binary mới. Root quản lý phiên bản release web, triển khai và bằng chứng public riêng.
