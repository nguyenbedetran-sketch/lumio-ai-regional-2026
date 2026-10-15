# Rà soát yêu cầu từ ảnh: graph, bộ học tập, giọng nói và giáo viên

Ngày: 15/10/2026. Audit source trước khi chốt tính năng giáo viên. Đây là ma trận phạm vi, **không phải** xác nhận toàn bộ ảnh tham khảo đã được triển khai hoặc kiểm tra công khai.

## Yêu cầu mới nhất

Người dùng yêu cầu thêm đăng ký tài khoản giáo viên, nhập quốc gia, tỉnh/thành phố, xã/phường, trường và cấp dạy; admin xét duyệt. Ảnh tham khảo còn mô tả bản đồ kiến thức cá nhân, một nguồn thành bộ học tập, hội thoại giọng nói và không gian giáo viên. Ảnh dashboard có số học sinh/điểm/nhận xét chỉ là **tham khảo**, không phải dữ liệu Lumio hoặc kết quả pilot.

## Ma trận hiện hành

| Yêu cầu | Source và bằng chứng hiện có | Khoảng trống / trạng thái |
| --- | --- | --- |
| Knowledge Graph cá nhân | `skill-taxonomy.ts`, `skill-evidence.ts`, `skill-evidence.tsx`: graph bảy kỹ năng Toán nền tảng, quan hệ tiên quyết khai báo rõ; chọn nhánh, xem số câu khác nhau, giãn cách và độ khó. 39 unit +43 UI trong report learning. | **PARTIAL**. Không phải graph tự động mọi môn/tài liệu. Chỉ gợi ý nền tảng theo taxonomy; một câu sai không đủ chẩn đoán nguyên nhân, một câu đúng không chứng minh thành thạo. Chưa có dữ liệu hiệu chuẩn hoặc giáo viên chấm độc lập. |
| Một nguồn → bộ học tập | `study-studio.tsx`: cùng học liệu có tóm tắt, thẻ, quiz, ghi chú, âm thanh, kế hoạch học; `rich-summary.tsx` có sơ đồ tương tác, zoom và xuất SVG. Nguồn của thẻ/quiz/tóm tắt đối chiếu được khi đã xác định. | **PARTIAL**. Chưa có một job tạo và cập nhật đồng bộ mọi artifact. Kế hoạch là mẫu sửa tay, không tự nhận là AI lesson plan. `Question` hiện là trắc nghiệm, chưa có ngân hàng/tự chấm tự luận. Sửa nguồn không được âm thầm coi kết quả cũ là mới. |
| Voice Tutor tự nhiên | `voice-studio.tsx`, `lib/voice/*`: ghi âm, chép lời, sửa bản chép, gửi câu hỏi, nhận văn bản/công thức và nghe; dừng/hủy request và playback, giữ tutor session/khóa ba gợi ý. Phép thử V2 public phát âm thanh riêng đã có. | **PARTIAL**. Theo lượt, chưa streaming song công, VAD/barge-in hoặc reconnect realtime. Nút dừng không được gọi là tự ngắt lời bằng giọng nói. Zoom/loa/micro vật lý, độ trễ và nền tảng di động thật chưa được chứng minh trong V3. |
| Đăng ký và admin cấp quyền giáo viên | Hợp đồng `lib/teachers/contracts.ts` đã chốt; API/store/migration11 có **23 kiểm tra PASS** trong `qa-teacher-api-report.json`, dùng handler và SQLite cô lập với hồ sơ tổng hợp. Self form/admin UI đang hoàn thiện riêng. | **PARTIAL**. Backend có bằng chứng về quyền/CAS/replay/approve/revoke/rollback; chưa tự suy thành UI, OAuth/public hoặc xác minh giáo viên thật PASS. |
| Teacher Workspace lớp học | Người dùng có thể tạo câu hỏi từ học liệu trong luồng học hiện có. | **NOT IMPLEMENTED** cho roster, lớp, giao bài, nộp bài, consent học sinh và thống kê lớp. Được duyệt hồ sơ không tự cấp quyền đọc học liệu/số liệu cá nhân học sinh. Không điền các thẻ “24 học sinh/76% tiến bộ” từ ảnh. |

## Ưu tiên cho lần chốt này

**P0 — hoàn thiện luồng giáo viên được yêu cầu trực tiếp.**

