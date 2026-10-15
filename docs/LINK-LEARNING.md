# Học từ liên kết và AI Tutor

## Cách dùng

1. Thêm liên kết web hoặc YouTube trong Lumio, rồi mở mục **Nguồn**.
2. Với website, chọn **Đọc nội dung trang**. Tài khoản đã đăng nhập mới được gọi dịch vụ. Văn bản chỉ được tải sau thao tác này. Kiểm tra bản xem trước rồi chọn **Lưu làm nguồn học**. Khi đã có nguồn, nút ghi rõ **Thay văn bản nguồn**; ghi chú, thẻ, quiz và URL gốc được giữ lại.
3. Với YouTube, chọn **Mở trợ lý cho video**, chọn đoạn theo `MM:SS` hoặc `HH:MM:SS` (mặc định 10 phút đầu, tối đa 30 phút mỗi yêu cầu), sau đó chọn tóm tắt/thẻ/quiz/hỏi đáp và nhấn tạo nội dung. Chỉ lúc đó URL video mới được gửi tới dịch vụ xử lý video. Kết quả phân tích là đầu ra AI, không phải bản chép lời đã kiểm chứng. Video tải lên cũng có lựa chọn đoạn; tệp gửi AI vẫn giới hạn 6 MB, không tải cả video nhiều giờ.
4. Nếu không xử lý được video hoặc trang cần đăng nhập/JavaScript, nhập phụ đề `.vtt`/`.srt` hoặc dán nội dung bạn có quyền dùng. Phụ đề được đọc ngay trên trình duyệt; mốc thời gian lấy trực tiếp từ tệp. Nội dung này trở thành nguồn sau khi bấm lưu.
5. AI Tutor có **Nhanh / Suy luận / Chuyên sâu / Gia sư**. Các lựa chọn điều chỉnh hướng dẫn học và độ dài đầu ra; không hứa một khả năng suy luận nội bộ chưa được xác nhận. Có trình độ, mục tiêu, chế độ gợi ý hoặc lời giải đầy đủ, định dạng Toán. Lời giải Toán dùng KaTeX, không tự tuyên bố có bộ kiểm chứng tính toán.

## Phạm vi hiện tại

- **Tóm tắt trực quan**: AI trả schema được kiểm tra với tổng quan, ý chính, các chương và graph tư duy. Lưu tối đa 20 bản trong học liệu; mở lại tab Tóm tắt hoặc Studio để tiếp tục. Có xuất Markdown và sơ đồ SVG. Mindmap hiển thị quan hệ do AI đề xuất, có thể chọn nút để xem giải thích/chương liên quan; không được coi là knowledge graph/mastery engine.
- Chapter time từ phụ đề phải khớp cue trong nguồn. Thời gian nhận diện từ video/audio được đánh dấu **ước lượng**; văn bản dán không có cue sẽ không có timestamp. Mốc chương của video là thời gian tuyệt đối từ đầu video gốc, chỉ giữ mốc nằm trong đoạn yêu cầu. Click mốc sẽ mở điểm tương ứng trong YouTube embed hoặc video local. Ảnh bìa YouTube được ghi rõ là ảnh bìa, không gán cho mỗi chương. Có thể chụp khung hình thật từ video local đang xem: lưu tối đa 3 ảnh JPEG nhỏ trong mỗi bản tóm tắt, giữ mốc chụp, tải ảnh riêng và xuất/nhập cùng bản sao JSON. Không tạo ảnh minh chứng giả.
- Sơ đồ tự thu vừa vùng hiển thị, có phóng to/thu nhỏ và danh sách nút đọc được trên điện thoại; hỗ trợ giao diện tối. Chi tiết nút và liên kết chương vẫn đọc được khi sơ đồ được thu nhỏ.
- Văn bản cho một yêu cầu AI tối đa 200.000 ký tự; website extraction vẫn giới hạn 50.000 ký tự. Tóm tắt có output budget 7.200 token và timeout 60 giây. Video rất dài có thể vượt khả năng/giới hạn của request; chưa có worker chia video nhiều giờ, không cam kết xử lý toàn bộ video 12 giờ.

