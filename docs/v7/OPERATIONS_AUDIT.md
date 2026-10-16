# V7 · Kiểm toán vận hành và chi phí — Phase F

Ngày rà soát: 16/10/2026. Phạm vi là working tree `work/regional-20261015/release-repo`. Audit ban đầu ở base commit `31aff071dbb95aee37a77fa8f8d6822240b10344`/schema14 local; root sau đó cho phép sửa tại checkpoint local `656a637`. Hardening ban đầu kiểm trên schema15; **hiện hành là schema16, ops21/21 PASS**. Bản public trước nâng cấp là schema13 theo kiểm tra của điều phối viên, không đồng nhất DB local. Đây là rà soát mã và thử nghiệm cô lập, không phải pentest, chứng nhận production hoặc kiểm tra triển khai mới. Không đọc khóa thật hoặc gọi provider.

**Kết luận: PARTIAL về vận hành; bốn lỗi kiểm tra đã FIXED local sau review chéo.** Backup/restore file SQLite, checkpoint, giới hạn dùng chung DB và quyết toán credit hoạt động trong scope kiểm tra. Startup, health và backup dùng chung contract48 bảng/52 định nghĩa theo version/sáu trigger ở16; từ chối history tương lai/có lỗ, đối tượng tương lai không khớp history, bảng sai cấu trúc và trigger thiếu/bị sửa. CLI nhận genuine13/14/15/16 không migrate/seed nguồn. Hosting miễn phí vẫn chưa có bằng chứng lưu trữ bền vững hoặc disaster recovery ngoài host.

## Cập nhật hiện hành schema16 và tương thích public13

[operations-integrity.json](reports/operations-integrity.json) hiện ghi **21/21 PASS**:19 kiểm tra16 và2 kiểm tra13 mới. DB fixture tạo bằng migrations1–13 thật, có account/identity/billing, bài đã giao, bài nộp/điểm đã công bố và sync tổng hợp. Inspect/backup/CLI restore giữ nguyên source bytes; chỉ bản restore migrate13→16. Row JSON các bảng13 giữ nguyên; migration15 chỉ thêm legacy_snapshot trung thực,16 thêm cửa sổ từ issued_at. Fake13 còn receipt table14 bị từ chối trước write. Không có backup, migration hoặc rollback DB Render Free thực tế trong bằng chứng này.

Hướng dẫn hiện hành: [runbook schema16](OPERATIONS_RUNBOOK.md). Public13→16 cần snapshot13 riêng và artifact13 tương ứng; rollback dùng đúng cặp đã giữ, không dùng mô phỏng compiler giảm migration làm artifact rollback. **Checkpoint schema15/17 kiểm tra dưới đây là lịch sử**, không mô tả phiên bản hiện hành. Report cũ giữ tại [operations-integrity-schema15.json](reports/operations-integrity-schema15.json); operations-audit.json giữ nguyên. Không cộng các lần chạy trùng thành test mới.

## Bằng chứng checkpoint lịch sử schema15

| Phép thử | Kết quả | Phạm vi thực tế |
| --- | --- | --- |
| `node tests/operations.cjs` | 9/9 PASS | SQLite file tạm thật; WAL snapshot, restore riêng, integrity/FK, bảng bắt buộc và giới hạn sync. |
| `node tests/summary-jobs.cjs` | 23/23 PASS | Handler/worker/quota/ledger thật với DB tạm; OAuth và transport provider là fixture. |
| `node tests/runtime-sync.cjs` | 14/14 PASS | Hai store dùng chung SQLite, cửa sổ UTC, lease, CAS/epoch/outbox và snapshot. |
| `node tests/v7-operations.cjs` | 17/17 PASS | Contract cấu trúc khớp migrations1–15; chặn startup sai trước write/seed, table giả/dropped CHECK/future objects, đóng connection khi migration lỗi, snapshot/restore giữ dữ liệu riêng tổng hợp và sáu guard vẫn chặn UPDATE/DELETE. |
| Repro hẹp cho hai phát hiện bên dưới | DETECTED | DB tổng hợp trong thư mục hệ thống tạm, dọn sau thử; không đổi DB của ứng dụng. |

