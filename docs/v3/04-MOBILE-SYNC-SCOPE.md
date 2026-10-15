# V3 — Bản đồng bộ Web trong Flutter, source-only

Ngày 15/10/2026. Trạng thái triển khai phạm vi nhỏ: **PASS** theo test source; mục tiêu đồng bộ toàn bộ trải nghiệm học native: **PARTIAL**.

Trong Cài đặt → Dữ liệu của bạn có thẻ **Bản đồng bộ Web**. Ghép token thiết bị Lumio, đồng ý phạm vi và bấm nhận/đồng bộ. Bản web có kho JSON riêng theo origin/canonical user, xem danh sách/metadata và chỉ sửa notes. Có xuất/nhập đúng snapshot web, file outbox, chống gửi trùng, đối chiếu ba phía, conflict/epoch reset và xóa bản server. Thư viện `LibraryData` native cũ không bị chuyển đổi hoặc thay thế.

## Vì sao giữ riêng?

Web dùng `{library, learning, preferences}`; native dùng `LibraryData` có `source`, summary chuỗi và lịch ôn trong card. Nếu đổi qua model cũ sẽ làm mất không gian, artifact, citation, nhãn độ khó/chủ đề, từng đáp án và skillEvidence. Pha này giữ raw web JSON thay vì giả định hai schema version1 là cùng định dạng. Metadata được giữ cục bộ không phải là badge xác minh nguồn; server vẫn kiểm tra schema/quyền và có thể loại trường chưa hỗ trợ/vị trí chưa xác minh.

## Cơ chế và quyền riêng tư

- Bearer là token Lumio ở secure storage, không phải API key nhà cung cấp. Mỗi request sync có `X-Lumio-User` đúng canonical ID, chỉ tới origin đã ghép, không theo redirect.
- DTO web tối đa2MiB/100 học liệu, không dùng binary/file gốc hoặc timer đang chạy. Không tự lấy dữ liệu thư viện native để upload.
- Cursor/base/pending ở tệp `web-sync-<hash(origin::userId)>.json`, ghi flush và `.bak` hợp lệ; nội dung học không được mã hóa ở cấp app. Tệp không chứa token/provider key. File lỗi không âm thầm thành kho rỗng.
- Pending ID/body được lưu trước PUT; mất ACK thì thử lại cùng request, không tự tạo giao dịch khác. Nháp sửa sau lỗi vẫn được giữ. Không tự gọi AI trong sync.
- Conflict dừng để chọn; dùng base đã biết để hiểu deletion, không lấy đồng hồ thiết bị làm luật ghi đè. Epoch reset không tự hồi sinh bản cũ. Xóa server giữ local/native, bỏ pending/cursor cũ và tắt gửi tiếp.
- Controller kiểm tra scope và token generation sau await; đổi account/logout/re-pair không apply response cũ vào tài khoản mới. Không có tự upload khi mở card.
- Bản server tối đa7ngày, free host có thể reset sớm hơn. Tắt sync không xóa bản server. Nội dung đã xuất ra tệp hoặc ở thiết bị khác cần xử lý riêng.

## Bằng chứng đã chạy

`flutter analyze --no-pub`: **0 issues**. Toàn bộ `flutter test --no-pub`: **71/71 PASS**, gồm50test cũ +19test core/API/file +2widget test mới. Chi tiết máy đọc: [mobile-sync-evaluation.json](mobile-sync-evaluation.json).

Test mới bao phủ metadata/notes-only, giới hạn/dữ liệu cũ, three-way merge/deletion, opt-in, pending trước PUT, replay mất ACK/restart, nháp sau lost ACK, conflict/epoch, generation/account isolation, CAS delete, storage lỗi, canonical headers/redirect và backup. Widget kiểm tra scope/retention ở390px và restored server lỗi không crash/hiện token.

Đây là fixture, file tạm riêng và HTTP mock; **không thay backend integration/OAuth/ghép thiết bị thật**. Không có provider call hoặc học sinh thật. Android/iPhone/hardware/export file picker trên thiết bị: **NOT TESTED**. Không build APK/IPA mới và không dùng test widget làm ảnh chụp điện thoại.

## File thay đổi

Trong `outputs/lumio-mobile`: `lib/core/web_sync.dart`, `web_sync_repository.dart`, `web_sync_controller.dart`, adapter trong `api.dart`; `lib/ui/web_sync.dart` và mount trong `settings.dart`; `test/web_sync_test.dart`, `web_sync_widget_test.dart`; `README.md`. Không thay model/backup native, không thêm package/DB.

Rollback: bỏ mount thẻ, giữ tệp snapshot riêng để xuất. Source native cũ và token không bị migration. Muốn hợp nhất native library sau này phải làm adapter/version/roundtrip cho mọi trường và kiểm tra thực tế Android/iOS; không đổi nhãn PARTIAL thành hoàn thiện chỉ vì API đã dùng chung.
