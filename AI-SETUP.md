# AI và đăng nhập - Lumio khu vực V2 + V3

Khóa bí mật chỉ đặt ở máy chủ. Bộ code sạch không có API key, OAuth secret hoặc database; không có cấu hình thì AI/đăng nhập không tự mô phỏng thành công. Đã có báo cáo probe và hội thoại AI thật local trong `docs/regional`; chúng không thay kiểm tra OAuth/AI ở URL public. Trạng thái triển khai/nộp cuối xem [FINAL-REPORT.md](docs/regional/FINAL-REPORT.md), không suy ra từ hướng dẫn này.

## 1. Cài local

Dùng Node.js 24.x và pnpm 11.25.0. Mở thư mục có `package.json`:

```sh
pnpm install --frozen-lockfile
```

Sao chép `.env.example` thành `.env.local` ở thư mục web. Chạy `pnpm auth:setup` để tạo/giữ khóa phiên ngẫu nhiên. Điền giá trị thật **trong file riêng**, không đưa vào chat/GitHub/giao diện học:

| Biến | Dùng cho |
| --- | --- |
| `NEXTAUTH_URL` | `http://localhost:3000` khi dev; origin HTTPS chính xác khi triển khai |
| `NEXTAUTH_SECRET` | Chuỗi ngẫu nhiên ít nhất 32 ký tự; giữ ổn định qua các lần chạy muốn giữ phiên |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth Web client; bản khu vực cần Google login |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Facebook login tùy chọn, chỉ bật khi đã cấu hình được |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Gia sư/chat và suy luận |
| `LUMIO_EMBEDDINGS_ENABLED`, `OPENAI_EMBEDDING_MODEL` | Embedding tùy chọn, mặc định tắt; cần đồng ý riêng trên từng thao tác |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Học liệu/đa phương thức/tóm tắt |
| `XAI_API_KEY`, `XAI_STT_MODEL`, `XAI_VOICE` | Đọc tiếng và chép lời; thiếu cấu hình thì khả năng tương ứng không sẵn sàng |
| `LUMIO_ADMIN_EMAILS` | Email Google đã xác minh của người quản trị, đặt riêng; không dùng cờ admin từ trình duyệt |

Model mặc định của dự án nằm trong `.env.example`; dùng model mà tài khoản dịch vụ thực sự có quyền gọi. Không đặt tiền tố `NEXT_PUBLIC_` cho key/secret. Tài khoản API độc lập với gói ChatGPT. Không dùng DeepSeek.

Để AI local hoạt động, đặt `LUMIO_AI_ENABLED=true`, `LUMIO_PUBLIC_DEMO=false`, giữ `LUMIO_COMPETITION_PREVIEW=false` nếu không chủ động thử ngoại lệ của bản thi. Chạy `pnpm dev`. Sau khi sửa env, khởi động lại server; tải lại trang không nạp lại env của tiến trình.

Có thể dùng `pnpm services:setup` để mở biểu mẫu local tạm theo script dự án; chỉ nhập trên máy của mình, không mở biểu mẫu ra Internet. File `.env.local` phải được giữ riêng.

## 2. OAuth

Google Web client cần callback chính xác:

```text
http://localhost:3000/api/auth/callback/google
https://TEN-MIEN-CUA-BAN/api/auth/callback/google
```

Chỉ đăng ký origin bạn thật sự dùng. Nếu chủ động thử cả `127.0.0.1`, cấu hình callback phù hợp cho nó; `localhost` và `127.0.0.1` có cookie/học liệu riêng. Thêm tài khoản thử và cấu hình màn hình đồng ý/phạm vi hồ sơ-email theo yêu cầu của dịch vụ. Có cấu hình chưa đồng nghĩa app được duyệt dùng public.

Facebook tùy chọn dùng callback `/api/auth/callback/facebook` trên đúng origin. Ưu tiên localhost khi thử máy; bản công khai cần HTTPS hợp lệ, URL `/privacy` và `/data-deletion` cùng các bước Meta yêu cầu. Không tắt HTTPS hoặc chấp nhận chứng chỉ lỗi để bỏ qua lỗi đăng nhập.