Tổng **63 kiểm tra PASS tại checkpoint lịch sử** gồm46 kiểm tra giữ lại và17 mới; không phải tỷ lệ chính xác AI hoặc phục hồi máy chủ thật. Báo cáo: [audit lịch sử](reports/operations-audit.json), [17 kiểm tra schema15](reports/operations-integrity-schema15.json). Không suy ra cả63 vừa được chạy lại từ report21 hiện hành.

## Hai phát hiện có thể tái hiện

### F01 · P2 — kiểm tra snapshot bỏ sót trigger bất biến · FIXED local

Vị trí: `scripts/database-snapshot.cjs:6–64`; đối chiếu `lib/server/runtime-v3-core.ts:232–279` và trigger trong `lib/server/schema.ts`.

1. Tạo DB schema14 tổng hợp và một tài khoản/ledger dùng thử.
2. `VACUUM INTO` sang file riêng. Đủ bốn trigger `audit_no_update`, `audit_no_delete`, `billing_ledger_no_update`, `billing_ledger_no_delete` vẫn tồn tại: **cơ chế VACUUM giữ trigger đúng**.
3. Trong bản riêng, xóa bốn trigger rồi gọi `snapshot()` sang một file mới.
4. Helper vẫn trả `integrity:ok, schemaVersion:14`; UPDATE ledger trong file được chấp nhận thành công.

Đây là thiếu kiểm tra bất biến ứng dụng khi nhận bản backup/restore; không phải phát hiện người dùng HTTP có thể xóa trigger. `quick_check`, FK và đủ tên bảng không chứng minh các ràng buộc append-only còn hiệu lực. Readiness hiện cũng chỉ kiểm tra tên bảng và phiên bản lớn nhất.

**Sửa tối thiểu đề xuất:** kiểm tra tên/bảng/loại và định nghĩa chuẩn của các trigger bắt buộc; có kiểm thử UPDATE/DELETE bị từ chối sau restore bằng DB tổng hợp. Schema15 phải thêm cả hai trigger lịch sử điểm. Không chỉnh sửa hay drop trigger ở DB đang chạy để thử. Nếu thiếu guard, inspect/readiness phải từ chối rõ ràng.

**Đã thực hiện:** `lib/server/database-integrity.ts` so khớp canonical SQL từ migrations cho bốn guard cũ và hai guard lịch sử điểm. Health/backup/startup dùng chung hàm read-only. Test bỏ từng guard hoặc thay bằng trigger cùng tên nhưng `WHEN 0` đều bị từ chối; sau VACUUM/restore, UPDATE/DELETE ba nhóm dữ liệu đều thất bại đúng guard. Không sửa trigger production để thử.

### F02 · P2 — mã cũ vẫn ghi vào schema mới trước khi health từ chối · FIXED local

Vị trí: `lib/server/store.ts:88–136`; `lib/server/runtime-v3-core.ts:232–279`.

1. Tạo DB schema14 tổng hợp, thêm bản ghi migration15 trong file riêng để mô phỏng code mới đã áp dụng schema mới.
2. Mở bằng `createStore()` của runtime14.
3. `ensureIdentity()` vẫn tạo được tài khoản; sau đó `runtimeHealth()` mới trả `{ready:false,schemaVersion:15}`.

Repro không khẳng định đã chạy toàn bộ migration15 hoặc đã phá dữ liệu thật. Nó chứng minh hàng rào startup hiện không chặn ghi từ runtime cũ. Rollback nhầm binary có thể làm thay đổi projection mà bỏ qua quy tắc mới, nhất là lịch sử điểm của E1.

**Sửa tối thiểu đề xuất:** đọc migration history và từ chối schema tương lai/chuỗi có lỗ trước seed hoặc mutation; chỉ cho prefix liên tiếp đã biết để nâng cấp. Có regression chứng minh failed startup không đổi tài khoản, flags, schema hoặc dữ liệu. Không xóa migration history để ép chạy build cũ.

