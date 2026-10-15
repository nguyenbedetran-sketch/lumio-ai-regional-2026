# Lumio billing — trạng thái local review

Đã có bốn gói Free, Plus, Premium, Pro; ví credits trên máy chủ; sổ credits chỉ ghi thêm; dự giữ trước khi gọi AI; quyết toán sau thành công; hoàn lại khi lỗi. Số dư và quyền tính năng dùng canonical user, nên Google/Facebook đã liên kết dùng chung ví. Phần này dùng SQLite bền vững trên một máy chủ như hệ thống tài khoản hiện tại.

**Chưa có bảng giá do chủ dự án xác nhận và chưa có cổng thanh toán.** Mọi mức phí của gói trả phí/gói credits đều `null`; checkout trả lỗi JSON rõ ràng, không tạo giao dịch giả, không tăng quyền hoặc số dư. `invoices: []` có nghĩa chưa có hóa đơn thực tế. Có sẵn điểm nối adapter nhưng chưa triển khai thu tiền, webhook, đăng ký trả phí, hoàn tiền thanh toán hoặc tự gia hạn. Blueprint PostgreSQL migration 003 chưa phải adapter triển khai được.

## Quyền và credits thử nghiệm

| Gói     | Chế độ                    | Đầu vào                  | Giọng nói | Giới hạn đoạn video |
| ------- | ------------------------- | ------------------------ | --------- | ------------------- |
| Free    | Quick, Tutor              | Văn bản, ảnh, PDF, video | Không     | 10 phút             |
| Plus    | Quick, Tutor, Think       | Thêm audio               | Có        | 20 phút             |
| Premium | Thêm Deep                 | Tất cả loại hiện hỗ trợ  | Có        | 30 phút             |
| Pro     | Quick, Tutor, Think, Deep | Tất cả loại hiện hỗ trợ  | Có        | 30 phút             |

Đây là cấu hình quyền để kiểm tra sản phẩm, không phải cam kết thương mại. Premium và Pro đang có cùng giới hạn xử lý vì backend video tối đa 30 phút; chưa có bảng giá/credits tháng để phân biệt thêm.

Free nhận **200 credits một lần cho mỗi canonical user**, không tự cấp lại khi đăng nhập. Các giá trị sau là đơn vị sử dụng nội bộ, không quy đổi thành tiền: chat 2, summary 8, cards 6, quiz 8, speech 8, transcription 12; cộng theo mode Quick 0/Tutor 2/Think 6/Deep 18; cộng ảnh 4/PDF 8/audio 12; video 10 mỗi phút đoạn được chọn (làm tròn lên). Ví dụ summary video 10 phút ở Tutor tốn 8+2+100=110 credits. Dịch vụ chưa cấu hình hoặc lỗi sẽ hoàn khoản dự giữ. Catalog API cung cấp bảng này cho UI.

## An toàn giao dịch

- `reserveUsage` kiểm tra user đang hoạt động, sessionVersion, quyền mode/media/voice và số dư trong cùng `BEGIN IMMEDIATE`. Model đắt hơn không thể mở bằng thay state frontend. Route phải suy ra kind và duration từ input đã xác thực, không tin loại gói/số dư phía client.
- Request ID duy nhất chặn chạy cùng yêu cầu hai lần: đang giữ trả 409; đã kết thúc cũng trả 409. Muốn thử lại yêu cầu đã lỗi, tạo request ID mới.
- `settleUsage` và `failUsage` là hàm nội bộ server, có kiểm tra sở hữu reservation và idempotency; không có endpoint cho client tự quyết toán hoặc tự hoàn. Hoàn tiền credits vẫn hoạt động sau khi phiên bị thu hồi.
- Nếu tiến trình chết, khoản giữ quá 10 phút được hoàn trong lần đọc ví/dự giữ tiếp theo. Backend hiện giới hạn cuộc gọi provider ngắn hơn ngưỡng này. Cần worker phục hồi định kỳ trước khi thu tiền thật.
- Ledger có trigger cấm UPDATE/DELETE. Ledger lưu loại công việc và biến động credits, không lưu prompt, API key, nội dung học hoặc thẻ thanh toán.
- Chỉ `SUPER_ADMIN` đã OAuth lại trong một giờ được cấp gói/credits sandbox. Endpoint yêu cầu origin chính xác; transaction kiểm lại phiên và quyền; chỉ hoạt động khi `NODE_ENV=development`. Mọi grant có audit, nhãn sandbox và request ID chống cấp lặp. Không tự nâng quyền vì người dùng là admin.

## API

- `GET /api/billing/catalog`: catalog công khai, không có dữ liệu ví.
- `GET /api/billing?offset=0`: phiên hợp lệ; catalog, account, tối đa 50 dòng ledger, invoices rỗng hiện tại.
- `POST /api/billing/checkout`: `{itemId, interval:"month"|"year"}`. itemId là plus/premium/pro hoặc pack_small/pack_medium/pack_large. Chưa cấu hình giá trả `PRICE_NOT_CONFIGURED` 503; có giá nhưng chưa adapter trả `PAYMENT_PROVIDER_NOT_CONFIGURED` 503.
- `POST /api/billing/subscription`: `{requestId,action:"cancel"|"resume"|"downgrade",planId?:"free"}`. Hiện chỉ thay trạng thái gói sandbox. Downgrade về Free vào ngày hết hạn; resume bỏ yêu cầu hủy nhưng **không gia hạn**, không thu tiền, không cộng credits. Gói sandbox luôn hết hạn sau tối đa 30 ngày.
- `GET /api/billing/admin`: catalog và sandboxEnabled; yêu cầu quyền quản trị mới xác thực.
- `POST /api/billing/admin`: action `sandbox_grant` cần `{confirmSandbox:true,userId,requestId,planId,credits,days,reason}`; 0–100.000 credits mỗi grant, 1–30 ngày, lý do 8–300 ký tự. action `catalog_update` cần `{itemId,monthlyPriceMinor:number|null,yearlyPriceMinor:number|null,credits:number|null}`; ghi giá vẫn không bật checkout.

Mọi POST cần `Content-Type: application/json` và Origin cùng ứng dụng. Các lỗi chính: `CREDITS_INSUFFICIENT` 402; `PLAN_ACCESS_REQUIRED` 403; `SESSION_REVOKED` 401; `BILLING_REQUEST_IN_PROGRESS`, `BILLING_REQUEST_FINALIZED`, `IDEMPOTENCY_CONFLICT` 409; `SANDBOX_DISABLED` 403.

## Kiểm tra

`node tests/billing.cjs` dùng DB tạm riêng: ví, idempotency, hoàn lỗi, chống ghi sửa ledger, hai worker/connection tranh cùng số dư, quyền server, thu hồi phiên, hết hạn gói, grant sandbox và checkout không cấp tiền/quyền giả. Không gọi AI hoặc cổng thanh toán.

Sau khi khởi động local preview, `node tests/billing-http.cjs` kiểm tra JSON/catalog, từ chối người chưa đăng nhập và chống origin giả. Không dùng tài khoản thật, không gọi thanh toán.