Server dev chỉ chấp nhận `localhost:3000` và `127.0.0.1:3000`, tự chọn origin trong proxy loopback. Cơ chế `AUTH_TRUST_HOST`/`LUMIO_DEV_ORIGIN_SELECTION` là nội bộ dev; không tùy ý bật trên hosting. Production dùng `NEXTAUTH_URL` cố định.

Để liên kết hai cách đăng nhập: đăng nhập tài khoản hiện tại → Cài đặt → Liên kết. Phiên gần đây, token một lần và quyền sở hữu được kiểm tra máy chủ. Không tự gộp tài khoản vì cùng email; danh tính thuộc người khác bị từ chối. Mở trang khác origin không tự chuyển thư viện local.

## 3. Bản khu vực trên Render Free

Đây là **preview dự thi với database tạm**, theo phạm vi chủ dự án chọn; không tạo dịch vụ trả phí hoặc giả nhận đã có cơ sở dữ liệu bền vững. Mẫu là `render-regional.yaml`. `render.yaml` cũ dùng UI-only, chủ động tắt AI/tài khoản và không dùng để nghiệm thu AI thật.

Trong Environment của hosting, cấu hình:

```dotenv
LUMIO_PUBLIC_DEMO=false
LUMIO_COMPETITION_PREVIEW=true
LUMIO_AI_ENABLED=true
LUMIO_PUBLIC_INDEXING=false
NEXTAUTH_URL=https://TEN-MIEN-CUA-BAN
NEXT_PUBLIC_SITE_URL=https://TEN-MIEN-CUA-BAN
LUMIO_ALLOW_LOCAL_DB_PRODUCTION=false
```

Các dòng trên chỉ là ví dụ chế độ/origin, không phải thông tin xác thực. Nhập thêm `NEXTAUTH_SECRET`, Google OAuth, core AI và voice/Facebook nếu dùng trong kho secret của hosting. Không lưu giá trị secret vào YAML, source hoặc log. Callback OAuth phải dùng domain HTTPS đó.

```sh
pnpm install --frozen-lockfile
pnpm build
node scripts/start-regional.cjs
```

Starter từ chối nếu thiếu cờ preview, thiếu origin HTTPS, Google, khóa phiên hoặc core AI, hoặc nếu trộn với public-demo/desktop. Nó đặt đường dẫn SQLite riêng khi chưa có `LUMIO_DB_PATH`, giữ `LUMIO_ALLOW_LOCAL_DB_PRODUCTION=false`, không biến disk tạm thành bền vững. Dùng `pnpm dev` cho localhost HTTP; không tắt guard để ép starter production chạy như dev.

**Dữ liệu có thể reset khi host ngủ/restart/deploy:** tài khoản, liên kết, ví/credit, audit, phiên gia sư, bản sync/chỉ mục và tác vụ nằm trên SQLite tạm. V3 có bản sync văn bản opt-in; local IndexedDB/localStorage vẫn là kho riêng theo origin/tài khoản. Bản server tối đa 7 ngày, không chứa file gốc; không phải cam kết cloud bền vững. Giữ JSON/file gốc. PostgreSQL mới có schema tham khảo, chưa có adapter chạy thật. Production thông thường cần storage bền vững đã kiểm tra, không dùng ngoại lệ thi làm giải pháp production.

## 4. Hạn mức và credit

- Mọi lần gọi AI cần tài khoản canonical, feature flag, quyền phù hợp và credit server. Giới hạn 15 lượt/phút, 150 lượt/ngày UTC và 1 đang chạy/tài khoản.
- Chế độ khu vực thêm 200 lượt thử/ngày UTC và 3 đồng thời, gồm lượt đi qua guard rồi lỗi. V3 lưu cửa sổ/lease trong SQLite để process cùng tệp DB dùng chung; không tự bảo vệ nhiều máy có ổ riêng. Counter còn sau restart nếu DB còn, reset nếu DB mất; không phải ngân sách tiền tuyệt đối.
- Free thử một lần 200 credit. Trong chế độ khu vực, các khả năng nâng cao có thể được mở thử cho Free nhưng vẫn trừ/giữ credit và hạn mức. Ngoại lệ đó không tạo gói mua trả phí.
- Mỗi tác vụ/media/mode có định mức; video dài và đọc tiếng dài gồm nhiều lần gọi. Máy chủ dự giữ trước, quyết toán khi thành công, hoàn phần giữ khi lỗi; không gọi thẳng dịch vụ từ frontend để né giới hạn.

