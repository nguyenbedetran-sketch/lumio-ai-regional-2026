# Tài liệu triển khai cũ 1.x - đọc ghi chú 2.0 trước

**Cập nhật phạm vi 15/10/2026:** các phần dưới là ghi chép lịch sử về UI-only và phương án production bền vững. Bản khu vực 2.0 thêm chế độ preview AI thật có lựa chọn rõ ràng dùng SQLite tạm trên Render Free; dữ liệu server có thể reset, không phải production. Dùng [README hiện tại](../README.md), [AI-SETUP](../AI-SETUP.md) và `render-regional.yaml` thay vì sao chép cấu hình UI-only dưới đây. Không coi tài liệu lịch sử này là xác nhận URL mới đã deploy hoặc đã kiểm thử.

Kiểm tra ngày 20/09/2026. **Chưa có deployment công khai được xác nhận trong tài liệu này.** Đã chuẩn bị bản demo công khai không tài khoản, không gọi AI trả phí và không có database server. Bản đầy đủ hiện dùng `node:sqlite`; khai báo `DATABASE_URL` chưa tạo kết nối PostgreSQL. Không bật `LUMIO_ALLOW_LOCAL_DB_PRODUCTION=true` trên Render Free.

## Kết quả build mới nhất

Root đã chạy **production build thành công, exit 0 ngày 20/09/2026**, gồm static generation và build traces, trong môi trường full-access. Lỗi `spawn EPERM` trước đó thuộc sandbox cũ của tác vụ phụ, không còn là kết luận về khả năng build sản phẩm. Mode demo mới cần được build và smoke-test lại từ source sạch trước khi public; không tắt kiểm tra TypeScript hoặc đổi worker config để che lỗi.

## Demo miễn phí đã chuẩn bị

`render.yaml` tạo một Web Service **Free** và đặt `LUMIO_PUBLIC_DEMO=true`. Không có database hoặc disk. Lệnh start `node scripts/start-public-demo.cjs` từ chối khởi động nếu phát hiện file `.env` riêng, thư mục `.data`, OAuth/API credentials hoặc cấu hình database trong môi trường. Cần triển khai source sạch; không chạy lệnh này ngay trong thư mục local đang giữ secrets.

Mode demo có hai lớp chặn: middleware từ chối mọi API ngoài config, catalog, session/providers rỗng; các handler config/auth/catalog và store cũng kiểm tra trực tiếp. `getStore()` không mở cả database mới lẫn handle đã cache. `/admin` chuyển về trang chủ. Giao diện public phải hiển thị nhãn demo trước khi triển khai; dữ liệu học thử chỉ lưu trong trình duyệt của người xem. Không có đăng nhập, ví thật, AI thật hoặc thanh toán trong bản công khai này.

