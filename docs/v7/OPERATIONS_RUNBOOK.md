# V7 · Backup, nâng cấp và rollback schema16

Đây là hướng dẫn vận hành hiện hành. Kiểm thử dùng SQLite mẫu trên máy phát triển; **chưa sao lưu, nâng cấp hoặc rollback DB Render Free thực tế theo runbook này**. Bản public trước nâng cấp đang dùng schema13 theo kiểm tra của điều phối viên. Không suy ra phiên bản DB public từ source local.

DB chứa tài khoản, lịch sử học/điểm, bài nộp, nhận xét, credit và receipt. Không đưa DB/backup vào GitHub, thư mục web hoặc Drive minh chứng.

## Yêu cầu và phiên bản được nhận

- Dùng **Node.js24.x** (CLI đã kiểm trên24.19.0), source gồm scripts/database-snapshot.cjs và lib/server/database-integrity.ts. CLI dùng type stripping của Node24, không cần TypeScript compiler/API key.
- Inspect/backup/restore nhận **schema13,14,15,16 thật** theo canonical contract. Không tự migrate hoặc seed nguồn. History phải liên tiếp; cột/PK/UNIQUE/FK/CHECK và trigger phải khớp version. Đối tượng tương lai đã biết nhưng history chưa khai bị từ chối.

| Schema | Bảng | Định nghĩa theo version | Guard append-only |
| --- | ---: | ---: | ---: |
| 13 | 45 | 49 | 4 |
| 14 | 46 | 50 | 4 |
| 15 | 47 | 51 | 6 |
| 16 | 48 | 52 | 6 |

- Đích phải là file mới trong thư mục riêng. VACUUM INTO đọc dữ liệu WAL đã commit, rồi kiểm quick/FK/history/table/guard và tính SHA-256. Không thay DB đang chạy.
- Chmod0600 không thay kiểm tra ACL Windows. Chặn đường dẫn public hiện dựa lexical, chưa kiểm symlink/junction; dùng thư mục do người vận hành kiểm soát.
- Backup cùng ổ Render Free có thể mất cùng host. Chưa có lịch off-host backup, RPO/RTO đo được hoặc diễn tập mất host thật. Không ghi DR PASS từ kiểm tra local.

## Trước nâng cấp public13→16

1. Chốt source/artifact13 đang chạy và source16 dự định chạy, hash/version và cấu hình server riêng. Giữ artifact13 để rollback; **mô phỏng compiler giảm danh sách migration không phải artifact rollback đã kiểm chứng**.
2. Tạm ngưng worker bằng LUMIO_BACKGROUND_JOBS_DISABLED=true; ngừng ghi, đợi request kết thúc, rồi dừng/khởi động lại process theo kế hoạch. Đổi env không hủy ngay worker đang chạy. Giao dịch sau mốc backup chưa được giữ trong snapshot đó.
3. Dùng Node24/CLI mới nhận13 để inspect, backup và restore sang file riêng. Đường dẫn sau chỉ là ví dụ; phải xác định DB thật của môi trường:

~~~powershell
node scripts/database-snapshot.cjs inspect --source .data/regional-preview.sqlite
node scripts/database-snapshot.cjs backup --source .data/regional-preview.sqlite --out .backups/lumio-schema13-before-V7.sqlite
node scripts/database-snapshot.cjs inspect --source .backups/lumio-schema13-before-V7.sqlite
node scripts/database-snapshot.cjs restore --source .backups/lumio-schema13-before-V7.sqlite --out .backups/lumio-schema13-upgrade-check.sqlite
~~~

4. Giữ SHA-256/size và mốc thời gian ở bản ghi riêng; kiểm phân quyền và bản restore. Chọn tên mới nếu file đã tồn tại, không xóa backup cũ để ghi đè. Không cần gọi AI.
5. Kiểm nâng cấp trên **bản restore riêng** trước. Chỉ trỏ source16 vào copy13 khi process đó đã dừng. Startup áp migration14 receipt,15 lịch sử điểm và16 cửa sổ/lượt luyện tập. Đối chiếu account, issued snapshot/target, answer/grade/sync trước/sau. Actor/thời gian legacy không biết phải giữ null/legacy.
6. Sau khi copy kiểm thành công, thực hiện nâng DB môi trường thật theo maintenance plan. Startup từ chối history tương lai/có lỗ, bảng/guard sai trước write. Kiểm health schema16 và account/grade/receipt/sync/queue bằng tài khoản được phép.
7. Snapshot16 ra file mới, restore riêng và kiểm sáu guard/dữ liệu. Chỉ sau đó bật worker. Kiểm thử local không thay bước này; deployment/migration/backup thật cần bằng chứng riêng.