Giá hiển thị là đề xuất 59.000đ/129.000đ/249.000đ, chưa bán, checkout khóa, không tự nạp credit hoặc gia hạn. Admin local có công cụ sandbox riêng có audit; đó không phải thanh toán thật. [Bảng đề xuất](docs/regional/PRICING-PROPOSAL.md). Hosting miễn phí không miễn phí chi phí nhà cung cấp AI.

## 5. Kiểm tra có bằng chứng

`pnpm auth:check` và các kiểm tra cấu hình không thay một lần đăng nhập thật. `pnpm services:check` gọi API thật bằng tài khoản đã cấu hình và có thể tính phí; `node scripts/check-voice.cjs` cũng tạo/chép âm thanh thật. Không đưa các lệnh đó vào CI lặp tự động khi chưa chủ động chọn. Các test fixture/UI có ghi nhãn không tính là AI thật hoặc học sinh thật.

Xem [báo cáo nghiệm thu](docs/regional/FINAL-REPORT.md), các JSON `tutor-live-*`, `qa-regional-*` và log kiểm thử. Local pass không xác nhận public pass; chỉ đánh dấu deploy/đăng nhập/AI/nộp bài sau khi đã kiểm tra chính URL đó.

## 6. Dữ liệu và bảo mật

Thông báo cạnh yêu cầu cho biết văn bản, media, URL hoặc hội thoại chuẩn bị gửi tới dịch vụ bên ngoài. Không chủ động gửi toàn bộ thư viện hoặc phản hồi đề xuất. Nội dung bạn tự nhập vẫn có thể chứa dữ liệu cá nhân; bỏ phần không cần thiết. Không hứa thay nhà cung cấp về lưu giữ/huấn luyện/xóa bản họ đã nhận.

Phiên gia sư lưu đề tối đa 4.000 ký tự, tối đa 100 lượt, tiến trình và digest nguồn; không lưu file media gốc trong bảng phiên. Hết hiệu lực 7 ngày, dọn khi truy cập hoặc người dùng xóa phiên của mình. Chưa có lịch dọn nền hoặc xóa tài khoản đầy đủ. Log vận hành chỉ ghi metadata, không thiết kế lưu toàn học liệu/hội thoại; credit ledger không chứa thẻ thanh toán.

V3: snapshot kỹ năng tính local, nhãn khó/kỹ năng chưa hiệu chuẩn; không gửi hồ sơ tới AI. Sync văn bản chỉ theo đồng ý, có xung đột/idempotency và xóa bản server, retention7 ngày. Chỉ mục RAG lưu văn bản/chunks/vị trí/vector nếu có tối đa 7 ngày; keyword trước, embedding mặc định tắt. Khi chủ động bật `LUMIO_EMBEDDINGS_ENABLED=true`, model mặc định của code là `text-embedding-3-small`; vẫn cần key server/quyền model và đồng ý riêng trước gửi tài liệu/câu truy vấn. Không có vector DB/dịch vụ mới.

Tóm tắt chạy nền giữ immutable text/URL YouTube và kết quả từng phần tối đa 7 ngày, có consent/retry/cancel/delete. Worker chạy khi process còn thức, được khởi động lại khi chủ tài khoản truy cập; không bảo đảm luôn chạy trên free host. Cờ `LUMIO_BACKGROUND_JOBS_DISABLED=true` dùng để dừng khởi động worker khi bảo trì/thử nghiệm; không thay kiểm tra AI/credit/owner. Không ghi nội dung job vào log vận hành hoặc giả nhận hàng đợi tạm là lưu trữ bền vững.

Không chia sẻ `.env.local`, `.data`, database, cookie, file xác thực hoặc callback log. Không ghi key vào `NEXT_PUBLIC_*`, URL hay lỗi gửi cho browser. Khi đóng gói, dùng source sạch và kiểm tra secrets. Mã Android 0.3/Windows 0.1 từ đợt trước không được build lại trong đợt web khu vực này.
