# F02a1 · Nhật ký metadata từng provider dispatch

Trạng thái: **SCOPED LOCAL ACCEPTANCE**. Full regression/TypeScript/build/compiled HTTP đã được root xác minh;2 HTTP smoke thật được đối chiếu riêng, không phải benchmark đầy đủ. Scope chỉ routeAI văn bản/đa phương thức cho learner, teacher draft và shared summary/job; embeddings/xAI voice, rate cards và hóa đơn chưa được bổ sung journal. Bản public chưa nâng cấp.

## Hành vi và ranh giới

- Migration17 chỉ thêm ai_provider_attempts và index. Không đổi migrations1–16, số credit, reservation/refund/receipt hoặc provider/model/fallback policy. DB mới không dựng lại attempt lịch sử từ outcome cũ.
- routeAI có observer server-only tùy chọn thứ tư. Direct unit/router calls không có observer vẫn tương thích; cả ba production paths cung cấp context từ canonical server principal/reservation. validateInput không nhận observer/actor/feature từ JSON người dùng.
- Factory và **mỗi prepare** kiểm session còn hiệu lực, user/reservation/request/task tương ứng và hold chưa hết hạn/finalize. Teacher dùng ledgerRequestId namespace riêng; job dùng part/lease sequence. Shared summary mặc định learner.summary; worker truyền job.summary-part rõ ràng. Không spread rich job lease/source vào journal context.
- Prepare ghi bền trước fetch, cấp ordinal từ MAX dưới khóa transaction. Không ghi/còn slot thì lỗi AI_ATTEMPT_UNAVAILABLE hoặc AI_ATTEMPT_CAPACITY trước transport; không biến lỗi kế toán thành fallback/retry. Fallback hợp lệ vẫn có hai row ordinal riêng; replay cùng intent bị guard/ledger chặn trước dispatch.
- Terminal capture HTTP/model/usage ngay sau đọc JSON giới hạn2MiB, trước incomplete/structure/tutor/math/source checks. HTTP500/429 có metadata hợp lệ vẫn được ghi. HTTP200 có output bị loại không đồng nghĩa model không tiêu token.
- Finish là capability closure ràng buộc attempt/user/reservation/session snapshot; terminal CAS một lần, vẫn ghi observation khi account bị revoke hoặc hold đã refund trong lúc request đang chạy. Không mở transaction qua await/fetch hoặc BEGIN lồng trong credit settlement.
- Nếu terminal logger hoặc console.warn lỗi sau response, kết quả hợp lệ không bị chuyển thành fallback. Row prepared chưa kết thúc giữ trạng thái unknown để đối chiếu. Lỗi cancel cleanup trên response quá giới hạn luôn giữ lỗi INVALID_PROVIDER_RESPONSE, không tạo generic Error gây gọi provider khác.

## Dữ liệu lưu và chi phí chưa biết

Journal lưu ID nội bộ liên kết tài khoản/request/reservation, feature, ordinal, provider, endpoint kind, requested_model và response_model riêng; status/HTTP/latency/safe error, input/output/cache/total/reasoning token khi quan sát được. Response model là trường provider khai, không xác minh model vật lý. Model/request ID không hợp lệ hoặc echo credential cấu hình bị bỏ; không lưu headers đầy đủ.

Không lưu prompt/question/source/quote/transcript, raw provider body, ảnh/audio/video/vector, tên/email/roster/nhận xét giáo viên. ID liên kết tài khoản vẫn là metadata riêng, không được gọi là anonymous. Metadata view mới phải dùng quyền admin/account/no-store hiện có; admin read/UI do root nghiệm thu riêng.

Token phải là safe integer không âm; missing/string/negative/fractional thành null;0 chỉ giữ khi upstream báo0. Total không tự tính từ input+output; cache có thể là phần của input và không được cộng lần nữa. usage_source chỉ nói adapter đã thấy loại metadata đó, không tự chứng minh đủ token hoặc hóa đơn.

**estimated_cost_usd bắt buộc null trong schema17.** Không gắn giá API, đổi credit ra tiền hoặc dùng bảng giá gói để suy chi phí. Provider có thể tính phí dù app hoàn credit. Journal response_received không phải xác nhận nội dung được chấp nhận/charge settled; trạng thái credit vẫn lấy từ billing ledger riêng. Mất mạng/timeout/cancel là nhận/chi phí chưa biết, không phải0đ. Log outcome ai_usage cũ không bị gộp/cộng lặp với attempts.

## Retention, capacity và vận hành