Genuine14/15 cũng inspect/backup/restore read-only rồi nâng **copy** lên16 tương tự. Không đổi history hoặc xóa đối tượng để biến16 thành13/14/15.

## Khi cần rollback16→artifact13

- Dừng process ghi/worker trước khi đổi LUMIO_DB_PATH. Giữ DB16 để điều tra; **không trỏ artifact13 vào DB16**.
- Restore snapshot13 đã inspect sang file riêng, dùng đúng artifact13/server config đã chốt. Không xóa history/table/trigger hoặc dựa health503 để ép code cũ chạy. Nếu rollback từ baseline14/15, dùng đúng artifact và snapshot tương ứng.
- Không copy chồng DB đang mở hoặc bỏ riêng WAL/shm của DB hoạt động. Restore snapshot trước nâng cấp bỏ giao dịch phát sinh sau mốc đó: ghi rõ cửa sổ dữ liệu mất và giữ DB16 để đối chiếu. Chưa có merge lịch sử tự động.
- Kiểm health/account/grade/sync/queue bằng artifact13 trước khi mở lại ghi. Không tự chạy lại lượt AI completed chỉ vì đầu ra đã mất.

## Bằng chứng được phép báo

**Hiện hành: node tests/v7-operations.cjs PASS21/21**,0 provider. Gồm19 kiểm tra schema16 trước đó và2 tương thích13 mới. DB thật được tạo bằng migrations1–13 và dữ liệu tổng hợp: inspect/backup/CLI restore giữ nguyên source bytes; chỉ copy13→16 migrate; row JSON của các bảng13 trước đó, gồm account/issued/submission/sync, giữ nguyên. History mới có một legacy_snapshot trung thực, không dựng actor/thời gian. Fake13 chứa receipt table14 bị từ chối inspect/backup/startup trước write.

Các kiểm tra còn lại gồm canonical48 bảng/52 định nghĩa,6 guard, future/gapped startup không đổi bytes/seed, bảng dummy/mất CHECK, rollback migration lỗi, WAL restore dữ liệu riêng và guard chặn UPDATE/DELETE, genuine14/15 backup chỉ đọc. Report hiện hành: [operations-integrity.json](reports/operations-integrity.json).

**Lịch sử:** [operations-integrity-schema15.json](reports/operations-integrity-schema15.json) giữ17 kiểm tra schema15 trước E2; [operations-audit.json](reports/operations-audit.json) giữ audit/checkpoint63 kiểm tra lúc đó. Không cộng lại checkpoint trùng nhau thành số kiểm tra mới.9 old operations,23 queue và14 runtime/sync là scope riêng tại checkpoint đã ghi; report21 không tự chứng minh tất cả vừa được chạy lại. Sau patch13,9 old operations đã được chạy riêng và kết quả phải đối chiếu log tương ứng.

Không có diễn tập production/off-host, thiết bị thật, tải thật, invoice reconciliation hoặc pentest trong các kiểm tra này.

## Credit, phí API và dữ liệu riêng

Credit giữ/hoàn là ledger nội bộ. Provider có thể tính phí dù app timeout, output bị loại, hủy hoặc rollback rồi hoàn credit. Fallback/queue retry có giới hạn nhưng một logical request có thể có nhiều provider attempts. Quota200/ngày không phải ngân sách USD tuyệt đối; missing telemetry/cost không nghĩa0đ. Thanh toán thật vẫn OFF.

Grade history, nhận xét và lý do chấm lại/luyện tập là dữ liệu riêng trong backup; không áp TTL7 ngày tutor/jobs và không hứa endpoint tự xóa chưa có. Chỉ dùng hồ sơ tổng hợp trong minh chứng công khai.