**Đã thực hiện:** `store.ts` kiểm history/guard ngay sau open, trước WAL/CREATE/migration/seed; kiểm lại sau migration; đóng DB nếu khởi tạo lỗi. DB tương lai16, history có lỗ/rỗng trong DB có dữ liệu và runtime14 mô phỏng mở schema15 đều bị chặn mà bytes/seed/danh sách file không đổi. Migration15 lỗi có chủ ý rollback bảng/version, đóng connection và cho phép lần retry do người vận hành chủ động.

Hai phát hiện đã gửi root trước mọi chỉnh sửa runtime; patch chỉ thực hiện sau phê duyệt Phase F. FIXED ở đây chỉ nói về mã và kiểm thử local, không xác nhận đã deploy bản mới hoặc đã diễn tập rollback host.

### F03/F04 · P2 — review chéo cấu trúc/history · FIXED local

Reviewer độc lập tái hiện hai trường hợp sau patch đầu: (F03) xóa riêng migration15 làm history liên tiếp1–14 nhưng bảng/trigger15 vẫn còn; inspect nhận nhầm14; (F04) thay bảng `teaching_grade_events` bằng `(dummy TEXT)` rồi tạo lại đúng hai trigger vẫn qua kiểm tra tên bảng/guard. Đây là file tổng hợp, không phải DB người dùng.

Patch tiếp theo so canonical table SQL theo từng version, gồm cột, kiểu, PK/UNIQUE/FK/CHECK. Contract có51 định nghĩa cho47 bảng vì ba bảng đã ALTER ở các version khác nhau; bootstrap và schema14 thật vẫn hợp lệ. Chuẩn hóa SQL giữ nguyên literal và ranh giới token, không xóa khoảng trắng bên trong chuỗi. Bất kỳ tên bảng/guard tương lai đã biết còn hiện diện trong history cũ đều bị từ chối trước write.

Bốn regression mới chặn: deleted15 marker, future guard đơn lẻ trên bảng14 hợp lệ, bảng dummy kèm đúng guards, và bảng đủ cột nhưng mất CHECK. Startup bị từ chối không đổi bytes/seed/file list; health/inspect/backup cũng từ chối. Không áp migration16 trong phép sửa này. Đây vẫn không phải cơ chế ký toàn bộ nội dung DB hay phát hiện mọi index/đối tượng tùy biến không thuộc contract.

## Kho chức năng và giới hạn đã đối chiếu