- Terminal metadata quá31 ngày được dọn tối đa200 row mỗi prepare có quyền, theo index ended_at; đây là cleanup theo truy cập, **không phải xóa đúng hạn bởi scheduler**. Không có prepare thì row có thể lưu lâu hơn.
- Purge là transaction ngắn có auth/hold check; capacity+ordinal+insert dùng transaction thứ hai và kiểm lại session/hold. Vì vậy terminal quá hạn vẫn được dọn khi một prepare sau đó bị từ chối capacity; quota/ordinal/insert vẫn nguyên tử.
- Không tự purge unresolved:64/account,2048 toàn DB,100000 tổng row. Hết slot thì từ chối dispatch mới. Có thể cần người vận hành kiểm tra storage/metadata chưa hoàn tất; chưa có endpoint tự “giải quyết” row uncertain, không được tự phát lại API để lấp usage.
- Một DB SQLite chia sẻ cùng process/host mới chia sẻ journal/cap. Render Free mất DB vẫn mất metadata và receipt local; journal không tạo durable hosting/off-host DR hoặc exactly-once tại provider.
- Canonical17 có49 bảng/53 định nghĩa versioned, sáu immutable guards cũ. Journal là prepare→terminal CAS có retention, **không phải append-only financial ledger**. Backup inspect nhận genuine13/14/15/16/17; chỉ restore-copy được mở bằng runtime mới để migrate. Không xóa history/table để giả phiên bản cũ.

## Kiểm tra hiện có

| Command / report | Kết quả và scope |
| --- | --- |
| node tests/v7-provider-attempts.cjs / [provider-attempts.json](reports/provider-attempts.json) |25 PASS: store/Router/learner HTTP/teacher HTTP/shared summary thật với SQLite tạm; provider/OAuth là fixture. Gồm metadata trước fetch/validation, fallback500→200, missing/0/invalid tokens, model/key echo, lỗi ghi trước/sau, revoke/refund/CAS/ordinal, replay, rich job principal, multimodal fake payload, retention200 và caps64/2048/100000. |
| [provider-attempt-adversarial.json](reports/provider-attempt-adversarial.json) |15 PASS độc lập dùng SQLite/Router và lỗi giả; gồm purge vẫn commit khi prepare bị từ chối capacity, lỗi reader.cancel không trở thành fallback trả phí, post-response logger/console fault, canonical binding/revoke/CAS/ordinal và metadata13–16→17. Không là pentest/live API. |
| node tests/v7-operations.cjs / [operations-integrity.json](reports/operations-integrity.json) |23 PASS ở17: snapshot/restore giữ journal bytes cùng grade/receipt/sync/ledger; true13–16 nguồn chỉ đọc, copy nâng17; fake16 còn journal17 bị từ chối trước write; guard cũ vẫn chặn UPDATE/DELETE. |
| node tests/operations.cjs |9 PASS sau nâng contract17, DB tạm. |
| node tests/teaching-content-api.cjs |24 PASS/16 intercepted calls: quyền teacher/source race/revoke/AI disable/refund/JSON và không publish tự động. |
| node tests/summary-jobs.cjs |23 PASS: worker/sequence/retry/cancel/revoke/settlement với SQLite thật, provider fixture. Lần đầu phát hiện spread rich lease làm strict journal context bị từ chối; đã chọn rõ hai trường principal và chạy lại PASS. |
| node tests/core.cjs + node tests/v7-content-prompt.cjs |9+12 PASS, observerless compatibility và D04 prompt/validator; không chứng minh semantic repair. |

Tất cả hàng trên0 provider thật; không cộng chúng thành tỷ lệ đúng AI. Integrated TypeScript/build/full regression, admin UI và production/live smoke có gate do root chạy riêng. [operations-integrity-schema16.json](reports/operations-integrity-schema16.json) giữ checkpoint16/21 cũ; report schema15 cũng giữ nguyên. Các raw live tutor/content trước17 không bị chỉnh sửa hoặc gán provenance journal mới ngược lại.

## Còn PARTIAL

Chưa instrument embedding/voice dispatch; chưa có approved rate snapshots, USD hard budget, provider invoice reconciliation, true provider-side idempotency hoặc retention worker độc lập. Chưa có pilot người học/thiết bị thật/off-host khôi phục. Prepared chỉ chứng minh app đã ghi trước điểm gọi, không chứng minh provider đã nhận; response metadata có thể thiếu. F02 tổng thể vẫn PARTIAL dù journal trong scope này đạt các gate local.
