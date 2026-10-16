# V7 · Backup, nâng cấp và rollback schema17

Đây là hướng dẫn vận hành hiện hành. Kiểm thử dùng SQLite mẫu trên máy phát triển; **chưa sao lưu, nâng cấp hoặc rollback DB Render Free thực tế theo runbook này**. Bản public trước nâng cấp đang dùng schema13 theo kiểm tra của điều phối viên. Không suy ra phiên bản DB public từ source local.

DB chứa tài khoản, lịch sử học/điểm, bài nộp, nhận xét, credit, receipt và journal metadata từng provider dispatch. ID liên kết tài khoản vẫn là dữ liệu riêng; không đưa DB/backup vào GitHub, thư mục web hoặc Drive minh chứng. Journal không lưu prompt/source/raw output, nhưng điều đó không làm cả backup trở thành dữ liệu công khai.

## Yêu cầu và phiên bản được nhận

- Dùng **Node.js24.x** (CLI đã kiểm trên24.19.0), source gồm scripts/database-snapshot.cjs và lib/server/database-integrity.ts. CLI dùng type stripping của Node24, không cần TypeScript compiler/API key.
- Inspect/backup/restore nhận **schema13,14,15,16,17 thật** theo canonical contract. Không tự migrate hoặc seed nguồn. History phải liên tiếp; cột/PK/UNIQUE/FK/CHECK và trigger phải khớp version. Đối tượng tương lai đã biết nhưng history chưa khai bị từ chối.

| Schema | Bảng | Định nghĩa theo version | Guard append-only |
| --- | ---: | ---: | ---: |
| 13 | 45 | 49 | 4 |
| 14 | 46 | 50 | 4 |
| 15 | 47 | 51 | 6 |
| 16 | 48 | 52 | 6 |
| 17 | 49 | 53 | 6 |

- Đích phải là file mới trong thư mục riêng. VACUUM INTO đọc dữ liệu WAL đã commit, rồi kiểm quick/FK/history/table/guard và tính SHA-256. Không thay DB đang chạy.
- Chmod0600 không thay kiểm tra ACL Windows. Chặn đường dẫn public hiện dựa lexical, chưa kiểm symlink/junction; dùng thư mục do người vận hành kiểm soát.
- Backup cùng ổ Render Free có thể mất cùng host. Chưa có lịch off-host backup, RPO/RTO đo được hoặc diễn tập mất host thật. Không ghi DR PASS từ kiểm tra local.

## Trước nâng cấp public13→17

1. Chốt source/artifact13 đang chạy và source17 dự định chạy, hash/version và cấu hình server riêng. Giữ artifact13 để rollback; **mô phỏng compiler giảm danh sách migration không phải artifact rollback đã kiểm chứng**. Kiểm tra phiên bản thật của môi trường trước bảo trì; nếu baseline đã khác13, dùng đúng snapshot/artifact của baseline đó.
2. Tạm ngưng worker bằng LUMIO_BACKGROUND_JOBS_DISABLED=true; ngừng ghi, đợi request kết thúc, rồi dừng/khởi động lại process theo kế hoạch. Đổi env không hủy ngay worker đang chạy. Giao dịch sau mốc backup chưa được giữ trong snapshot đó.
3. Dùng Node24/CLI mới nhận13 để inspect, backup và restore sang file riêng. Đường dẫn sau chỉ là ví dụ; phải xác định DB thật của môi trường:

~~~powershell
node scripts/database-snapshot.cjs inspect --source .data/regional-preview.sqlite
node scripts/database-snapshot.cjs backup --source .data/regional-preview.sqlite --out .backups/lumio-schema13-before-V7.sqlite
node scripts/database-snapshot.cjs inspect --source .backups/lumio-schema13-before-V7.sqlite
node scripts/database-snapshot.cjs restore --source .backups/lumio-schema13-before-V7.sqlite --out .backups/lumio-schema13-upgrade-check.sqlite
~~~

4. Giữ SHA-256/size và mốc thời gian ở bản ghi riêng; kiểm phân quyền và bản restore. Chọn tên mới nếu file đã tồn tại, không xóa backup cũ để ghi đè. Không cần gọi AI.
5. Kiểm nâng cấp trên **bản restore riêng** trước. Chỉ trỏ source17 vào copy13 khi process đó đã dừng. Startup áp migration14 receipt,15 lịch sử điểm,16 cửa sổ/lượt luyện tập và17 journal metadata. Đối chiếu account, issued snapshot/target, answer/grade/sync trước/sau. Actor/thời gian legacy không biết phải giữ null/legacy; journal mới không tự dựng lại attempts từ outcome cũ.
6. Sau khi copy kiểm thành công, thực hiện nâng DB môi trường thật theo maintenance plan. Startup từ chối history tương lai/có lỗ, bảng/guard sai trước write. Kiểm health schema17 và account/grade/receipt/sync/queue bằng tài khoản được phép. Health không xác nhận AI đúng hoặc invoice đầy đủ.
7. Snapshot17 ra file mới, restore riêng và đối chiếu journal cùng dữ liệu/sáu guard. Chỉ sau đó bật worker. Kiểm thử local không thay bước này; deployment/migration/backup thật cần bằng chứng riêng. Chưa có kết luận full regression/build/public mới trong runbook này.

Genuine14/15/16 cũng inspect/backup/restore read-only rồi nâng **copy** lên17 tương tự. Không đổi history hoặc xóa đối tượng để biến17 thành13/14/15/16.

