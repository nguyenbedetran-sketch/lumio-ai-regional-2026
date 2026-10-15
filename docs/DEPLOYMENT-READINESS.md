# Chuẩn bị triển khai Lumio AI

Trạng thái: **bản đầy đủ đang local; bản public demo đã có cấu hình riêng**. Root đã xác nhận production build hoàn chỉnh thành công ngày 20/09/2026. Xem [RENDER-DEPLOYMENT.md](./RENDER-DEPLOYMENT.md) cho demo miễn phí không tài khoản/AI/database. Các mục dưới đây áp dụng trước khi mở bản đầy đủ có người dùng thật; không xác nhận đã triển khai hoặc hoàn tất hơn 200 mục master specification.

## Những phần đã có

- App học tập responsive; route điều khoản, quyền riêng tư, xóa dữ liệu và trang 404 riêng.
- Metadata riêng cho trang chính, policy và admin; canonical chỉ được tạo nếu có origin HTTPS thật.
- Mặc định `robots.txt` chặn toàn bộ; `sitemap.xml` rỗng; các trang có `noindex`. Header `X-Robots-Tag` bổ sung cho workspace, admin, API và khung thử mobile.
- File `llms.txt` mô tả đúng phạm vi và giới hạn, không cho phép truy cập dữ liệu riêng.
- JSON-LD `WebSite` và `SoftwareApplication` chỉ bật khi có origin thật và operator chủ động cho phép index. Không có giá, offers, đánh giá, địa chỉ doanh nghiệp hay chứng nhận giả.
- Google/Facebook OAuth có danh tính canonical, liên kết chủ động bằng token một lần, không tự gộp theo email.
- Admin có RBAC/phạm vi, phiên mới dưới 1 giờ, thu hồi phiên, tạm khóa có audit và feature flags.
- Log AI ghi metadata thật; không hiển thị token/chi phí chưa đo dưới dạng số liệu thật.
- SQLite local có transaction, migration và persistence; schema PostgreSQL đã chuẩn bị.
- Ví/ledger credit, quyền gói và dự giữ/quyết toán/hoàn khi lỗi chạy trong SQLite transaction; checkout chưa bật, chưa có giá hoặc cổng thanh toán.

## Các việc đang chặn triển khai có người dùng thật

| Hạng mục           | Cần hoàn tất                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database cloud     | Viết và kiểm tra adapter PostgreSQL chạy thật; hiện `DATABASE_URL` chưa được dùng                                                                                            |
| Production build   | Root đã xác nhận build hoàn chỉnh ngày 20/09/2026; mỗi cấu hình public mới vẫn cần build và smoke-test riêng                                                                 |
| OAuth public       | Domain HTTPS thật, callback Google/Facebook theo domain, trạng thái ứng dụng/phạm vi phù hợp; thử đăng nhập và liên kết end-to-end                                           |
| AI credentials     | Secrets của operator trên server hosting, kiểm tra từng capability với quota thật, không upload `.env.local`                                                                 |
| Distributed limits | Thay rate limiter bộ nhớ bằng storage dùng chung trước nhiều instance; giới hạn chi phí/thời gian theo hosting                                                               |
| Library storage    | Hiện IndexedDB/localStorage từng thiết bị/origin; chưa có đồng bộ thư viện, scan tệp hoặc object storage cloud                                                               |
| Admin production   | MFA/step-up, kiểm tra thu hồi phiên thực tế, giới hạn request và phân tách quyền database                                                                                    |
| Privacy/operations | Liên hệ phụ trách thật, retention policy, backup/restore được thử, consent/độ tuổi phù hợp đối tượng sử dụng                                                                 |
| QA                 | Desktop/mobile thật, tải lỗi, callback ở domain mới, kiểm tra quyền, link expiry, mutation CSRF, restore dữ liệu                                                             |
| Billing thật       | Xác nhận giá và credit tháng; adapter thanh toán, webhook xác minh/idempotency, vòng đời thuê bao, đối soát, refund và worker phục hồi khoản giữ; Play/Apple chưa triển khai |

SQLite chỉ được dùng production nếu operator chủ động đặt `LUMIO_DB_PATH` trên ổ đĩa bền vững và `LUMIO_ALLOW_LOCAL_DB_PRODUCTION=true`, chạy một máy chủ. Không bật cờ này để né yêu cầu database trên serverless có filesystem tạm.

## Hướng hosting miễn phí sau khi sửa các mục chặn

