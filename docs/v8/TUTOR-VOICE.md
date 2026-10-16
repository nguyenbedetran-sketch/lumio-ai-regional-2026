# V8 — Gia sư liên tục, hỗ trợ theo yêu cầu và Voice

Tình trạng: đã triển khai cục bộ trên nhánh V8, schema18. Tài liệu này không xác nhận đã public/nộp lại. Không dùng API thật trong các kiểm tra V8 của module này; không thêm nhà cung cấp, không dùng DeepSeek.

## Hành vi đã có và phần bổ sung

Khóa lời giải, phiên học 7 ngày, nguồn trích khớp, kiểm tra toán có phạm vi, credit/idempotency và nhật ký lần gọi nhà cung cấp là nền tảng đã có. V8 giữ các cơ chế đó, không thay bằng bộ đếm phía trình duyệt.

- Người học chọn Bước tiếp theo / Dễ hiểu hơn / Ví dụ tương tự / Cách tiếp cận khác rồi chủ động gửi câu hỏi. Chọn kiểu hỗ trợ không tự gọi AI, không tự xóa bản nháp. `initialPrompt` chỉ điền câu hỏi từ trang chủ; bản nháp rỗng có chủ ý được ưu tiên. `onDraft` nhận ngay bản nháp ban đầu để cảnh báo trước khi rời trang.
- Chỉ lượt `progress` có cấu trúc gợi ý được chấp nhận và không yêu cầu làm rõ mới tăng khóa. Ba loại giải thích bổ sung luôn không tăng khóa; 50 lượt bổ sung vẫn không thay thế ba lượt tiến triển. Lượt hỗ trợ được phép diễn đạt lại nội dung cũ. Kiểm tra rò rỉ đáp án số trong phạm vi hỗ trợ, nguồn và lỗi nội dung vẫn áp dụng. Lượt hỗ trợ không xóa cờ thiếu dữ kiện trước đó.
- Prompt yêu cầu định nghĩa từ khó, một ví dụ khác số hoặc một cách tiếp cận cục bộ; không đưa toàn bộ lộ trình/lời giải trước khóa. Đây là chỉ dẫn cho mô hình, không phải bảo đảm ngữ nghĩa. Không tuyên bố đã xác minh mọi gợi ý hoặc người học đã hiểu bài.
- Phiên chính thức trả về mã lượt ổn định, loại lượt, cờ có được tính khóa hay không, câu hỏi/lời nhắn gần nhất đã ghi. Khôi phục dùng GET có kiểm tra tài khoản. Không suy luận năng lực/mastery từ metadata này.

## Phản hồi riêng theo lượt

Mỗi lượt trợ lý đã ghi có hai nhóm lựa chọn đóng: hữu ích/chưa hữu ích; có thể có lỗi/chưa chắc. Có thể lưu, sửa, xóa và tải lại. Không nhận nhận xét tự do, không nhận tệp/PII bổ sung, không gửi các lựa chọn vào prompt AI, không tự dùng để huấn luyện/chấm năng lực hoặc khẳng định đúng/sai.

`POST /api/tutor/feedback` (miễn phí, không cần AI đang bật):

```json
{
  "sessionId": "UUID",
  "turnId": "UUID",
  "requestId": "UUID",
  "expectedRevision": 0,
  "action": "set",
  "usefulness": "helpful",
  "correctness": "possible_error"
}
```

`action:"delete"` phải bỏ hẳn hai trường lựa chọn. `usefulness` nhận `helpful|not_helpful|null`, `correctness` nhận `possible_error|not_sure|null`; lưu cần ít nhất một lựa chọn. Không chấp nhận trường lạ hoặc kiểu ép như mảng. Header trình duyệt `X-Lumio-Account` phải khớp tài khoản đang đăng nhập và same-origin; native giữ hợp đồng bearer + `X-Lumio-User` hiện có.

Kết quả gồm `revision`, `feedback`, `deleted`, `replayed`, `appliedRevision`. CAS ngăn ghi đè bản sửa mới. Cùng UUID và payload khôi phục trạng thái hiện tại khi mất ACK; đổi payload với UUID cũ bị từ chối. UI giữ UUID khi lỗi mạng chưa chắc chắn, cho tải lại khi xung đột. Giới hạn 50 thao tác sửa/lượt và 10.000/tài khoản; vẫn cho xóa lựa chọn sau giới hạn. Xóa khi đã rỗng không phát sinh thêm bản ghi.

Quyền truy cập chỉ chủ phiên; việc tắt tài khoản/thu hồi sessionVersion có hiệu lực cả khi replay. Xóa phiên hoặc dọn phiên hết hạn xóa theo cascade cả lựa chọn và metadata thao tác. Xóa riêng phản hồi xóa lựa chọn ngay; hash, số phiên bản và mã thao tác phục vụ CAS/replay vẫn tồn tại đến khi phiên bị xóa/hết hạn. Không có cam kết tự xóa đúng một thời điểm khi máy chủ không hoạt động. Các bản sao lưu vận hành đã tạo có thể còn bản cũ, không bị sửa ngược bởi thao tác xóa trực tuyến.

## Voice

