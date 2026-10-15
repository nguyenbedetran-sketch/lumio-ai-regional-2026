# Lumio Admin Console

Mở `http://127.0.0.1:3000/admin` sau khi chạy ứng dụng. Đây là trang quản trị có dữ liệu thật và kiểm tra quyền ở máy chủ, không phải dashboard minh họa.

## Cấp quyền đầu tiên

Trong `.env.local`, đặt `LUMIO_ADMIN_EMAILS` bằng email Google của người quản trị. Nhiều email được ngăn cách bằng dấu phẩy. File này chỉ nằm trên máy chủ, không đưa vào Git hoặc ZIP.

Đăng nhập lại bằng Google qua nút trên trang `/admin`. Chỉ phản hồi OAuth Google có `email_verified: true` và email khớp chính xác danh sách máy chủ mới cấp `SUPER_ADMIN`. Tài khoản đầu tiên, email Facebook, email từ trình duyệt, JWT cũ và email chưa xác thực đều không tự có quyền quản trị. Đối sánh không phân biệt hoa thường nhưng không chấp nhận tên miền hoặc email gần giống.

Phiên quản trị yêu cầu lần đăng nhập OAuth trong vòng **1 giờ**. Phiên học thông thường vẫn theo thời hạn của NextAuth. Mỗi yêu cầu quản trị đọc lại người dùng từ database để kiểm tra tạm khóa, phiên bị thu hồi và quyền hiện tại. MFA riêng cho quản trị chưa được triển khai; cần bổ sung trước môi trường công khai có dữ liệu quan trọng.

## Các chức năng hoạt động

- Tổng số tài khoản, đang hoạt động/tạm khóa, tài khoản mới 7 ngày.
- Số yêu cầu AI, lỗi, độ trễ trung bình, biểu đồ 14 ngày UTC từ log máy chủ.
- Token và chi phí chỉ có khi metadata thực được cung cấp. Không có metadata được hiển thị là `—`, không biến thành số 0 hoặc doanh thu giả.
- Tìm tài khoản theo tên/email; phân trang 30 tài khoản.
- Tạm khóa, mở khóa và thu hồi phiên: có lý do và nhật ký trong cùng transaction. Không xóa người dùng hay tài liệu.
- Bảo vệ tài khoản của chính người thao tác và người quản trị cuối cùng. ADMIN chỉ có thể tác động tài khoản USER; SUPER_ADMIN mới được quản lý tài khoản đặc quyền khác.
- Công tắc máy chủ `ai.enabled`, `ai.voice`, `accounts.linking`; chỉ SUPER_ADMIN được sửa.
- Nhật ký kiểm toán phân trang, xem người thực hiện, mục tiêu, trước/sau và request ID. SQLite trigger từ chối UPDATE/DELETE nhật ký.
- Console không cung cấp chức năng xem hội thoại hay tài liệu riêng tư của học sinh.

Không có dữ liệu mẫu được thêm khi khởi tạo. Số người dùng ban đầu là 0 cho đến khi đăng nhập thật. Số lượt AI xuất hiện khi backend thực sự ghi nhận yêu cầu.

## Quyền và phạm vi

Quyền được định nghĩa trong `lib/server/policy.ts`, tách riêng khỏi role. `can(actor, permission, resource)` kiểm tra trạng thái tài khoản, grant và scope:

| Role        | Quyền hệ thống                                                         |
| ----------- | ---------------------------------------------------------------------- |
| USER        | Không truy cập admin                                                   |
| DEV         | Đọc trạng thái hệ thống, usage AI, feature flags                       |
| ADMIN       | Các quyền đọc trên, người dùng, audit, tạm khóa/thu hồi phiên của USER |
| SUPER_ADMIN | Các quyền trên, cập nhật flags và grant quản lý role                   |

Scope `SELF` chỉ cho chủ sở hữu đọc/sửa dữ liệu học; ngay cả ADMIN không mặc nhiên đọc dữ liệu học của người khác. `ORGANIZATION` chỉ cấp `members.read` cho OWNER/SCHOOL_ADMIN của đúng organization. Membership không tự cấp quyền đọc hội thoại; classroom và parent relationship cần policy riêng khi triển khai. Schema đã có organizations/memberships nhưng chưa có UI quản lý trường/lớp.

Role-management API/UI chưa được cung cấp. Permission `users.roles.update` là grant chuẩn bị cho module tiếp theo, không có nút giả để tự cấp role.

## Danh tính và liên kết Google/Facebook

`ensureIdentity()` tạo user canonical và giữ `storageKey` từ provider đầu tiên, để tiếp tục đọc thư viện IndexedDB đã có. Email trùng nhau không tự gộp tài khoản.