## Khi cần rollback17→artifact13 hoặc baseline đã giữ

- Dừng process ghi/worker trước khi đổi LUMIO_DB_PATH. Giữ DB17 để điều tra; **không trỏ artifact13/14/15/16 vào DB17**.
- Restore snapshot13 đã inspect sang file riêng, dùng đúng artifact13/server config đã chốt. Không xóa history/table/trigger hoặc dựa health503 để ép code cũ chạy. Nếu baseline14/15/16, dùng đúng artifact và snapshot tương ứng.
- Không copy chồng DB đang mở hoặc bỏ riêng WAL/shm của DB hoạt động. Restore snapshot trước nâng cấp bỏ giao dịch phát sinh sau mốc đó, gồm metadata/credit/bài nộp mới: ghi rõ cửa sổ dữ liệu mất và giữ DB17 để đối chiếu. Chưa có merge lịch sử tự động.
- Kiểm health/account/grade/sync/queue bằng artifact13 trước khi mở lại ghi. Không tự chạy lại lượt AI completed chỉ vì đầu ra đã mất.

## Bằng chứng được phép báo

**Hiện hành: node tests/v7-operations.cjs PASS23/23**,0 provider. Nguồn genuine13/14/15/16 được inspect/backup read-only; chỉ restored copy nâng17. Fixture13 có account/issued/submission/sync tổng hợp, giữ nguyên source bytes và row JSON cũ; legacy_snapshot không dựng actor/thời gian. Copy16 nâng17 có journal mới rỗng. Fake13 chứa receipt14 hoặc fake16 còn journal17 bị từ chối trước write.

Các kiểm tra còn lại gồm canonical49 bảng/53 định nghĩa,6 guard, future/gapped startup không đổi bytes/seed, bảng dummy/mất CHECK, rollback migration lỗi, WAL restore giữ journal/grade/receipt/sync/ledger và guard chặn UPDATE/DELETE. Report hiện hành: [operations-integrity.json](reports/operations-integrity.json). Journal là prepare→terminal CAS có retention, không thuộc sáu guard append-only của audit/credit/grade history.

**Lịch sử:** [operations-integrity-schema16.json](reports/operations-integrity-schema16.json) giữ21 kiểm tra checkpoint16; [operations-integrity-schema15.json](reports/operations-integrity-schema15.json) giữ17 kiểm tra15; [operations-audit.json](reports/operations-audit.json) giữ audit/checkpoint63 lúc đó. Không cộng checkpoint trùng thành test mới.9 old operations và23 queue đã chạy riêng sau17, nhưng report ops23 không tự chứng minh mọi test/build đã chạy lại; đối chiếu đúng log.

Không có diễn tập production/off-host, thiết bị thật, tải thật, invoice reconciliation hoặc pentest trong các kiểm tra này.

## Credit, phí API và dữ liệu riêng

Credit giữ/hoàn là ledger nội bộ. Provider có thể tính phí dù app timeout, output bị loại, hủy hoặc rollback rồi hoàn credit. Fallback/queue retry có giới hạn nhưng một logical request có thể có nhiều provider attempts. Quota200/ngày không phải ngân sách USD tuyệt đối; missing telemetry/cost không nghĩa0đ. Thanh toán thật vẫn OFF.

Grade history, nhận xét và lý do chấm lại/luyện tập là dữ liệu riêng trong backup; không áp TTL7 ngày tutor/jobs và không hứa endpoint tự xóa chưa có. Chỉ dùng hồ sơ tổng hợp trong minh chứng công khai.

## Journal17, retention và dung lượng

[F02a1](PROVIDER_ATTEMPT_ACCEPTANCE.md) chỉ instrument routeAI text/multimodal của learner/teacher/summary jobs; embedding/voice và lịch sử cũ chưa được backfill. Requested model và response model riêng; token thiếu là null,0 chỉ khi quan sát0. Giá chưa được duyệt nên estimated_cost_usd luôn null; metadata không là hóa đơn hay sổ credit.

Terminal quá 31 ngày được dọn theo truy cập, tối đa 200 row/prepare, có index. Không có scheduler xóa đúng hạn; ít truy cập có thể lưu lâu hơn. Purge có auth/hold check rồi commit riêng, tiếp theo transaction kiểm lại và cấp ordinal/insert. Không purge unresolved/ledger/receipts: 64 unresolved/account, 2048 toàn DB, 100000 tổng row. Hết slot thì từ chối trước fetch; chưa có endpoint tự giải quyết uncertain và không được phát lại API chỉ để lấy usage.

Admin → Hoạt động AI có hai scope: **Kết quả yêu cầu** và **Từng lần gọi AI**. Cửa sổ7/14/31 ngày là cohort theo prepared_at; **bản ghi được giữ đầu tiên không phải ngày bắt đầu instrumentation**. Khối dung lượng đếm mọi tuổi, gồm unresolved ngoài cửa sổ đang xem; không so count trong31 ngày với cap toàn DB rồi kết luận còn chỗ. Quyền/canonical account/no-store vẫn áp dụng. Xem [review guide](REVIEW_GUIDE.vi.md#4-báo-cáo-quản-trị-mới) và [phạm vi observability](USAGE_OBSERVABILITY.md).

Có thể chạy riêng fixture UI bằng pnpm test:v7:usage-ui; đó là React/CSS/HTTP tổng hợp có nhãn, không gọi provider hoặc chứng minh public/production.
