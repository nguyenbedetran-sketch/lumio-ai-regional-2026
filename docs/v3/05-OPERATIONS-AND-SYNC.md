# V3.1 · Vận hành, đồng bộ và hồ sơ giáo viên

## Phạm vi hiện tại

Source web `3.1.0-regional.1` dùng SQLite WAL migration **1–11**. Runtime Render đã xác minh là commit **`6eabc3219f9298676bdd29ae0ee15a91b9593288`**, deployment `dep-db889c689jmc73ck1i70`, health ready200; [report](public-v31-teacher-check.json). Tài liệu được cập nhật sau phép thử public; các commit doc-only trong HEAD bàn giao không đổi runtime đã triển khai. Không dùng HEAD đó thay hash runtime trong report.

Máy chủ thi chạy một instance Render Free; cửa sổ hạn mức, lease AI, bản đồng bộ, chỉ mục RAG, checkpoint và hồ sơ/credential giáo viên nằm trong DB. Nhiều process chỉ phối hợp được khi dùng chung đúng tệp SQLite. **Chưa phải PostgreSQL hoặc hệ thống nhiều máy**. Không tự thêm dịch vụ trả phí; Render Free có thể ngủ hoặc đặt lại toàn bộ DB khi triển khai/khởi động lại. Form/queue được mở bằng OAuth thật, chưa tạo hay duyệt hồ sơ giáo viên thật.

Hạn mức AI: 15 lượt/phút, 150 lượt/ngày UTC, một lượt đang chạy/tài khoản; chế độ thi thêm 200 lượt/ngày UTC và ba lượt đồng thời toàn hệ thống. Tính lượt thử kể cả yêu cầu lỗi; credit giữ trước khi gọi và được hoàn khi lỗi theo ledger. Lease hết hạn giúp phục hồi process bị dừng. Đây không phải ngân sách tiền tuyệt đối.

## Đồng bộ có lựa chọn

Trong Cài đặt, người học bật đồng bộ rồi đối chiếu. GET/PUT/DELETE kiểm tra tài khoản chuẩn và phiên hiện hành; trình duyệt ràng buộc `X-Lumio-Account`, native ràng buộc bearer và `X-Lumio-User`. Không dùng email do client gửi để gộp tài khoản.

Bản chung gồm văn bản, ghi chú, thẻ, quiz, snapshot kỹ năng, lịch ôn, sự kiện và tùy chọn. Tối đa 100 học liệu/2 MiB. Không có byte tệp gốc, token, khóa AI, đồng hồ đang chạy hoặc âm thanh chuông. Schema được chuẩn hóa bằng danh sách trường cho phép.

Epoch ngẫu nhiên và revision giúp tránh ghi đè sau khi bản máy chủ bị xóa/hết hạn. Request ID ràng buộc nội dung hỗ trợ thử lại khi mất phản hồi; merge ba phía phát hiện sửa cùng bản ghi và xóa-versus-sửa. Người dùng lựa chọn khi có xung đột và có nút tải bản sao. Trình duyệt giữ outbox theo tài khoản; tự thử lại khi có mạng trong lúc bảng đồng bộ còn mở. Không khẳng định đồng bộ liên tục ở nền.

Bản máy chủ hết hiệu lực sau 7 ngày từ lần ghi cuối. Bản hết hạn và receipt được dọn khi có thao tác đồng bộ/AI phù hợp; máy chủ đang ngủ không có tác vụ bảo trì riêng. Tắt đồng bộ giữ bản máy chủ cho tới khi xóa hoặc hết hạn. Bản tệp gốc trên thiết bị được bảo vệ nếu bản nhận về thay đổi/xóa nguồn tương ứng. IndexedDB và localStorage không có một transaction chung; lỗi áp dụng phải giữ trạng thái phục hồi và không báo đã đồng bộ.

## Kiểm tra sức khỏe

`GET /api/health` trả status/version/mode, không trả người dùng, học liệu, token, đường dẫn hay cấu hình bí mật. Với source này, status `ready` yêu cầu migration11 và các bảng cần thiết, gồm `teacher_applications`, `teacher_credentials`, `teacher_application_operations`. Đây **không phải** xác nhận model AI trả lời đúng, đã gọi provider hoặc đã duyệt hồ sơ giáo viên thật. Khi triển khai, đối chiếu version **3.1.0-regional.1**, mode và đúng commit; AI/teacher được kiểm tra riêng bằng dữ liệu QA.

