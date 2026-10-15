# Kiểm tra Lumio AI 1.1 preview · 20/09/2026

Bản local để chủ dự án kiểm tra. Chưa deploy public; không tuyên bố đã hoàn tất hơn 200 mục đặc tả. Xem [bảng đối chiếu từng mục](docs/SPEC-COVERAGE.md).

## Đã thử với dịch vụ thật

- Google và Facebook: đăng nhập thật, liên kết hai danh tính vào cùng tài khoản; giao diện xác nhận cả hai đã liên kết. Dùng `http://localhost:3000` cho Facebook; Meta từ chối luồng cũ ở `127.0.0.1`. Meta app vẫn ở chế độ phát triển và chưa duyệt public.
- OpenAI: hỏi gia sư bằng bài thử JavaScript ngắn, nhận câu trả lời tiếng Việt và lưu vào ghi chú.
- Toán: bài thử mới `sqrt((x−2)^2), x<2` qua giao diện Hỏi Lumio, kiểu Vở học và Lời giải đầy đủ; kết quả đúng `2−x`, có điều kiện, tính chất căn, phép biến đổi, đối chiếu và kết luận. Lưu kết quả vào ghi chú thành công. Đây là một bài kiểm tra nhỏ, không phải chứng nhận đúng mọi bài toán.
- Gemini: tạo tóm tắt có 3 chương và sơ đồ tư duy từ bài thử ngắn, lưu vào tài liệu. Không dùng kết quả này để khẳng định đã xử lý trọn video 12 giờ.
- Gemini video: video tự tạo 24 giây có hai thẻ chữ; yêu cầu đoạn 14–22 giây trả đúng thẻ ở đoạn chọn, loại thẻ trước đó, có mindmap và mốc 14 giây được đánh dấu ước tính. Gọi thật qua router mất khoảng 5,7 giây; không suy rộng thành xác minh mọi video YouTube.
- xAI: kiểm tra tổng hợp giọng nói rồi chép lại đoạn âm thanh thử ngắn thành công. Không phải realtime voice.
- Website: đọc bài `for` trên MDN, nhận 9.659 ký tự, xem lại và lưu nguồn học qua giao diện. Chưa tự động gọi AI ở bước đọc website.
- Admin: tài khoản chủ dự án mở được dashboard, số liệu lấy từ cơ sở dữ liệu và yêu cầu AI thật; không hiển thị chi phí giả khi thiếu metadata.

Thông tin xác thực chỉ nằm ở cấu hình riêng trên máy. ZIP không có khóa, cơ sở dữ liệu tài khoản hay dữ liệu học của người dùng.

## Kiểm tra giao diện và dữ liệu

- Đổi font sans cho phần hero và toàn bộ giao diện; tiếng Việt có dấu, theme sáng/tối và chuyển động có chế độ giảm motion.
- Bố cục mobile rộng 375px không tràn ngang trên các màn đã thử; thanh tab tài liệu có cuộn ngang chủ ý. Khung mobile không mô phỏng phần cứng/codec điện thoại.
- Mục tiêu: tạo/sửa/hoàn thành/hoàn tác và tải lại. Focus timer lưu theo tài khoản, tiếp tục khi chuyển trang; lịch ôn theo đánh giá nhớ bài.
- Sửa lỗi FocusTimer thiếu `alarm`: nối controller từ hook, thêm trạng thái chờ riêng trước khi render điều khiển âm thanh. Đã tải lại và mở Phòng tập trung bình thường. Nghe thử chuông có sẵn và tệp WAV tổng hợp thành công; tệp âm thanh riêng vẫn hiện sau tải lại. Không khẳng định chuông đánh thức máy đang ngủ hoặc trình duyệt bị tạm ngưng.
- Streak: từ các bản tóm tắt thực sự đã lưu, giao diện ghi nhận 1 ngày học và 2 hoạt động; đăng nhập không được tính như học. Có test ngày địa phương, lịch sử cũ, chống ghi lặp và hoàn thành timer.
- Đề xuất: hiển thị học liệu trong thư viện, nhận phản hồi, tắt cá nhân hóa thì phản hồi bị vô hiệu hóa và mô tả rõ dữ liệu không được dùng. Mạng hai lớp ẩn chỉ huấn luyện khi đủ nhãn; kiểm tra toán học bằng dữ liệu tổng hợp, chưa đánh giá chất lượng trên người học thật.
- Billing: ví Free ban đầu 200 credits, bảng bốn gói, màn xem quyền lợi và nút thanh toán bị khóa đúng khi chưa có giá. Bài toán thật ở chế độ Tutor giữ/quyết toán 4 credits; ví còn 196, số đang giữ về 0. Không cấp gói trả phí thật hoặc tạo hóa đơn giả. Kiểm tra tự động sử dụng DB riêng cho lifecycle sandbox, không tự nâng quyền tài khoản đang đăng nhập.
- Admin: tải lại dashboard sau sửa nội dung SVG title thành một chuỗi; console không có lỗi hydration mới. Phòng tập trung và màn billing cũng không có lỗi runtime mới trong lượt kiểm tra.
- Studio có tóm tắt, flashcards, quiz, sổ tay, bản đọc âm thanh một giọng, kế hoạch bài học có thể sửa và nút video gốc. Kế hoạch là mẫu cục bộ, video gốc không phải video do AI tạo.
- Tóm tắt có tổng quan, ý chính, chương, mốc thời gian và mindmap có chọn nút/zoom/xuất SVG. Văn bản không có mốc không được gán mốc giả. Mốc ước tính từ video có nhãn riêng.
- Video gửi trực tiếp cho AI có phạm vi yêu cầu mặc định 0–10 phút, tối đa 30 phút/lần. Hệ thống lưu phạm vi đã yêu cầu, không coi đó là bằng chứng AI đã bao phủ đầy đủ nội dung.
- Chụp ảnh từ video tải lên tạo JPEG thật, giới hạn 3 ảnh nhỏ/tóm tắt, có tải về và đi cùng backup. Đã thử toàn bộ luồng upload video mẫu → chọn 14–22 giây → AI trả tóm tắt → chụp JPEG 640×360 → tải lại và mở lại vẫn còn ảnh/mốc thời gian. Ảnh bìa YouTube không được gọi là ảnh của từng chương.
- Mindmap đã kiểm tra trên bài JavaScript: chọn nhánh `alert()` mở đúng chương liên quan; bấm mốc `06:13` đặt trình phát tại giây 373. Video này chặn phát nhúng, nên có thêm liên kết YouTube trực tiếp giữ nguyên mốc.

