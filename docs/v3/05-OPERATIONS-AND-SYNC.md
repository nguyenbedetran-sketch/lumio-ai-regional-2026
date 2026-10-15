# V3 · Vận hành và đồng bộ

## Phạm vi hiện tại

Máy chủ thi chạy một instance Render Free. SQLite WAL có migration 1–10; cửa sổ hạn mức, lease AI, bản đồng bộ, chỉ mục RAG và checkpoint công việc cùng nằm trong DB. Nhiều process chỉ phối hợp được khi dùng chung đúng tệp SQLite. **Chưa phải PostgreSQL hoặc hệ thống nhiều máy**. Không tự thêm dịch vụ trả phí; Render Free có thể ngủ hoặc đặt lại toàn bộ DB khi triển khai/khởi động lại.

Hạn mức AI: 15 lượt/phút, 150 lượt/ngày UTC, một lượt đang chạy/tài khoản; chế độ thi thêm 200 lượt/ngày UTC và ba lượt đồng thời toàn hệ thống. Tính lượt thử kể cả yêu cầu lỗi; credit giữ trước khi gọi và được hoàn khi lỗi theo ledger. Lease hết hạn giúp phục hồi process bị dừng. Đây không phải ngân sách tiền tuyệt đối.

## Đồng bộ có lựa chọn

Trong Cài đặt, người học bật đồng bộ rồi đối chiếu. GET/PUT/DELETE kiểm tra tài khoản chuẩn và phiên hiện hành; trình duyệt ràng buộc `X-Lumio-Account`, native ràng buộc bearer và `X-Lumio-User`. Không dùng email do client gửi để gộp tài khoản.

Bản chung gồm văn bản, ghi chú, thẻ, quiz, snapshot kỹ năng, lịch ôn, sự kiện và tùy chọn. Tối đa 100 học liệu/2 MiB. Không có byte tệp gốc, token, khóa AI, đồng hồ đang chạy hoặc âm thanh chuông. Schema được chuẩn hóa bằng danh sách trường cho phép.

Epoch ngẫu nhiên và revision giúp tránh ghi đè sau khi bản máy chủ bị xóa/hết hạn. Request ID ràng buộc nội dung hỗ trợ thử lại khi mất phản hồi; merge ba phía phát hiện sửa cùng bản ghi và xóa-versus-sửa. Người dùng lựa chọn khi có xung đột và có nút tải bản sao. Trình duyệt giữ outbox theo tài khoản; tự thử lại khi có mạng trong lúc bảng đồng bộ còn mở. Không khẳng định đồng bộ liên tục ở nền.

Bản máy chủ hết hiệu lực sau 7 ngày từ lần ghi cuối. Bản hết hạn và receipt được dọn khi có thao tác đồng bộ/AI phù hợp; máy chủ đang ngủ không có tác vụ bảo trì riêng. Tắt đồng bộ giữ bản máy chủ cho tới khi xóa hoặc hết hạn. Bản tệp gốc trên thiết bị được bảo vệ nếu bản nhận về thay đổi/xóa nguồn tương ứng. IndexedDB và localStorage không có một transaction chung; lỗi áp dụng phải giữ trạng thái phục hồi và không báo đã đồng bộ.

## Kiểm tra sức khỏe

`GET /api/health` trả status/version/mode, không trả người dùng, học liệu, token, đường dẫn hay cấu hình bí mật. Status `ready` kiểm tra schema và bảng cần thiết; đây **không phải** xác nhận model AI trả lời đúng hoặc đã gọi thử nhà cung cấp. Render dùng `/api/health` sau khi triển khai V3. AI thật được kiểm tra riêng bằng một học liệu tự soạn trên bản public.

Admin hiện ghi provider/model, trạng thái, mã lỗi được chuẩn hóa, độ trễ, token và chi phí nếu nhà cung cấp thực sự trả metadata. Dữ liệu thiếu là null, không tính thành 0 hoặc hóa đơn. Không ghi prompt/tài liệu vào log vận hành. Transcript gia sư là dữ liệu ứng dụng có thời hạn, được phân quyền riêng. Chưa có dịch vụ giám sát bên ngoài, cảnh báo tự động hay số liệu tải trường học.

## Backup và restore cho người vận hành

Các tệp DB chứa dữ liệu riêng: giữ ở thư mục riêng, không đưa vào GitHub, `public` hoặc gói minh chứng. Công cụ chỉ đọc DB nguồn và tạo tệp đích **mới**; không ghi đè DB đang chạy. `VACUUM INTO` tạo snapshot nhất quán bao gồm WAL đã commit, rồi kiểm tra integrity, foreign keys, schema và SHA-256.

```powershell
node scripts/database-snapshot.cjs backup --source .data/regional-preview.sqlite --out .backups/lumio-before-update.sqlite
node scripts/database-snapshot.cjs inspect --source .backups/lumio-before-update.sqlite
node scripts/database-snapshot.cjs restore --source .backups/lumio-before-update.sqlite --out .backups/lumio-restored.sqlite
```

Sau restore, người vận hành dừng máy chủ, kiểm tra bản khôi phục riêng, rồi cấu hình `LUMIO_DB_PATH` tới tệp đã xác minh và khởi động lại. Không có endpoint tải DB công khai. Backup nằm trên cùng ổ Render Free **vẫn có thể mất**; sao lưu bền vững bên ngoài chưa được bật. Kiểm thử backup/restore dùng DB tạm có tài khoản tổng hợp, không sao chép dữ liệu thật.

## Triển khai và hoàn tác

1. Chốt source, chạy typecheck, test, audit và build; kiểm thử route đã compile.
2. Chỉ stage source đã quét bí mật, không `.env.local`, `.data`, DB hoặc bản build cũ.
3. Push commit, deploy đúng commit ở Render Free, xác minh health, Google OAuth và một yêu cầu AI thật.
4. Nếu lỗi, chọn commit/tag đã xác minh trước đó để deploy lại. Tag rollback V2: `v2.0.1-regional-verified`. Migration V3 thêm bảng; không chạy down-migration phá dữ liệu. Với dữ liệu cần giữ, khôi phục snapshot riêng trước khi đổi DB.
5. Chỉ nộp cổng thi một lần sau V2 + V3 và minh chứng cuối đã được kiểm tra.

## Trạng thái bằng chứng

- PASS: kiểm tra SQLite độc lập, CAS/idempotency/epoch, hạn mức hai store cùng tệp; backup/restore thực và công cụ từ chối đích công khai/ghi đè.
- PARTIAL: offline/đồng bộ prototype; ứng dụng Flutter snapshot web riêng; hosting thi miễn phí.
- NOT TESTED: nhiều máy/PostgreSQL, học sinh thật, thiết bị Android/iOS thật, tải toàn trường, sao lưu ngoài host và phục hồi sau sự cố Render thực tế.
- Chưa mở: thanh toán thật, webhook thực, App Store/Google Play phát hành mới.