Thông số blueprint: Node 24.19.0; `plan: free`; `LUMIO_AI_ENABLED=false`; không index; health check `/api/config`. Thư mục gốc của repository triển khai phải là source Lumio chứa `package.json` và `render.yaml`. Blueprint không chứa secrets. [Render Blueprint reference](https://render.com/docs/blueprint-spec).

Trước khi đăng link: chạy `node tests/public-demo.cjs`; build source sạch; start demo; đặt `LUMIO_TEST_ORIGIN` theo origin test và chạy `node tests/public-demo-http.cjs`. Kiểm tra API mutation trả JSON 403, auth session rỗng, thư mục database không xuất hiện, và banner demo hiện trên desktop/mobile. Không điền URL chưa kiểm tra vào hồ sơ dự thi.

## Chọn cấu hình giữ được tài khoản và credit

| Cách triển khai                           | Dùng ngay với code hiện tại?      | Điều kiện                                                                      |
| ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| Render Free + public demo, không database | Có thể sau build/smoke/triển khai | Chỉ dùng UI và thư viện local trên trình duyệt; mọi chức năng server bị tắt    |
| Render Free + SQLite cục bộ               | Không                             | Mất DB khi restart, redeploy hoặc ngủ; không phù hợp tài khoản, audit, credit  |
| Render Free + Supabase Free PostgreSQL    | Chưa                              | Cần viết và kiểm tra adapter PostgreSQL thật, rồi cấu hình OAuth theo domain   |
| Render trả phí + persistent disk + SQLite | Có thể sau build/QA               | Có phí; một instance; DB phải nằm trong mount path, cần backup có thể phục hồi |

Render Free ngủ sau 15 phút không có traffic và không hỗ trợ persistent disk. Render Postgres Free hết hạn sau 30 ngày; không chọn làm nơi lưu tài khoản lâu dài. [Render Free](https://render.com/docs/free), [Persistent disks](https://render.com/docs/disks).

Supabase Free hiện có PostgreSQL 500 MB; dự án có thể pause sau một tuần không hoạt động và không có automatic backups. Với bản dự thi nhỏ, đây là phương án giữ dữ liệu ngoài filesystem của Render, sau khi hoàn tất adapter; cần kiểm tra dự án đang hoạt động trước buổi trình diễn và tự xuất backup. [Supabase pricing](https://supabase.com/pricing).

Không tạo disk/service trả phí, không dùng credit card hoặc bật nâng cấp tự động trong bước chuẩn bị này. Hosting miễn phí không bao gồm chi phí gọi API AI.

## Công việc cần làm cho adapter PostgreSQL

1. Tạo repository bất đồng bộ dùng PostgreSQL thật; các migration tham khảo đang ở `db/postgres/001_platform.sql` đến `003_billing.sql`.
2. Giữ nguyên canonical user, identity, `storageKey`, sessionVersion và bootstrap admin qua Google đã xác minh. Tất cả caller OAuth/admin/AI/billing phải `await` kết quả đọc/ghi; không đổi riêng driver rồi để callback cũ nhận Promise.
3. Mỗi liên kết tài khoản, thu hồi phiên và dự giữ/hoàn credit phải dùng cùng transaction với kiểm tra quyền. Khóa hàng tài khoản khi thay ví; giữ request ID duy nhất và ledger append-only.
4. Thử bằng hai kết nối PostgreSQL thật: tranh cùng số dư, thu hồi phiên giữa callback, link intent dùng lại, timeout/rollback, khởi động lại server và đọc lại số dư. SQLite tests không thay thế bước này.
5. Dùng thông tin kết nối chỉ phía server. Chọn kiểu kết nối/pooler phù hợp môi trường; không tắt xác minh TLS. [Hướng dẫn kết nối PostgreSQL của Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
6. Nếu chuyển dữ liệu tài khoản/credit từ local, cần migration riêng có backup và đối soát; không tải `.data` hoặc `.env.local` lên Git. Thư viện IndexedDB trên trình duyệt không tự chuyển origin theo database server.

## Bản đầy đủ sau khi adapter sẵn sàng

Lumio dùng API/OAuth nên cần **Web Service**, không phải static site. Render hỗ trợ Next.js đầy đủ qua Node web service. [Next.js trên Render](https://render.com/docs/deploy-nextjs-app).

- Repository root phải là thư mục chứa `package.json` của Lumio; nếu giữ cấu trúc workspace hiện tại, đặt Root Directory là `outputs/eduvi`.
- Runtime: Node.js, phiên bản thuộc khoảng `>=24 <25` theo `package.json`. Có thể chỉ định `NODE_VERSION` phù hợp; không dùng runtime Node thấp hơn yêu cầu của `node:sqlite`. [Cấu hình Node.js trên Render](https://render.com/docs/node-version).
- Build command, sau khi đã chọn và cài pnpm tương thích lockfile: `pnpm install --frozen-lockfile && pnpm build`.
- Start command: `pnpm exec next start --hostname 0.0.0.0 --port $PORT`.
- Plan: Free. Không attach disk; dữ liệu tài khoản/credit phải đi qua PostgreSQL ngoài service.
- `render.yaml` hiện dành riêng cho public demo. Muốn mở bản đầy đủ cần thay cấu hình sau khi có adapter thật; không chỉ tắt cờ demo. Một service trả HTTP 200 cho trang chủ nhưng lỗi database ở đăng nhập/billing không được coi là deployment bản đầy đủ thành công.

Đặt secrets trong dashboard server: `NEXTAUTH_SECRET`, OAuth client secrets, các API key và connection string PostgreSQL sau khi adapter đã có. Đặt `NEXTAUTH_URL` và `NEXT_PUBLIC_SITE_URL` đúng origin HTTPS thật; `AUTH_TRUST_HOST` không dùng để tin arbitrary public Host. Đăng ký callback chính xác `/api/auth/callback/google` và `/api/auth/callback/facebook` tại từng nhà cung cấp. Không đưa secret vào biến `NEXT_PUBLIC_*`.

Giữ AI tắt trong lần kiểm tra HTTP đầu tiên. Chỉ bật sau khi test đăng nhập/liên kết, ví, quota, revocation và persistence sau redeploy đạt. Checkout vẫn tắt cho đến khi có bảng giá và adapter thanh toán được kiểm chứng. Public URL chỉ điền vào hồ sơ dự thi sau khi truy cập, đăng nhập và dữ liệu thực tế được kiểm tra trên chính domain đó.