## Kiểm tra tự động

Chạy từ thư mục có `package.json`:

```sh
pnpm typecheck
pnpm test
# Sau khi máy chủ local chạy:
pnpm test:http
```

**Kết quả: 120/120 kiểm tra unit/integration, 24/24 HTTP và `pnpm typecheck` đạt.** Unit/integration gồm core 9, ingestion 27, learning 14, recommendations 12, admin 18, auth-security 9, metadata 5, billing 14 và AI-billing 12. HTTP gồm JSON 4, admin 9, preview 4 và billing 7.

Các nhóm bao gồm router AI/lỗi provider, giới hạn đầu vào/đầu ra, nhập/xuất, website/SSRF, parser HTML, phụ đề/video/mindmap, lịch ôn/streak/focus, SQLite migrations, RBAC, liên kết danh tính, thu hồi phiên, lỗi NextAuth trả JSON và metadata. Billing kiểm tra hai worker cùng tranh số dư, idempotency, chống sửa ledger, quyền gói và hết hạn. AI-billing dùng route/guard/router/SQLite thật, chỉ mock phiên và vận chuyển provider: từ chối trước khi gọi nếu không đủ quyền/credit, dự giữ trước fetch, quyết toán đúng, hoàn khi provider/đầu ra lỗi. Các test tự động không gọi API trả phí.

## Giới hạn trước khi public

- Production build chuẩn đã hoàn tất ngày 20/09/2026: biên dịch, kiểm tra kiểu, xuất trang và tối ưu thành công. Lỗi `spawn EPERM` ở lượt sandbox trước không còn chặn build trong môi trường hiện tại. Việc này chưa thay cho kiểm tra triển khai public.
- SQLite hiện tại cần ổ đĩa bền vững. Có schema PostgreSQL tham khảo nhưng chưa có adapter PostgreSQL chạy thật; chưa phù hợp đưa nguyên trạng lên hosting serverless với filesystem tạm.
- Nội dung học và tệp vẫn ở trình duyệt, chưa đồng bộ cloud. `localhost` và `127.0.0.1` là hai kho riêng, chuyển bằng export/import; JSON không chứa tệp media/PDF gốc.
- Chưa xử lý tự động video dài 12 giờ qua hàng đợi/chia đoạn/gộp kết quả. Chưa có ảnh từng chương tự trích từ YouTube, RAG/vector search, podcast nhiều giọng, video AI, realtime voice, app native, thu tiền Web/Play/Apple hay lớp học đa người dùng.
- Quyền gói và ví credit đã bền vững trong SQLite; rate limiter ngắn hạn vẫn dùng bộ nhớ tiến trình. Cần storage dùng chung trước nhiều máy chủ. Chưa có giá được duyệt, adapter thanh toán/webhook, đối soát, hoàn tiền thanh toán hoặc gia hạn trả phí.
- Cá nhân hóa chạy cục bộ với dữ liệu ít và đặc trưng băm, có thể gợi ý chưa tốt; chưa có dữ liệu đánh giá người học thật. Chưa kiểm thử tải, toàn bộ codec/mobile, microphone trên nhiều thiết bị hoặc triển khai public.
- Public OAuth cần HTTPS, domain/callback/policy URLs hợp lệ và các bước xét duyệt/tài khoản test của nhà cung cấp. Không thay cấu hình Meta bằng URL local không được chấp nhận.