Admin hiện ghi provider/model, trạng thái, mã lỗi được chuẩn hóa, độ trễ, token và chi phí nếu nhà cung cấp thực sự trả metadata. Dữ liệu thiếu là null, không tính thành 0 hoặc hóa đơn. Không ghi prompt/tài liệu vào log vận hành. Transcript gia sư là dữ liệu ứng dụng có thời hạn, được phân quyền riêng. Chưa có dịch vụ giám sát bên ngoài, cảnh báo tự động hay số liệu tải trường học.

## Backup và restore cho người vận hành

Các tệp DB chứa dữ liệu riêng, gồm thông tin trường/địa phương/email công việc và ghi chú giáo viên nếu người dùng cung cấp: giữ ở thư mục riêng, không đưa vào GitHub, `public` hoặc gói minh chứng. Công cụ chỉ đọc DB nguồn và tạo tệp đích **mới**; không ghi đè DB đang chạy. `VACUUM INTO` tạo snapshot nhất quán bao gồm WAL đã commit, rồi kiểm tra integrity, foreign keys, đủ migration **1–11**, bảng cần thiết và SHA-256. Helper hiện từ chối schema không hỗ trợ; không xóa migration history để ép nó chấp nhận DB cũ.

```powershell
node scripts/database-snapshot.cjs backup --source .data/regional-preview.sqlite --out .backups/lumio-before-update.sqlite
node scripts/database-snapshot.cjs inspect --source .backups/lumio-before-update.sqlite
node scripts/database-snapshot.cjs restore --source .backups/lumio-before-update.sqlite --out .backups/lumio-restored.sqlite
```

Sau restore, người vận hành dừng máy chủ, kiểm tra bản khôi phục riêng, rồi cấu hình `LUMIO_DB_PATH` tới tệp đã xác minh và khởi động lại. Không có endpoint tải DB công khai. Backup nằm trên cùng ổ Render Free **vẫn có thể mất**; sao lưu bền vững bên ngoài chưa được bật. Kiểm thử backup/restore dùng DB tạm có tài khoản tổng hợp, không sao chép dữ liệu thật.

## Thiết lập và xét duyệt giáo viên

Feature này dùng OAuth/tài khoản và SQLite hiện có, không yêu cầu API trả phí mới. Bật đúng môi trường tài khoản; chế độ public UI-only không có backend này. Khởi động lại Node sau khi cập nhật store/migration để tránh singleton phát triển cũ thiếu phương thức mới.

1. Người phụ trách cấu hình `LUMIO_ADMIN_EMAILS` phía server bằng email Google quản trị đã xác minh, rồi đăng nhập lại. Không sửa role qua trình duyệt, không coi email tự khai là quyền admin. `ADMIN`/`SUPER_ADMIN` có `teachers.read`/`teachers.review`; `DEV` không đọc được hồ sơ.
2. Người đăng ký vào `/teacher`, điền tên, quốc gia/vùng lãnh thổ, tỉnh/thành, xã/phường, trường, cấp dạy và môn; chọn hai xác nhận. Email công việc/link HTTPS là tùy chọn. Dữ liệu địa phương là snapshot có phiên bản, có nhập tay; không lấy GPS/IP hoặc gọi API xác minh danh tính.
3. `/admin` → **Xét duyệt giáo viên** cho lọc/tìm/sắp xếp, mở hồ sơ và ghi lý do 8–300 ký tự trước duyệt/từ chối/thu hồi. Admin không tự duyệt hồ sơ của mình; phiên quản trị phải còn hiệu lực/gần đây.
4. Nếu hồ sơ thay đổi, CAS trả409; tải lại để xem revision mới trước quyết định. Request ID gắn payload giúp thử lại mất phản hồi không tạo thêm quyết định. Trạng thái/credential/operation/audit commit trong cùng transaction; role và phiên được kiểm tra lại ở server.

