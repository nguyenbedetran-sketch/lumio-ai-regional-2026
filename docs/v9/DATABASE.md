# V9 — Cơ sở dữ liệu bền vững: kiểm toán và quyết định kiến trúc

Ngày kiểm tra: 17/10/2026. Trạng thái: **adapter đã qua local và8 cổng trên database Turso QA riêng; chưa cutover public hoặc xác nhận di chuyển dữ liệu cũ**. V9 về giao diện đã được đọc đầy đủ; yêu cầu lưu dữ liệu giáo viên/học sinh bền vững là yêu cầu bổ sung trực tiếp của người dùng.

## Nghiệm thu Turso tổng hợp lúc 05:19 UTC

`reports/database-remote-qa.json` ghi **8 PASS** trong165.269 ms trên DB QA tách riêng. Giữ nguyên UUID giáo viên/học sinh/lớp/bài/bài nộp, sync và ví sau khi đóng process ban đầu rồi mở process mới; digest canonical khớp. Hai process tranh cùng ví chỉ tạo một reservation, process còn lại nhận `CREDITS_INSUFFICIENT`; hoàn reservation không gọi provider giữ đúng số dư. FK và audit từ chối ghi, rollback giữ connection sạch. Không phải bằng chứng Render đã redeploy, backup/restore đã chạy, tải lớn hoặc học sinh thật.

12 thao tác giảng dạy đo từ máy này tới Tokyo: min4.719 ms, median8.154 ms, p95/max11.347 ms; health mới392 ms. Đây là latency của lượt tổng hợp có cả transaction/đọc trạng thái, không phải latency model hay cam kết SLA. Adapter vẫn chặn main thread có giới hạn; chỉ chấp nhận phạm vi preview nhỏ, chưa chứng minh khả năng mở rộng.

Các lượt thất bại ban đầu đã được giữ riêng, không gọi là PASS. Kiểm thử thật phát hiện và sửa:

- Schema từ xa đổi `!=` thành toán tử tương đương `<>`, thêm khoảng trắng quanh `RAISE`. Integrity giữ mọi token/literal/guard và chỉ chuẩn hóa hai toán tử tương đương;5 ca chống nới CHECK/trigger đã qua.
- Tên cột không quote `ACTION`/`KEY` được Turso viết hoa. Các projection cần `action`/`key` nay có alias quote tường minh; không lowercase toàn bộ kết quả hoặc thay quyền.4 ca SQLite thật tái hiện cột uppercase đã qua, gồm student join replay, audit/flag, billing replay và reopen không reseed.
- SDK pin0.5.29 bọc lỗi remote có cấu trúc trong chuỗi `Hrana(StreamError(Error {...}))`, để `error.code` rỗng. Chỉ parse toàn bộ envelope đúng dạng và whitelist mã SQL chắc chắn;15 assertion từ chối lỗi mạng, mã chung, envelope thiếu/sai/nối thêm và không lộ message. Lỗi transport/commit không rõ vẫn quarantine, không auto-retry/fallback. [Nguồn lỗi Rust tại bản pin](https://github.com/tursodatabase/libsql-js/blob/55bee86d1c284f1ddf2b9e280e870d2b6cef884a/src/errors.rs).

Hai khóa được operator chấp thuận riêng: production1 năm, QA7 ngày; lưu trong tệp riêng ngoài repo với ACL người dùng/SYSTEM. Không có khóa trong báo cáo, frontend, lệnh CLI hoặc Git. Production vẫn chưa có dữ liệu/biến Render; cần cổng cutover trong [CUTOVER-AUDIT.md](CUTOVER-AUDIT.md).

## Hiện trạng đã đối chiếu

- Runtime hiện dùng `node:sqlite` đồng bộ. `createStore()` mở một file; `transaction(fn)` chạy `BEGIN IMMEDIATE`, callback đồng bộ, rồi `COMMIT`, hoặc `ROLLBACK` khi lỗi (`lib/server/store.ts:93–110`).
- Hợp đồng integrity hiện có **schema 18, 51 bảng, 6 trigger bất biến**. 15 file trong `lib/server` tham chiếu kiểu `DatabaseSync`; tìm thấy 53 lời gọi `transaction(...)`. Đây là số đo phạm vi code, không phải số lượng người dùng hay kiểm thử.
- API database thực dùng là `prepare(sql).get/all/run(...args)`, `exec(sql)`, `close()`, kết quả `changes`; migration có nhiều statement, FK/CHECK/UNIQUE và trigger. Kiểm tra integrity đọc nguyên SQL từ `sqlite_schema`, không chỉ đếm tên bảng.
- Bản regional mặc định `.data/regional-preview.sqlite` và cho phép chế độ competition trên Render Free. Đây là file theo vòng đời máy chủ, chưa phải nơi lưu dữ liệu bền vững bên ngoài.
- Lớp, học liệu giáo viên, bài tập, bài nộp và lịch sử chấm không có TTL xóa theo thời gian. Snapshot đồng bộ và phiên Tutor có chính sách hết hạn riêng. Thay adapter không được âm thầm đổi các chính sách này.
- Tất cả 51 bảng phải cùng một database canonical: danh tính, membership, lớp, bài, ví/ledger, audit, session, job và idempotency. Chỉ chuyển bảng lớp ra xa sẽ làm mất các ràng buộc quyền và transaction xuyên bảng.
- `db/postgres` hiện chỉ chứa blueprint migration 001–003; không phải adapter PostgreSQL cho schema 18.

## Adapter ứng viên và phạm vi đã chứng minh

**Remote libSQL trực tiếp, không replica cục bộ và không đồng bộ snapshot định kỳ.** Thư viện chính thức `libsql` cung cấp API đồng bộ tương tự better-sqlite3, gồm kết nối `new Database(remoteURL, { authToken })`. Bản npm stable kiểm tra được là **0.5.29**, git nguồn **55bee86d1c284f1ddf2b9e280e870d2b6cef884a**, giấy phép MIT. Npm có native package cho Windows x64 và Linux x64 GNU/musl.

Nguồn native stable giữ một `libsql::Connection` dùng chung cho `prepare` và `execute_batch`; đường `new_remote` thực hiện truy vấn từ xa, không tạo file local. Điều này phù hợp với transaction tương tác đang có hơn phương án thay từng lệnh bằng HTTP độc lập. Đây là kết luận từ mã nguồn; **chưa phải kết quả kiểm thử remote của Lumio**.

### Rủi ro bắt buộc giải quyết trước khi chọn để deploy

1. **Timeout và event loop:** bản stable chặn event loop trong khi chờ network. `timeout` của constructor là busy timeout; libSQL Rust 0.9.30 bỏ qua busy timeout đối với remote. Không được quảng cáo nó là deadline HTTP. Cần chứng minh giới hạn chờ qua cấu hình transport được hỗ trợ hoặc kiến trúc cô lập có deadline; không dùng Promise.race để giả vờ hủy thao tác đồng bộ. Không lấy API `queryTimeout` từ nhánh prerelease 0.6 rồi cho rằng stable 0.5.29 hỗ trợ.
2. **Trạng thái connection sau lỗi:** server có thể đã commit nhưng client không nhận ACK. Không tự retry mù một mutation. Đóng/quarantine connection không rõ trạng thái, trả lỗi có thể kiểm tra lại; replay bằng request ID đã có chỉ được xác nhận sau khi đọc kết quả canonical. Không trả thành công từ cache hay file dự phòng.
3. **Transaction thật:** `BEGIN IMMEDIATE` → đọc quyền/revision → ghi → audit/idempotency → `COMMIT` phải ở cùng connection remote. Không thay bằng nhiều `client.execute()` độc lập. Transaction không bao quanh lời gọi AI/provider.
4. **Tính tương thích schema:** kiểm lại đủ migration 1–18, SQL schema/trigger nguyên bản, FK, JSON/text, số nguyên, BLOB, CHECK/UNIQUE, rollback và `changes`. Không bỏ các kiểm tra integrity để vượt một lỗi vendor.
5. **PRAGMA:** `foreign_keys` cần bật và được kiểm chứng. `journal_mode=WAL`/`busy_timeout` thuộc vận hành local; phải tách nhánh adapter rõ ràng, không giả vờ đã áp dụng trên remote.
6. **Độ trễ:** startup hiện đọc nhiều metadata bảng/trigger; từng `prepare/get` remote có thêm round-trip. Đo startup, đọc lớp nhiều thành viên và lưu bài; chỉ tối ưu bằng batch/read snapshot có giữ nguyên ngữ nghĩa và kiểm thử.
7. **Native runtime:** kiểm chứng Node 24, Next production build, native module trên đúng Linux Render và Windows phát triển. Không dùng kết quả local SQLite để tuyên bố remote đã đạt.

## Cách triển khai hiện tại và giới hạn vận hành

`DatabaseConnection` giữ đúng tập API SQL đang dùng. `createStore(filename, { database })` cho phép tiêm adapter; mặc định test/dev vẫn dùng `node:sqlite`. Factory server chọn đúng một mode, không dùng fallback.

Luồng remote: store đồng bộ → MessagePort/Atomics có deadline → Worker JavaScript → IPC riêng → **tiến trình con native libsql duy nhất**. Mỗi connection giữ một child/connection native; không tạo child mới cho từng query, không tự restart child hoặc phát lại SQL khi lỗi. Credential chuyển bằng private IPC, không nằm trong argv; broker/native child chỉ nhận biến môi trường OS/TLS được cho phép. Stdout/stderr của child được giữ ở pipe và bỏ, không chuyển lỗi native ra HTTP/log. Kết quả giữ BLOB và số nguyên 64-bit, chuẩn hóa BigInt an toàn về number và bỏ timing metadata của vendor bằng row/column mapping.

Thiết kế native trực tiếp trong Worker **đã bị loại**: test TCP im lặng cho thấy trả timeout ở main không làm native worker thoát. Báo cáo thất bại giữ riêng tại `reports/database-native-worker-before-child.json`. Thiết kế child mới ghi PID trước khi khởi tạo native; main và broker có thể kill đúng child đã tạo. Sau timeout, connection bị poison, không nhận thêm SQL; factory bootstrap lỗi bị khóa tới khi process restart. Healthy close chỉ ACK khi child thực sự thoát. Deadline/process exit bình thường dọn child; OS kill cứng toàn bộ host vẫn thuộc vòng đời container/host, không phải cam kết khôi phục transaction.

| Cấu hình server | Mặc định / ràng buộc |
| --- | --- |
| `LUMIO_DATABASE_MODE` | `local-sqlite` hoặc `remote-libsql`; giá trị lạ bị từ chối |
| `TURSO_DATABASE_URL` | Chỉ remote, URL libsql/HTTPS dưới `turso.io`, không userinfo/query/fragment/port |
| `TURSO_AUTH_TOKEN` | Chỉ server; bắt buộc remote; nếu có credential nhưng mode local thì từ chối |
| `LUMIO_DATABASE_RPC_TIMEOUT_MS` | 8.000 ms mặc định, 100–15.000 ms |
| `LUMIO_DATABASE_TRANSACTION_TIMEOUT_MS` | 15.000 ms mặc định, 100–30.000 ms cho toàn callback/transaction |
| `LUMIO_DATABASE_BOOTSTRAP_TIMEOUT_MS` | 60.000 ms mặc định, 100–120.000 ms cho toàn bootstrap |

Deadline có kiểm tra trước và sau nhận/deserialise ACK. Quá hạn mutation/COMMIT trả `DATABASE_WRITE_OUTCOME_UNKNOWN` (503); read timeout trả `DATABASE_TIMEOUT` (503); connection lỗi dùng lại trả `DATABASE_CONNECTION_POISONED` (503). Không rollback thêm trên connection đã poison. Nếu rollback sau lỗi callback cũng lỗi, giữ lỗi gốc. Chỉ lỗi SQL definite đã allowlist mới cho phép rollback và tiếp tục connection. Đây là cam kết **adapter Lumio không tự retry SQL**; không suy ra mọi chi tiết retry nội bộ của vendor khi chưa kiểm chứng nguồn/remote.

**Giới hạn rõ ràng:** Atomics.wait chặn event loop của tiến trình xử lý request trong khoảng chờ SQL. Deadline giới hạn từng RPC, toàn bootstrap và toàn transaction; chưa có deadline chung cho mọi read-only store method gồm nhiều query. Phù hợp ứng viên demo ít người dùng, chưa phải thiết kế đa instance/quy mô lớn. Không lấy độ trễ SQLite local làm tốc độ Turso. Snapshot schema được đọc mới mỗi lần integrity: vẫn so sánh đủ SQL 51 bảng/6 trigger và lịch sử migration; readiness hiện dùng 2 lượt đọc. Bootstrap schema18 đã hợp lệ dùng 8 thao tác SQL, không lặp 18 transaction rỗng. Bootstrap mới đo được 100 thao tác SQL, vẫn giữ transaction riêng cho từng migration.

## Bằng chứng local đã có

- `tests/v9-database.cjs`: **11 PASS**; native libsql0.5.29 thật qua child/IPC, schema18/FK/guard, identity, RBAC lớp, replay, credit/refund, Unicode/BLOB/int64, reopen; database tổng hợp trong thư mục tạm. Đo health2 reads và reopen8 SQL. Có regression chặn database ngoại lai tên bảng `sqlitex...` bị wildcard LIKE cũ nhận nhầm là bảng nội bộ.
- `tests/v9-database-review.cjs`: **14 PASS độc lập**; fault protocol trên SQLite thật, COMMIT thành công/mất ACK, credit+receipt atomic, process mới đọc canonical một lần, timeout/poison/factory latch. Có kết nối native tới TCP loopback im lặng và yêu cầu process thoát tự nhiên. Không phải test Turso/Internet.
- Preload `tests/v9-database-native-preload.cjs` chạy lại **181 checks**: admin18, auth9, billing14, teacher27, teaching49, sync17, jobs23, tutor24. Store dùng child bridge trên **file local tổng hợp**, helper inspect read-only giữ node:sqlite. WAL/busy timeout chỉ cấu hình cho local fixture; không giả vờ là behavior remote. Provider transport của các suite vẫn mock.
- Hai suite integrity/operations local **9 + 23 PASS** sau batch schema; giữ phát hiện guard bị sửa, schema giả/future/gapped và backup/restore riêng. Không phải backup Turso.
- `scripts/test-v9-database-remote.cjs --local-self-test`: **8 PASS**, chạy trước chính runner remote trên local fixture để kiểm tra nội dung thao tác và hai process. Không tính thành remote durability.
- TypeScript và production build đã pass. Build đầu tiên exit0 nhưng smoke standalone bắt được thiếu dependency native transitive; trace/static driver resolution đã sửa. Build lần hai exit0, `scripts/test-v9-database-standalone.cjs` **PASS** trên Windows x64: driver thật nằm trong standalone (không fallback node_modules source), child CREATE/INSERT/SELECT Unicode và thoát tự nhiên. Báo cáo `reports/database-standalone.json`. Build Windows vẫn có một cảnh báo copy symlink `@neon-rs/load`; artifact thực tế resolve và chạy được. Không suy ra Linux đã pass: Render cần cài platform package trong lock và chạy smoke Linux riêng. Build thành công một mình không chứng minh native runtime chạy được.

## Chạy QA từ xa có chủ đích

`scripts/test-v9-database-remote.cjs --remote` chỉ nhận hostname QA chính xác đã operator chọn (hard-coded trong runner), từ chối production hoặc bất kỳ host khác. Cần thêm `LUMIO_DATABASE_QA_CONFIRM=isolated-synthetic` bên cạnh ba biến mode/URL/token. Giữ file env riêng ngoài Git; không copy credential vào terminal/chụp hình/report. Không chạy runner trong aggregate unit test.

```powershell
node --env-file=<private-qa-env-path> scripts/test-v9-database-remote.cjs --remote
```

Runner tạo danh tính/lớp/bài nộp tổng hợp, kiểm RBAC, FK/guard, replay/CAS, hai process tranh ví, refund không gọi provider, rồi process mới đối chiếu digest canonical của teacher/student/submission/sync/wallet. Report `reports/database-remote-qa.json` chỉ chứa status/count/timing và mã lỗi đã làm sạch; không hostname, UUID, token, tên người hoặc nội dung. Không xóa hàng để “dọn” audit/ledger bất biến; DB QA riêng do operator quản lý. Một lần run fail dừng ngay, không đổi database hoặc retry mutation tự động.

## So sánh hướng chuyển đổi

| Hướng | Lợi ích | Điều còn phải làm |
| --- | --- | --- |
| `libsql` stable, remote trực tiếp | Giữ SQL SQLite, FK/trigger và phần lớn hợp đồng đồng bộ | Timeout/isolation, lỗi connection, ngữ nghĩa remote, latency và native build phải được chứng minh |
| `@libsql/client` async | API remote chính thức; có interactive transaction và batch atomic | Chuyển toàn bộ chuỗi query/callback store và caller sang async; giữ mọi kiểm tra quyền/CAS trong transaction; không phải đổi import là xong |
| PostgreSQL qua Supabase/Neon | Database ngoài host, transaction và hệ sinh thái vận hành phổ biến | Chuyển SQL/trigger/schema integrity, 51 bảng và async call graph; blueprint 001–003 chưa đủ; cần migration và kiểm thử riêng |
| File SQLite + upload định kỳ | Không chọn | Có thể mất thay đổi đã báo lưu; snapshot không giải quyết cạnh tranh ghi, ACK và khôi phục danh tính |

**Chưa đủ điều kiện xác nhận public durable.** Cổng remote riêng, hai client và độ trễ đã có kết quả ở đầu tài liệu. CI Linux của candidate trước đã đạt; delta runtime mới còn cần CI đúng commit. Sau đó vẫn cần quyết định cutover và nghiệm thu public qua redeploy; không đánh đổi dữ liệu đã xác nhận lưu để giảm số file sửa.

## Hợp đồng adapter cần giữ

- Một lựa chọn rõ ràng: `local-sqlite` cho dev/desktop, `remote-libsql` cho runtime durable nếu được chọn. Không tự fallback từ remote xuống SQLite local khi lỗi hoặc thiếu khóa.
- URL/token chỉ cấu hình server; URL phải TLS và đúng endpoint đã được operator chọn. Không nhận URL database từ request người dùng, không đưa token vào browser, log, ZIP, public health hoặc error JSON.
- Thông báo database không sẵn sàng phải fail closed, không tự tạo tài khoản/DB local mới. Trạng thái health chỉ báo mode, reachable và schema đã kiểm, không lộ user/content/host credential.
- Giữ nguyên SQL parameter binding, UUID và timestamp; lớp chuyển tiếp không nội suy giá trị vào SQL.
- Giao dịch remote thành công chỉ được trả về sau ACK commit. Lỗi không rõ commit phải được phân biệt với chắc chắn rollback; không nói “đã hoàn tác” nếu chưa có bằng chứng.
- Không thêm merchant hoặc thanh toán thật. Credit vẫn là ledger nội bộ; thay database không làm phát sinh cấp gói hoặc phí dịch vụ.

## Cổng kiểm thử trước khi dùng dữ liệu thật

1. **Tương thích local driver:** chạy schema integrity/migration, auth/link/revocation, teacher/class/assessment/submission, billing concurrency, sync replay/CAS, tutor/job suites trên adapter mới với DB tổng hợp dùng một lần.
2. **Remote tổng hợp riêng:** bootstrap đủ schema, đọc/ghi/rollback, FK/trigger từ chối, cạnh tranh hai client, CAS thắng đúng một lần, ledger không âm, idempotency cùng request ID chỉ ghi một lần.
3. **Fault injection:** lỗi trước commit, mất ACK sau commit, request bị ngắt, token sai, server không phản hồi, DB hết quota; không có fallback local hay false success; kết nối lỗi không được dùng lại như transaction sạch.
4. **Persistence:** process A ghi bài nháp/bài nộp tổng hợp, dừng process A và bỏ toàn bộ thư mục local tạm, process B mở cùng remote rồi đối chiếu UUID/row count/digest. Sau đó xác minh lại trên public sau một redeploy được phép.
5. **Quyền:** hai tài khoản/tổ chức không đọc được dữ liệu của nhau; membership hoặc session bị thu hồi không thể ghi bằng phiên cũ trong transaction đang kiểm tra.
6. **Linux build và độ trễ:** cài đúng lockfile, production build/typecheck, startup và mutation timeout. Ghi rõ remote/local và dữ liệu tổng hợp/thật trong báo cáo.

## Di chuyển và khôi phục

- Trước cutover, dừng ghi theo kế hoạch; nếu DB ephemeral cũ còn tồn tại thì xuất snapshot nhất quán trong vùng riêng được phép. Không đọc/đóng gói DB thật trong vòng kiểm toán này.
- Import phải giữ UUID người dùng, identity/provider-account ID, storage key, membership, quan hệ lớp/bài và ledger. Không tạo lại user bằng email rồi làm đứt foreign key hoặc tạo ví mới.
- Đối chiếu schema, số hàng và digest dữ liệu được phép; bật runtime remote chỉ sau restore rehearsal trên DB riêng thành công.
- Nếu DB cũ đã mất mà không có bản sao hợp lệ, không hứa khôi phục. Có thể giữ học liệu IndexedDB còn trong trình duyệt, nhưng nó không thay thế bảng server giáo viên/học sinh.
- Rollback app không được đổi database về file rỗng hoặc hạ schema bằng xóa migration. Giữ remote canonical và dùng runtime tương thích; nếu phải restore, công bố điểm khôi phục cùng dữ liệu sau thời điểm đó có thể mất.
- Backup chỉ ở kho riêng có kiểm soát quyền/mã hóa, không đưa plaintext snapshot vào repo, link public, bundle dự thi hoặc browser storage. Durability không thay cho backup.

## Giới hạn Free đã tra cứu

Turso công bố gói Free không cần thẻ, 5 GB storage, 500 triệu rows read/tháng và 10 triệu rows written/tháng tại thời điểm kiểm tra. Operator phải giữ gói Free và overages tắt; cần kiểm tra dashboard/điều kiện thực tế trước cấp phát. Không coi quota là SLA hoặc backup vô hạn. Supabase Free là phương án async PostgreSQL khác: tài liệu công bố 500 MB database/project và có thể pause khi ít hoạt động 7 ngày; pause không đồng nghĩa xóa file theo vòng đời Render. Báo cáo adapter này chưa xác nhận kết nối từ xa; việc cấp dịch vụ do operator quản lý riêng.

## Nguồn chính thức

- [libSQL JavaScript — remote API và giấy phép](https://github.com/tursodatabase/libsql-js)
- [npm metadata stable 0.5.29](https://registry.npmjs.org/libsql/0.5.29)
- [Native database implementation tại commit đã pin](https://github.com/tursodatabase/libsql-js/blob/55bee86d1c284f1ddf2b9e280e870d2b6cef884a/src/database.rs)
- [libSQL Rust 0.9.30 — remote connection implementation](https://docs.rs/libsql/0.9.30/src/libsql/hrana/hyper.rs.html)
- [Async client: execute, batch và transaction](https://tursodatabase.github.io/libsql-client-ts/interfaces/Client.html)
- [Turso pricing](https://turso.tech/pricing)
- [Supabase Free/billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
