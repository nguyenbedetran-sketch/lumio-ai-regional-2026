# AI26A0048 — kiểm tra ban đầu vòng khu vực

Ngày kiểm tra: 15/10/2026. Nâng cấp trực tiếp Lumio Web 1.5, không viết lại sản phẩm. Android/Windows giữ mã nguồn trước đó; ưu tiên bản web có AI thật theo đánh giá ban tổ chức.

## Trạng thái trước nâng cấp

| Hạng mục | Kết quả quan sát / vấn đề |
|---|---|
| Kiến trúc | Next.js 15.5.12 / React 19 / TypeScript, API Node 24, SQLite đồng bộ; thư viện người học IndexedDB/localStorage; Flutter/Dart và Electron là hai dự án kèm theo |
| AI integration | Chạy kiểm tra trực tiếp ngày 15/10: tutor trả đúng phép cộng cố định; multimodal trả đúng phép cộng cố định; TTS trả dữ liệu âm thanh hợp lệ. Đây chỉ là kiểm tra kết nối, chưa chứng minh chất lượng dạy học |
| Public deployment | render.yaml bật LUMIO_PUBLIC_DEMO=true, LUMIO_AI_ENABLED=false, script public chủ động từ chối credentials/accounts/database. Không thể sửa bằng cách thêm API key mà giữ nguyên cấu hình này |
| API | /api/ai có xác thực canonical account, giới hạn 15/phút và 150/ngày, một yêu cầu đang chạy, timeout 60s, credit reservation/settle/refund và log metadata. Chưa kiểm thử URL public đầy đủ |
| Tutor | Chấp nhận history và guidance từ client; full mở ngay, quick/think/deep có thể bỏ qua hướng dẫn. Không có phiên/bộ đếm gợi ý máy chủ |
| Math | Có yêu cầu kiểm tra điều kiện trong prompt; chưa có bộ kiểm tra phép biến đổi độc lập hoặc 10 kịch bản tham chiếu |
| Sources | Có SSRF protection URL, phụ đề theo thời gian và kiểm tra quote của summary. Chưa có citation cho câu trả lời, quiz/cards; PDF gửi trực tiếp đa phương thức, chưa tách trang; DOCX/PPTX chưa hỗ trợ |
| Generated learning | Quiz/cards kiểm tra cấu trúc, summary có kiểm tra graph/range. Chưa chặn đầy đủ lựa chọn trùng/mơ hồ, chưa có topic/difficulty/reference metadata |
| Personalization | Có lượt thích/không thích, lịch ôn, độ chính xác quiz tổng hợp, logistic/neural ranker cục bộ. Chưa tách sở thích/năng lực đủ rõ; chưa có chọn chủ đề/độ khó/mục tiêu, đa dạng hóa và bằng chứng theo từng câu sai |
| Privacy | Có trang privacy nói rõ ba bộ xử lý, local/server boundaries và log metadata. Chưa có bảng dữ liệu sắp gửi ngay trước thao tác AI; retention/xóa phiên gia sư cần bổ sung khi lưu hội thoại |
| Evidence | Có kết quả kiểm tra các đợt trước. Chưa có bộ minh chứng tương ứng yêu cầu vòng khu vực hoặc thử nghiệm học sinh thật cho phiên bản này |

## Thứ tự xử lý

1. P0: khôi phục đường chạy AI thật trên bản triển khai, bảo vệ key/credit và chọn cơ sở dữ liệu bền vững phù hợp hosting. Render Free mất SQLite khi restart; không coi lưu SQLite tạm là triển khai production hoàn chỉnh.
2. P0: phiên gia sư thuộc từng tài khoản/bài, gợi ý có ý nghĩa, mở lời giải được kiểm tra máy chủ; không cho client đổi mode để bỏ qua.
3. P1: nguồn trích dẫn kiểm tra được, vị trí từ bộ trích xuất gốc; không dùng số trang do model tự đoán. Nâng chất lượng summary/quiz/cards.
4. P1: kiểm tra Toán có phạm vi rõ ràng, kiểm thử 10 bài và lưu hội thoại/thang đánh giá thật.
5. P1: kiểm soát đề xuất theo bằng chứng, minh bạch dữ liệu gửi và quyền xóa; thiết kế thử nghiệm tự nguyện.
6. P1: kiểm thử production/mobile/accessibility/error/authorization, chụp tính năng trong app, viết báo cáo PASS/PARTIAL/BLOCKED/NOT TESTED rồi xuất source sạch/GitHub/Drive/nộp hai URL.

Không có dữ liệu học sinh tình nguyện tại thời điểm kiểm tra. Không tạo số liệu trước/sau hoặc kết quả người dùng giả.