- Website: HTML/txt công khai, tối đa 2 MB tải về và 50.000 ký tự nguồn. Không thực thi JavaScript, không đăng nhập thay người dùng, không vượt paywall, không thu thập trang khác. Loại script/style/form/navigation và các phần có thuộc tính ẩn trực tiếp. CSS từ xa không được tải nên việc xác định văn bản hiển thị có giới hạn.
- Chỉ kết nối IPv4 công khai, HTTP(S) cổng mặc định. Không hỗ trợ máy chủ chỉ có IPv6. Chặn địa chỉ local/private/link-local/reserved/multicast; resolve DNS trước và ghim IP đã kiểm tra vào kết nối, giữ hostname cho Host và TLS. Không có DNS lookup thứ hai. Mỗi redirect được kiểm tra lại, tối đa 3 lần; cả quá trình tối đa 15 giây. HTML giới hạn độ lồng 256 và 50.000 thẻ để chặn nội dung gây tốn CPU; không quét lại toàn bộ stack cho từng text token. TLS certificate phải hợp lệ. Không gửi cookie, token hoặc header đăng nhập của người dùng sang nguồn.
- YouTube: một video công khai mỗi yêu cầu, gửi qua `fileData.fileUri` của Gemini Generate Content API. URL được chuẩn hóa theo allowlist hostname và video ID; không scrape phụ đề hay tải video bằng công cụ bên thứ ba. Video riêng tư, không công khai, hạn chế hoặc dịch vụ không hỗ trợ sẽ báo lỗi; dùng nhập phụ đề/dán chữ làm phương án thay thế. Tính năng URL của nhà cung cấp đang preview và giới hạn có thể thay đổi. Xem [tài liệu chính thức về video](https://ai.google.dev/gemini-api/docs/generate-content/video-understanding) và [tài liệu API](https://ai.google.dev/api/generate-content).
- Yêu cầu video có thể tốn nhiều token; chưa có hàng đợi/video dài nền hoặc bộ ước tính giá đáng tin cậy. Giới hạn request từ server vẫn áp dụng. Không quảng cáo xử lý video là miễn phí tuyệt đối.
- Phần video dùng `videoMetadata.startOffset/endOffset` theo tài liệu chính thức. Khoảng đã chọn được lưu dưới nhãn **Phạm vi đã yêu cầu**; đây không phải xác nhận độc lập rằng nhà cung cấp đã đọc từng giây. Lỗi, quota và timeout không tạo bản tóm tắt giả hoặc tuyên bố đã xử lý toàn bộ video. Không tự chạy nhiều lượt trả phí để phủ video 12 giờ; chưa có worker/chunking/retry nền hay cam kết chi phí cho video dài.
- Website/caption provenance được lưu cùng nguồn và xuất/nhập bản sao. Văn bản sửa bằng tay được đánh dấu là nội dung người dùng thêm. Thư viện vẫn được lưu tại trình duyệt theo tài khoản.
- Nếu có sự cố provider, chỉ text có thể chuyển sang provider text còn được cấu hình. Không chuyển media/video sang text-only. Lỗi thông tin xác thực/quota không tự retry. Log token chỉ lấy từ metadata thật, không suy ra số lượng hay chi phí.

## Tích hợp

- `POST /api/ingest` body `{ "url": "https://..." }` → `{ kind, title, text, url, fetchedAt, truncated }`. Kiểm tra origin, session canonical/disabled/revoked, rate limit 8 lần/phút/tài khoản, một request đồng thời. Rate limit hiện giữ trong bộ nhớ một process; môi trường nhiều instance cần shared limiter.
- `POST /api/ai` nhận thêm `mode`, `difficulty`, `guidance`, `presentation`, `goal`, `youtubeUrl`, `videoRange: {startSeconds, endSeconds}`. Range chỉ dùng với YouTube/video, số nguyên không âm, độ dài 1–1800 giây, kết thúc không quá 48 giờ. Yêu cầu video thiếu range mặc định 0–600 giây. Trường mới đều được validate. Chỉ `youtubeUrl` được allowlist mới có thể thành file URI.
- `AIResult.usage` có `inputTokens`, `outputTokens`, `cachedTokens`, `totalTokens` tùy metadata provider; trường thiếu là chưa biết, không phải 0.
- Model chính từ biến môi trường hiện có. Có thể override từng chế độ bằng `OPENAI_MODEL_QUICK`, `OPENAI_MODEL_THINK`, `OPENAI_MODEL_DEEP`, `OPENAI_MODEL_TUTOR` và tương tự `GEMINI_MODEL_*`. Không có model hay khóa bí mật nào nằm trong mã frontend.
- CSS: import `app/learning-extra.css` sau stylesheet cơ sở.

## Kiểm tra

`node tests/ingestion.cjs` có 25 kiểm tra URL/SSRF/DNS/redirect/giới hạn byte, parser đối kháng, phụ đề, contract chế độ học, video range/metadata, graph không hợp lệ, timestamp không có nguồn hoặc ngoài phạm vi, output bị cắt, token metadata, fallback và source/artifact/frame backup bằng mock. Không dùng API key thật hoặc truy cập mạng trong bộ test. Chạy cùng `node tests/core.cjs` (9 kiểm tra) và `pnpm typecheck`.