Liên kết bắt đầu từ một phiên hợp lệ đã đăng nhập gần đây. Server tạo token ngẫu nhiên 32 byte, chỉ lưu SHA-256 trong database; cookie HttpOnly giữ token và NextAuth xác nhận quyền sở hữu danh tính thứ hai qua OAuth. Token ràng buộc user/provider, dùng một lần, hết hạn sau 10 phút. Nếu danh tính đã thuộc user khác, thao tác bị từ chối để tránh chiếm tài khoản hoặc làm mất dữ liệu. Gộp hai tài khoản đã tồn tại cần luồng chuyển dữ liệu riêng, chưa có trong bản này.

Không lưu access token, refresh token, client secret hoặc API key trong database. Audit và usage không lưu câu hỏi, nội dung tải lên hay câu trả lời AI.

## Lưu trữ hiện tại và triển khai

Adapter hiện chạy bằng `node:sqlite` của Node.js **24.19+**, không cần dịch vụ trả phí. Database mặc định: `.data/lumio.sqlite`; có thể đặt `LUMIO_DB_PATH` bằng đường dẫn tuyệt đối tới thư mục riêng trên máy chủ. WAL, foreign keys, busy timeout, prepared statements, migration version và transaction được bật.

SQLite này phù hợp **một máy chủ với ổ đĩa bền vững**. Nó không phải cloud sync cho tài liệu IndexedDB. Không dùng file SQLite trên filesystem tạm của serverless hay nhiều replica. Khi `NODE_ENV=production`, ứng dụng từ chối mở database nếu thiếu cả `LUMIO_DB_PATH` và `LUMIO_ALLOW_LOCAL_DB_PRODUCTION=true`.

`db/postgres/001_platform.sql` là migration PostgreSQL chuẩn bị cho adapter cloud. **Chưa có adapter PostgreSQL chạy thật**: đặt `DATABASE_URL` đơn thuần không làm ứng dụng sử dụng PostgreSQL. Trước khi triển khai free host, cần bổ sung query/transaction adapter, kiểm tra cạnh tranh, quyền database, phân tách tenant và backup/restore. Không xóa safeguard SQLite để chạy tạm trên serverless.

Backup local: dừng server sạch rồi sao lưu toàn bộ `.data` bằng công cụ file thông thường. Không gửi database này cùng source ZIP vì chứa email và log thật. Restore phải được thử ở thư mục biệt lập trước khi thay database đang sử dụng. Chưa có lịch backup tự động hoặc cơ chế DR đã kiểm chứng.

## API

Tất cả route `/api/admin/*` yêu cầu session hợp lệ, `admin.read`, thời điểm xác thực dưới 1 giờ và permission tương ứng. Response có `Cache-Control: private, no-store` và `X-Content-Type-Options: nosniff`. Không trả chi tiết database lỗi cho client.

| Endpoint                       | Method | Permission / nội dung                                                                                     |
| ------------------------------ | ------ | --------------------------------------------------------------------------------------------------------- |
| `/api/admin`                   | GET    | Tổng quan; chỉ trả user/audit nếu có quyền                                                                |
| `/api/admin/users?q=&offset=0` | GET    | `users.read`; tìm và phân trang 30                                                                        |
| `/api/admin/users`             | PATCH  | `users.suspend` hoặc `users.sessions.revoke`; `{userId, action: "disable" / "enable" / "revoke", reason}` |
| `/api/admin/flags`             | PATCH  | `features.update`; `{key, enabled}`                                                                       |
| `/api/admin/audit?offset=0`    | GET    | `audit_logs.read`; 40 sự kiện                                                                             |
| `/api/admin/usage?offset=0`    | GET    | `ai.usage.read`; 30 sự kiện                                                                               |

PATCH yêu cầu `Origin` khớp origin `NEXTAUTH_URL`, `application/json`, body tối đa 4 KB, kiểu dữ liệu hợp lệ. Request ID được trả ở lỗi. `401` = cần đăng nhập lại; `403` = thiếu quyền/origin không hợp lệ; `409` = xung đột/bảo vệ tài khoản; `503` = nền tảng chưa sẵn sàng. Giới hạn request riêng cho admin chưa có; cần bổ sung giới hạn phân tán trước production.

## Kiểm tra

Chạy `node tests/admin.cjs`. Suite tạo database tạm riêng và xóa database đó sau khi chạy; không thay đổi dữ liệu người dùng. Các kiểm tra gồm bootstrap admin, không merge email, ràng buộc/expiry/replay account link, session revocation, cross-user/cross-org denial, feature flags, idempotent usage, metadata chưa đo, audit bất biến, chống SQL injection, body/origin validation và persistence sau mở lại.

## Phạm vi còn thiếu từ master specification

Console hiện bao phủ Users, AI usage, Security, feature flags và Audit. Chưa triển khai payment/subscription/credit ledger, content moderation, prompt version approval, AI evaluation datasets, tenant/classroom management, production MFA, PostgreSQL adapter, queue/Redis, storage scan, cloud synchronization và dashboard learning do backend xác thực. Những phần đó không được đánh dấu đã hoạt động và không có số liệu giả trong trang admin.