1. Self form và trạng thái chưa gửi/chờ duyệt/được duyệt/từ chối/thu hồi. Hồ sơ đã duyệt không sửa trong khi quyền còn hoạt động; admin thu hồi rồi có thể gửi lại. Dùng CAS/revision và request ID; tài khoản thay đổi trong lúc request phải bỏ response cũ.
2. Admin đọc danh sách giới hạn/phân trang, lọc trạng thái, xem hồ sơ và ghi lý do khi duyệt/từ chối/thu hồi. Quyền admin chỉ kiểm tra canonical phía server; form/JSON client không tự đặt role, trạng thái hay credential.
3. Quốc gia/vùng lãnh thổ tĩnh vi/en; Việt Nam lazy-load tỉnh/xã từ snapshot có phiên bản. Đổi tỉnh xóa lựa chọn xã cũ. Mạng/data lỗi vẫn có trường khai tay được gắn rõ; quốc gia khác dùng tên hành chính tự khai có giới hạn.
4. Ghi rõ đây là xét duyệt bản khai, không xác minh danh tính/việc làm chính thức. Không thu căn cước, ngày sinh, địa chỉ nhà, dữ liệu học sinh hoặc bản scan chứng chỉ trong đợt này.
5. Kiểm tra same-origin/account binding, cross-account/admin denial, CAS conflict, replay, stale review, approve/reject/revoke, thu hồi có hiệu lực, schema / field thừa và lưu lại qua SQLite. UI có phone-width, keyboard/error/saving và không lộ raw server diagnostics.

**P1 — tiếp theo sau khi nền tảng ổn định.** Bộ study-pack theo snapshot nguồn, trạng thái từng artifact và đánh dấu cũ khi đổi nguồn; tự luận có rubric/đáp án tham chiếu được duyệt; mở rộng graph theo taxonomy đã kiểm định. Không tự tạo một chẩn đoán năng lực hoặc kết quả giáo dục chỉ để lấp giao diện.

**P2 — cần thiết kế riêng.** Realtime voice có token ngắn hạn/giới hạn chi phí, barge-in, sửa transcript, văn bản công thức, fallback theo lượt và kiểm tra thiết bị; classroom có consent/phân quyền theo lớp, mời học sinh chủ động và thống kê tổng hợp đủ mẫu. Chưa có cam kết lịch hoặc infrastructure trả phí.

## Hợp đồng giáo viên và dữ liệu

`TeacherProfile` gồm tên tự khai, `countryCode`, tên quốc gia, tỉnh/thành phố, xã/phường, trường, cấp dạy, môn dạy; `teacherDeclaration:true`, `storageConsent:true`. `workEmail` và `publicEvidenceUrl` là tùy chọn; URL HTTPS không được tự fetch. Không có age gate hoặc yêu cầu giấy tờ định danh. Nhãn form phải khớp contract hiện hành, không dùng các cờ `adultDeclaration`/`consent` cũ.

Credential luôn ghi `basis:'manual-review-of-declaration'`, `identityVerified:false`. `active` phản ánh phê duyệt của ứng dụng, không chứng nhận nghề nghiệp. Lưu hồ sơ để owner/admin xét duyệt có thông báo trước gửi; không áp TTL bảy ngày của tutor/RAG/sync sang hồ sơ giáo viên khi backend chưa quy định. Free host vẫn có thể reset DB sớm. Xóa/rút hồ sơ phải phản ánh đúng endpoint thực có, không đặt nút giả.

## Minh chứng cần lưu khi kiểm tra xong

- Report API/store và UI tách nhau; số lượng từ đúng lần chạy, không cộng lại một case rerun.
- Ảnh self form/trạng thái và admin approve/revoke dùng tên/trường tổng hợp, không email cá nhân hoặc hồ sơ thật.
- Ảnh tham khảo của người dùng không dùng làm ảnh “sản phẩm đã chạy”.
- Bản public V3 phải có report mới sau deploy đúng commit; kết quả OAuth/voice V2 không tự chuyển thành teacher V3 PASS.

Đọc cùng [bàn giao](00-HANDOFF.md), [learning](03-LEARNING-INTELLIGENCE.md), [mobile](04-MOBILE-SYNC-SCOPE.md), [nguồn dữ liệu địa phương](09-LOCATION-DATA.md) và report cuối khi được chốt.