Có thể đánh giá **Vercel Hobby** cho web Next.js và **Supabase Free** cho PostgreSQL. Điều kiện/hạn mức phải được đối chiếu lại lúc triển khai; không có cam kết miễn phí không giới hạn. [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase pricing](https://supabase.com/pricing).

Supabase có thể tạm dừng dự án Free khi ít hoạt động; cần kiểm tra trước khi trình diễn. Supabase cũng khuyến nghị người dùng Free tự xuất dữ liệu và lưu backup bên ngoài. [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Database backups](https://supabase.com/docs/guides/platform/backups).

Adapter trong source hiện tại chưa kết nối các dịch vụ này. Hosting miễn phí không đồng nghĩa các API AI miễn phí. Chưa có thao tác tạo dịch vụ trả phí, mua domain hoặc triển khai công khai trong công việc này.

## Build: nguyên nhân và cách kiểm tra đúng

Next.js 15.5.12 dùng child-process workers cho production. Sandbox trước đây báo `spawn EPERM`; **root đã chạy build hoàn chỉnh thành công trong môi trường full-access ngày 20/09/2026**. Thử workerThreads cho production trước đó gặp `DataCloneError` do config chứa function, nên không dùng cách đó để tránh sandbox. [Upstream issue về config/function và worker threads](https://github.com/vercel/next.js/issues/37122).

`next.config.ts` giữ worker threads chỉ cho development và dùng transport mặc định production. Không sửa `node_modules`, không tắt TypeScript, không xóa các trang cần render để làm build hiện màu xanh.

Chạy trong terminal của người dùng hoặc CI thích hợp:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
node tests/admin.cjs
pnpm build
```

Sau khi build thực sự thành công, kiểm tra `pnpm start` với database production hợp lệ và các secrets chỉ có ở môi trường máy chủ. Không sử dụng development server làm deployment public.

## Cấu hình SEO khi đã có domain

```dotenv
# Để trống trong bản local. Khi triển khai, đặt origin HTTPS thật của dự án.
NEXT_PUBLIC_SITE_URL=
# Giữ false trong giai đoạn review; bật thủ công sau khi public đã được duyệt.
LUMIO_PUBLIC_INDEXING=false
```

`NEXT_PUBLIC_SITE_URL` chỉ dành cho địa chỉ công khai, tuyệt đối không dành cho API key. Khi có URL hợp lệ và `LUMIO_PUBLIC_INDEXING=true`, sitemap chỉ liệt kê `/privacy`, `/terms`, `/data-deletion`. `/` hiện là workspace cá nhân nên vẫn noindex; muốn SEO landing page cần thêm trang giới thiệu công khai thật, rồi mới thêm vào sitemap. Robots/noindex không thay thế authentication hay kiểm soát truy cập.

## Hai địa chỉ local

Facebook có thể yêu cầu `localhost` thay vì địa chỉ IP trong OAuth. Preview chỉ tin hai Host `localhost:3000` và `127.0.0.1:3000` trong development; production luôn dùng `NEXTAUTH_URL` cố định.

Hai origin có cookie và IndexedDB riêng. Muốn liên kết Facebook, mở Lumio ở `http://localhost:3000`, đăng nhập Google ở cùng origin rồi bắt đầu liên kết. Nếu thư viện cũ ở `127.0.0.1`, xuất bản sao ở đó và nhập trên `localhost`; bản JSON không mang theo tệp PDF/media gốc. Không báo dữ liệu đã đồng bộ chỉ vì hai cách đăng nhập cùng user trong database.

## Trước khi gửi source

Gói ZIP không chứa `.env.local`, OAuth JSON, `.data`, SQLite/WAL/SHM, log riêng, node_modules, `.next` hoặc `.next-dev`. Gửi source, lockfile, `.env.example`, test và tài liệu. Kiểm tra secret scanner rồi giải nén thử tại thư mục riêng. Người nhận tự cài dependencies và tự cấu hình secrets của môi trường chạy.

pnpm 11 đọc cấu hình dự án ở `pnpm-workspace.yaml`: store dùng đường dẫn tương đối `.pnpm-store`, còn `verifyDepsBeforeRun: warn` chỉ cảnh báo khi dependencies lệch trạng thái, không tự cài lại khi chạy test/dev. Sau khi giải nén hoặc thay đổi dependencies, chạy `pnpm install --frozen-lockfile` trước khi chạy các script.