Credential này là **quyền ứng dụng do admin xét bản khai**, luôn `identityVerified:false`, không chứng nhận danh tính hoặc công tác chính thức. Nó không thay SystemRole, không tự tạo tổ chức/membership, không cấp quyền đọc thư viện/hội thoại học sinh. Lớp học, giao bài, sổ điểm và phân tích học sinh chưa triển khai.

Hồ sơ/credential được giữ như dữ liệu tài khoản; module hiện **không có tự hết hạn bảy ngày hoặc endpoint tự xóa hồ sơ**. Xóa local, sync hay chỉ mục không xóa bản khai giáo viên. Người phụ trách dự án xử lý yêu cầu dữ liệu; không hứa cơ chế erasure chưa có. Audit chỉ ghi ID/trạng thái/revision/quyết định, không lưu nguyên văn hồ sơ hoặc ghi chú xét duyệt vào metadata. Free-host reset có thể mất hồ sơ và quyền.

Xem [backend và 27 kiểm tra](08-TEACHER-BACKEND.md), [dữ liệu địa phương](09-LOCATION-DATA.md). Kiểm tra API/SQLite dùng dữ liệu tổng hợp; không thay xác minh giáo viên thật, UI hay bản public.

## Triển khai và hoàn tác

1. Chốt source, chạy typecheck, test, audit và build; kiểm thử route đã compile.
2. Chỉ stage source đã quét bí mật, không `.env.local`, `.data`, DB hoặc bản build cũ.
3. Push commit, deploy đúng commit ở Render Free, xác minh health/version/schema11, Google OAuth và AI thật; kiểm tra teacher API/UI riêng trước khi nói feature public đã chạy.
4. Nếu lỗi, chọn commit/tag đã xác minh trước đó để deploy lại. Tag rollback V2: `v2.0.1-regional-verified`. Migration V3/V3.1 thêm bảng; không chạy down-migration phá dữ liệu. Build cũ có thể từ chối readiness/schema11; với dữ liệu cần giữ, chuẩn bị DB tương thích/snapshot riêng trước khi đổi phiên bản. Không chạy build cũ rồi xóa bảng/history cho vừa.
5. Chỉ nộp cổng thi một lần sau V2 + V3 và minh chứng cuối đã được kiểm tra.

## Trạng thái bằng chứng

- PASS: operations schema11 **9 kiểm tra** trong SQLite độc lập, gồm backup/restore thật và công cụ từ chối đích công khai/ghi đè. Các suite CAS/idempotency/epoch và hạn mức hai store cùng tệp được giữ lại trong chuỗi `pnpm test` **600 PASS**.
- PASS trong fixture: teacher API **27**, dữ liệu địa phương **9**, browser sync **31**; UI teacher admin **31 +3 SSR**, self **43 +4 SSR**. [Compiled15 PASS](production-compiled-report.json) chạy install/build sạch, route/workers thật và JWT/DB tổng hợp; không là provider OAuth.
- PASS theo phạm vi public3.1: [Google OAuth/form/queue rỗng](public-v31-teacher-check.json), [HTTP401/403](public-v31-http-check.json), [bốn lượt tutor/khóa/Toán và trích nguồn](public-v31-live-check.json). Không có hồ sơ/decision giáo viên thật. Candidate/domain/completeness có xác minh chính xác trong phạm vi hỗ trợ; bước giải chỉ một phần, số học hiển thị chưa kiểm tra. Hybrid/PDF thậtV3.0 nằm ở [report riêng](public-v3-live-check.json), không tính là request mới củaV3.1.
- PARTIAL: offline/đồng bộ prototype; ứng dụng Flutter snapshot web riêng; hosting thi miễn phí.
- NOT TESTED: nhiều máy/PostgreSQL, học sinh thật, thiết bị Android/iOS thật, tải toàn trường, sao lưu ngoài host và phục hồi sau sự cố Render thực tế.
- Chủ động chưa mở: thanh toán thật, webhook thực, App Store/Google Play phát hành mới. Giá đề xuất đã chọn **59.000đ/129.000đ/249.000đ mỗi tháng**; bản thi không thu tiền/cấp ví trả phí.

Nộp bài cuối vẫn chờ hoàn tất gói/source/Drive và xác nhận cổng. Cập nhật tài liệu sau runtime không tự phát sinh một lần deploy mới hoặc một lần nộp.