- Mặc định chưa chọn nguồn; chỉ khôi phục nguồn người dùng đã chủ động chọn lần trước, theo tài khoản. Chỉ văn bản đúng nguồn đang chọn được gửi. PDF/DOCX/PPTX chưa trích xuất bị chặn trong bộ chọn và có nút mở học liệu. Chứng cứ nguồn được chuyển nguyên vẹn; không cắt ngầm văn bản có chữ ký. Nguồn lớn hơn 200.000 ký tự bị từ chối ở client.
- Câu hỏi đã xem lại được gửi khi nhấn Hỏi Lumio. Máy chủ nạp lịch sử phiên chuẩn; không gửi lại bản hội thoại trình duyệt. Chép lời gửi bản ghi được chọn, đọc thành tiếng gửi nội dung cần đọc. Mỗi giai đoạn hoàn tất dùng credit theo cơ chế hiện có.
- Tham chiếu nguồn và phạm vi kiểm tra toán được giữ khi nhận câu trả lời và khôi phục. Trích dẫn khớp chỉ chứng minh đoạn trích có trong văn bản, không chứng minh lời giải đúng.
- Trình duyệt chỉ lưu ID nguồn đã chọn và con trỏ phiên gắn tài khoản/ngôn ngữ/hash nội dung/chứng cứ; không lưu toàn bộ cuộc trao đổi hoặc âm thanh vào localStorage. Văn bản gia sư/phản hồi lưu trên máy chủ tối đa 7 ngày và được dọn khi truy cập gia sư. Âm thanh chỉ ở tab đến khi người dùng lưu/tải, trừ bản ghi đã chủ động lưu vào thư viện.
- Remount khôi phục phiên bằng GET, không tự phát sinh yêu cầu AI. Lỗi khôi phục chưa rõ chặn gửi thêm cho đến khi thử lại; 404 xóa con trỏ cũ. Sau mất ACK, phản hồi completed có thể dùng con trỏ receipt để GET phiên chuẩn, không gọi lại AI để tạo cùng đáp án.
- Có nút xóa cuộc trò chuyện trên máy chủ; Bài mới chỉ bỏ con trỏ hiện tại, phiên trước vẫn theo thời hạn lưu. Xóa phiên không xóa nhật ký credit/metadata vận hành hoặc ghi chú đã người dùng lưu riêng.
- Đổi nguồn/ngôn ngữ/tài khoản hủy xử lý đang chờ, dừng phát và kết thúc MediaRecorder/micro/meter. Có kiểm tra phản hồi cũ trước khi cập nhật UI; nguồn đang được làm mới nền trong lúc ghi cũng phải dừng các track.
- Giữ `audio.play()` và nút phát thủ công khi autoplay bị chặn. Không tuyên bố đã kiểm thử loa/micro/Zoom thật, chất lượng giọng thật, realtime speech hoặc chấm phát âm.

## Schema và tương thích

Migration18 thêm `tutor_turns.intent` (mặc định `progress` cho dữ liệu cũ), `tutor_feedback`, `tutor_feedback_actions`; 51 bảng, 56 định nghĩa theo phiên bản; sáu guard bất biến cũ giữ nguyên. Hợp đồng kiểm tra schema lấy metadata từ SQL thực tế từng migration1–18. Snapshot CLI đọc/backup/restore-copy genuine13–18; chỉ bản sao được mở bằng runtime mới mới nâng cấp. Không chạy runtime cũ trên DB mới. Không downgrade/xóa cột trên DB người dùng.

`AIInput.tutorIntent` là trường tùy chọn, giá trị `progress|simpler|example|approach`. Khi thiếu, hợp đồng chuẩn hóa vẫn bỏ trường đó để giữ fingerprint request cũ. Server mặc định progress và không tin bộ đếm/lịch sử/cờ mở khóa do client gửi. Không tạo cache nội dung AI công khai.

## Kiểm tra đã chạy (fixture, không phải thử nghiệm người học)

| Lệnh                                                | Kết quả và phạm vi                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node tests/v8-tutor.cjs`                           | 23 kiểm tra PASS; SQLite/handler thật, synthetic auth, provider bị chặn và thay bằng fixture. Bao gồm50help,khóa,refund,lostACK,CAS,quyền,delete/TTL,rollback,cap,17→18 và snapshot18.           |
| `node tests/v8-voice-client.cjs`                    | 7 PASS; payload,provenance,abort,lostACK GET,slot binding và copy. Fetch giả, không thiết bị.                                                                                                    |
| `node scripts/test-v8-tutor-ui.cjs`                 | 36 assertion PASS trên React/CSS thật trong Edge; HTTP/auth/micro là fixture. Bao gồm empty-draft remount, freefeedback/lostACK, restore/source/account, cleanup micro khi cập nhật nền và390px. |
| `node tests/tutor.cjs` / `node tests/tutor-api.cjs` | 24 /12 PASS hồi quy gốc; provider thật không được gọi.                                                                                                                                           |
| `node tests/voice.cjs`                              | 14 PASS; ledger/handler thật và transport giả, giữ điều kiện credit/cancel.                                                                                                                      |
| Nhóm schema/operations/provider/retake/teacher      | 123 PASS (9+23+25+15+24+27), kết quả hiện tại ở `reports/schema-compatibility.json`; byte các báo cáo v7/v3 trước đó được giữ nguyên khi chạy nhóm riêng này.                                    |
| `pnpm exec tsc --noEmit`                            | PASS sau tích hợp; parent còn chạy fullgate/build.                                                                                                                                               |

Báo cáo: [tutor-api](reports/tutor-api.json), [voice-client](reports/voice-client.json), [Edge fixture](reports/tutor-ui.json), [schema compatibility](reports/schema-compatibility.json). [Ảnh phone fixture](reports/tutor-voice-phone-fixture.png) đã xem trực quan; là ảnh nội dung/tài khoản tổng hợp, không phải học sinh thật.

Chưa đánh giá bằng provider thật sau prompt V8, giáo viên/học sinh thật, nghiên cứu hiệu quả học, thiết bị Android/iPhone/desktop, loa/micro/Zoom thật, tải đồng thời hoặc kiểm thử xâm nhập toàn diện. Bổ sung này không hoàn thành mọi chức năng rộng trong V8; các giới hạn RAG/video/durability/thanh toán của bản trước vẫn còn trừ khi báo cáo module khác chứng minh thay đổi.