| Hạng mục | Trạng thái | Mã và bằng chứng / giới hạn |
| --- | --- | --- |
| Migration tăng dần | COMPLETE trong scope local | Mỗi migration trong `store.ts` dùng `BEGIN IMMEDIATE` và ghi version cùng transaction; nhiều process kiểm lại dưới khóa. History/prefix và guard kiểm trước ghi; lỗi khởi tạo đóng DB. Không có down migration. |
| Backup SQLite | COMPLETE trong phạm vi file local | `database-snapshot.cjs`: nguồn chỉ đọc, `VACUUM INTO`, đích mới, quick/FK/history/canonical table+guard/future-object checks, SHA-256; chặn đích lexical trong public/docs/app và ghi đè. Hiện nhận genuine13/14/15/16, không migrate từ inspect/restore. Chưa kiểm Windows ACL hoặc symlink/junction. |
| Restore | PARTIAL | Restore sang file riêng đạt; không thay DB sống. Chưa có off-host copy, lịch backup tự động, RPO/RTO đo được hoặc diễn tập mất host Render. Hash local không phải bằng chứng file đã tới nơi khác. |
| CI | PARTIAL, source đã thêm | Audit ban đầu không có workflow. Root đã thêm `.github/workflows/verify.yml`: Node24.19/pnpm11.25, lockfile, test:all/build/typecheck, action SHA pin, quyền contents:read và không có provider keys/deploy. Chưa có lần chạy GitHub Actions hoặc kiểm branch protection được xác minh trong Phase F. Browser/native/provider có gate riêng. |
| Hàng đợi | COMPLETE trong phạm vi kiểm thử | Tối đa 3 active/12 retained jobs, 12 parts, 120k ký tự hoặc YouTube 2 giờ theo thời lượng khai báo; 3 lần dispatch/part; backoff 5/15 giây; lease 210 giây và fencing token/sequence. 23 tests PASS. |
| Worker và phục hồi | PARTIAL | Warm-process worker, tối đa 36 bước/lần, timer không giữ process sống; kick khi chủ truy cập jobs. Restart cần lượt truy cập xác thực kế tiếp. Không có daemon/scheduler độc lập; chưa kiểm host-crash/Render sleep thật. |
| Quyền và hủy job | COMPLETE trong scope tests | Owner/session canonical, account header, consent, same-origin; hủy/thu hồi được kiểm lại trong transaction, late response không thể phục hồi job. Hoàn hold trước reclaim; crash trước gắn reservation có recovery theo request ID. |
| Giới hạn AI | COMPLETE trong scope DB chung | `runtime-v3-core.ts`: 15 attempts/phút và 150/ngày UTC/tài khoản; 1 active/tài khoản; chế độ thi 200/ngày UTC toàn hệ thống và 3 active; lease 180 giây. Nhiều process chỉ dùng chung giới hạn nếu cùng file DB. |
| RAG throttle | PARTIAL | `rag-access.ts` thêm 30 HTTP/phút/account trong RAM của mỗi process. Paid embedding/search vẫn chịu shared AI quota/credit/receipt. Không gọi throttle RAM là giới hạn toàn cụm. |
| HTTP chống tính credit trùng | COMPLETE trong scope tests | Phase B: UUID ràng buộc actor/endpoint/fingerprint; receipt và ledger/tutor/vector commit nguyên tử; tombstone ledger sau metadata TTL. Mất DB Free host vẫn mất bảo vệ. Không phải exactly-once tại provider. |
| Telemetry | PARTIAL | Có user ID/task/provider/model/status/token/cached token/latency/safe error; không ghi prompt/source trong event vận hành. `recordAIUsageSafe` không để lỗi log phá quyết toán. Log best-effort nên không phải sổ cái tiền. |
| Ngân sách tiền thật | MISSING | Không có daily USD cap/provider invoice reconciliation. Credit là đơn vị UX, không phải USD/VND. Output caps và logical quota làm giới hạn sơ bộ; không chứng minh chặn tiền tuyệt đối. |
| Giám sát | PARTIAL | `/api/health` là readiness DB/version; không kiểm model, độ đúng AI, dung lượng disk, queue freshness hoặc alert ngoài host. Health 200 không thay các bằng chứng đó. |

## Chi phí API, credit và các điểm cần hiển thị đúng

- **Provider có thể đã tính tiền dù credit được hoàn:** timeout, output sai schema, hủy sau khi provider xử lý hoặc lỗi commit đều có thể hoàn credit nội bộ; điều đó không hoàn hóa đơn bên ngoài. Chưa có số liệu invoice để tính chi phí tiền thật.
- `routeAI()` chỉ có tối đa một fallback text-only sang provider còn lại cho nhóm lỗi cho phép. Media/video không bị gửi lại sang model text giả vờ đã đọc. Một logical attempt có thể chứa hai transport provider; quota200/ngày là số attempt logic, không phải200 hóa đơn/request provider tuyệt đối.
- Queue có thể tự thử lại tối đa3 dispatch/part với ID sequence mới, chỉ sau lỗi cho phép; checkpoint thành công không chạy lại. Cần nêu rõ chính sách retry này cạnh consent/cost nếu sau này bán dịch vụ. Không biến việc hoàn credit mỗi lần lỗi thành bảo đảm không tốn API.
- Router giới hạn output: generic chat1000/2400/3600/2000 theo mode; tutor có state4096 hoặc6144 full; teaching4096; summary7200; cards/quiz3000. Đây là cap output, không giới hạn toàn bộ token input, thời lượng/video hoặc giá model.
- Telemetry hiện ghi một event logical request. Thành công fallback chỉ mang metadata kết quả cuối; những lỗi xảy ra sau provider đã trả usage nhưng trước validate hoàn tất có thể mất token/model của lần đó. Vì vậy chưa đủ đối soát chi phí từng provider attempt. `estimated_cost_usd` có thể null; UI phải giữ trạng thái thiếu dữ liệu, không coi null là0đ.
- Thanh toán thật chủ động OFF. Bảng giá đề xuất59k/129k/249k không phải giá API và không chứng minh lợi nhuận. Không cần thêm provider hoặc dịch vụ trả phí để hoàn thành các sửa vận hành nhỏ.