## Kịch bản kiểm tra sản phẩm

1. Mở `http://localhost:3000`; xác nhận đăng nhập và hai danh tính trong Cài đặt.
2. Dán một đoạn bài học, hoặc thêm website và xem lại phần văn bản trước khi lưu.
3. Mở Studio: tạo tóm tắt, bấm chương/nút mindmap, xuất Markdown/SVG; tạo thẻ/quiz và làm bài.
4. Với video, thử đoạn ngắn trước, kiểm tra mốc bằng video gốc; với video tải lên, thử chụp khung hình và tải JPEG.
5. Tạo ghi chú/mục tiêu, tải lại, kiểm tra dữ liệu vẫn còn; export JSON và thử import trong profile thử riêng.
6. Mở Phòng tập trung để chọn/nghe thử chuông, tải lại kiểm tra lựa chọn; xem chuỗi ngày trong Tiến bộ của bạn sau khi đọc nội dung đủ lâu.
7. Thử Hỏi Lumio → Lời giải Toán → Vở học; kiểm tra lại điều kiện và đáp án. Trong Đề xuất cho bạn, thử phản hồi và tắt/bật cá nhân hóa.
8. Mở Gói & credit, xem lịch sử sau một yêu cầu AI ngắn; xác nhận gói trả phí vẫn chờ giá và checkout chưa mở. Chỉ admin mới xác thực có công cụ cấp gói sandbox tại local.
9. Mở `/admin`, xem nhật ký và mức sử dụng thật. Không thử khóa/thu hồi phiên của tài khoản đang dùng nếu chưa cần.
10. Đọc [hướng dẫn mở code](HUONG-DAN.md), [cấu hình dịch vụ](AI-SETUP.md) và [chuẩn bị triển khai](docs/DEPLOYMENT-READINESS.md).

## Xác minh bổ sung — production và demo công khai · 20/09/2026

**Đã xác minh demo công khai tại [lumio-ai-demo.onrender.com](https://lumio-ai-demo.onrender.com).** Giao diện hiển thị banner demo; **15/15 HTTP checks của chế độ public demo đạt trên URL này**. Bản public chỉ mở giao diện và công cụ học cục bộ: học liệu trong trình duyệt, không đăng nhập, không AI trực tuyến, không admin hoặc ví tài khoản thật, không thanh toán.

- Aggregate mới nhất: **137/137 unit/integration đạt**, gồm 120 kiểm tra cơ sở + 10 kiểm tra CAS/thư viện + 7 kiểm tra public-demo guard. Không gọi API trả phí trong các test tự động.
- Production build từ staging sạch **thành công**, gồm static generation và build traces. Bản production demo đã chạy **15/15 HTTP checks tại local** trước khi triển khai.
- Qua giao diện production demo: banner hiện đúng; học liệu mẫu mở được. Kiểm tra hai tab thật xác nhận cảnh báo xung đột, giữ bản nháp, tải bản đã lưu và khôi phục ghi chú đã lưu; thay đổi từ tab cũ không tự ghi đè dữ liệu mới hơn.
- Trên demo public, quiz mẫu một câu đạt 1/1 khi chọn A; tải lại dashboard vẫn giữ chuỗi 1 ngày và độ chính xác 100% từ duy nhất câu trả lời đó. Console không có lỗi trong lượt thử này; không suy rộng thành độ chính xác của AI hoặc hiệu quả học tập.
- Các kiểm tra demo xác nhận config/catalog công khai chỉ đọc, auth session/providers rỗng, API mutation và dữ liệu tài khoản bị từ chối, trang admin không khả dụng. Bản demo không mở database cục bộ và không cần secrets.

Bộ **24/24 HTTP** ghi ở giai đoạn trước là bản đầy đủ local. Bộ **15/15 HTTP demo** kiểm tra một cấu hình khác và đã được chạy riêng tại production local lẫn URL public; không gộp thành một bộ 39 tình huống cùng môi trường. Kết quả build/public demo mới cập nhật trạng thái của giai đoạn đầu tài liệu; những giới hạn về database/OAuth/AI công khai của bản đầy đủ vẫn còn.

Đây là kiểm tra nội bộ, chưa phải nghiên cứu hiệu quả học tập hoặc thử nghiệm trên lượng lớn người học. Các ảnh AI trong hồ sơ thuộc bản đầy đủ đã thử trước đó; không suy ra AI đang được bật trên URL demo.