## Kế hoạch checkpoint E1 schema15 — lịch sử

Đây là runbook đề xuất, **chưa thực thi trên production**:

1. Chốt commit và toàn bộ kiểm tra schema15, gồm trigger history, permission/student projection, CAS/replay và rollback transaction. Snapshot tool/readiness phải biết đúng schema và kiểm guard, không chỉ đổi số14 thành15.
2. Tạm ngưng worker qua `LUMIO_BACKGROUND_JOBS_DISABLED=true`, dừng ghi/đợi request còn chạy kết thúc. Không chụp một DB rồi coi các giao dịch phát sinh sau snapshot đã được giữ.
3. Dùng helper tương thích schema14 tạo snapshot trước nâng cấp ở nơi riêng; inspect, SHA-256 và thử restore sang file khác. Nếu dùng helper mới, chỉ hỗ trợ phiên bản cũ đã biết bằng danh sách bảng/trigger theo version; tuyệt đối không tự migrate DB từ lệnh inspect.
4. Giữ snapshot ngoài thư mục source/public; bản cùng ổ tạm chỉ là bản local. Chưa có bằng chứng sao chép ngoài host thì ghi rõ rủi ro còn lại, không đánh dấu DR PASS.
5. Áp dụng migration15 một lần; đối chiếu bytes của issued question/recipient/submission/sync cũ và grade history seed trung thực. Kiểm actor/time cũ không biết phải null/legacy, không điền giả.
6. Snapshot schema15 sau nâng cấp và thử restore riêng; trigger UPDATE/DELETE phải còn chặn. Chạy route smoke local compiled; mới kiểm deployment thật theo quy trình root.
7. Rollback runtime14 cần **snapshot DB14 riêng tương thích**, hoặc một runtime rollback đã được chứng minh đọc/ghi an toàn với15. Không trỏ code14 vào DB15 rồi chỉ dựa health503. Đổi `LUMIO_DB_PATH` sau khi dừng process, giữ nguyên DB15 để điều tra. Khôi phục snapshot trước nâng cấp sẽ bỏ các giao dịch mới; phải nêu thời điểm/cửa sổ dữ liệu bị mất.
8. Chỉ bật lại worker sau schema/health/account/grade/receipt check. Không auto rerun AI để kiểm health hoặc khôi phục đầu ra đã mất.

History E1 dùng bảng `teaching_grade_events` và trigger `teaching_grade_events_no_update` / `teaching_grade_events_no_delete`. Điểm, nhận xét và lý do chấm lại là dữ liệu đánh giá riêng; không áp TTL7 ngày của tutor/jobs cho chúng, không hứa endpoint tự xóa chưa có. Chúng nằm trong backup; bản public minh chứng chỉ dùng hồ sơ tổng hợp. Không đưa điểm/đáp án/lý do riêng vào general operational telemetry.

## Ưu tiên sau audit

1. F01–F04 đã sửa với17 regression mới; root chốt tích hợp/build/deployment cùng E1. Không đổi nhãn public khi chưa có bằng chứng riêng.
2. Runbook hiện hành16 đã thêm baseline public13; checkpoint15 giữ nhãn lịch sử. Không dùng13 như đích source mới, nhưng phải giữ snapshot13/artifact13 đúng cặp để rollback public.
3. Workflow source đã tái sử dụng testchain hiện có; lần chạy GitHub Actions và branch protection vẫn cần bằng chứng riêng. Browser/native/provider là các gate khác, không suy ra từ CI source. Không thêm database/service mới chỉ để có nhãn CI.
4. Bổ sung provider-attempt telemetry/cảnh báo quota và bảng thiếu dữ liệu khi có yêu cầu vận hành cụ thể; không tự đặt số tiền cap bằng giá cũ chưa đối chiếu.
5. Off-host restore, tải nhiều người, device thật và pilot người học là NOT_TESTED. Phải tạo bằng chứng riêng trước khi đổi nhãn.
