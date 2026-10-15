# Lumio AI 3.2 — báo cáo bàn giao Teacher Workspace

Source: `3.2.0-teacher.1`, SQLite migrations 1–13. Giữ Next.js, NextAuth, AI Router, credit và các chức năng học cá nhân hiện có. Hướng dẫn mở và sử dụng: [TEACHER-WORKSPACE.md](../../TEACHER-WORKSPACE.md).

## Đã triển khai

Không gian giáo viên có đủ 12 khu vực với dữ liệu lưu qua API/SQLite: tổng quan, lớp/nhóm/mã mời/đồng giảng viên, giáo án, giao bài, ngân hàng câu hỏi, chấm/nhận xét, phân tích kết quả đã công bố, học liệu, thông báo/lịch, trợ lý AI, báo cáo và cài đặt. `/classroom` dành cho học sinh tham gia lớp, nhận bài, nộp và xem kết quả đã công bố. `/admin` giữ luồng xét bản khai giáo viên.

Quyền được kiểm phía máy chủ theo tài khoản, tổ chức, lớp và đối tượng nhận bài. Đáp án/rubric nội bộ và điểm chưa công bố không gửi xuống payload học sinh. AI tạo nháp; giáo viên kiểm tra, xác nhận rồi công bố ở bước riêng. Nguồn khớp trích đoạn không đồng nghĩa mọi khẳng định đúng. Hồ sơ giáo viên được duyệt trong ứng dụng không chứng nhận nghề nghiệp.

## Kiểm tra bản chốt

- `pnpm test`: **711 assertion PASS**, gồm 600 kiểm tra hiện có và 111 kiểm tra mới. Không cộng lặp các suite bên dưới thành một tổng khác.
- `pnpm build`: **PASS** trên checkout nguồn sạch sau các sửa runtime cuối; TypeScript được kiểm trong build.
- `pnpm audit --prod --json`: **0 advisory đã biết** tại thời điểm kiểm; đây không là chứng nhận không có lỗ hổng.
- Backend mới **49 PASS**, QA nội dung **38 PASS**, API/credit **24 PASS**. Các transport của suite API bị chặn trong fixture, không phải provider thật.
- UI **55 browser +32 SSR/pure PASS**, viewport 390/768/1440 và reduced-motion. Bao gồm sửa lỗi tải lại: nạp danh mục rồi nạp không gian có quyền, không tạo bản sao. HTTP tổng hợp; không thiết bị hoặc học sinh thật. Ảnh minh chứng tổng hợp ghi nhãn kiểm thử.
- Compiled Next + HTTP + SQLite riêng **8 PASS**, bao phủ bốn giai đoạn và sao lưu/khôi phục sang tệp DB khác. Tài khoản/phiên tổng hợp; không giả business handler hoặc thêm đăng nhập thử vào sản phẩm.
- **2 request provider thật HTTP200** trên server local đã biên dịch: giáo án và hai câu trắc nghiệm từ nguồn tự soạn. Giữ review-required; giáo án còn phần thiếu reference, bộ kiểm Toán hữu hạn chưa kiểm được prose. Cùng UUID không gọi hoặc trừ credit lần hai. Chưa phải benchmark chất lượng.

Report chi tiết và ma trận 12 module: [ACCEPTANCE.md](ACCEPTANCE.md), các JSON cùng thư mục và [UI report](../v3/qa-teaching-ui-report.json). Kiểm tra public được ghi riêng; report local không tự chứng minh bản mạng đã chạy.

## Kiểm tra public

Bản Teacher Workspace ban đầu đã triển khai lên Render Free tại [Lumio](https://lumio-ai-demo.onrender.com/teacher), commit `2e3c2299f2fa43a88a9c00b3b3b74156ab7af86c`. Google OAuth thật vào được không gian của chủ dự án. Đã tạo một tổ chức/lớp kiểm thử rỗng, một nguồn tự soạn và gọi một giáo án AI thật qua UI có consent; không tạo học sinh, bài nộp hoặc điểm giả.

Mẫu AI public có năm heading tiếng Việt và một ví dụ điều kiện/kiểm tra nghiệm đúng khi đối chiếu thủ công. Còn một cụm “Exit check” ở nội dung và hai phần thiếu trích đoạn; cần biên tập. Đầu ra gốc ở [public-ai-draft-output.json](public-ai-draft-output.json); ảnh [giáo án nháp](public-ai-lesson.png) được chụp sau đổi cụm đó sang tiếng Việt, làm rõ bài luyện thêm là đề xuất AI, rồi lưu nháp. Không đánh dấu đã xem lại hoặc công bố. Đây là một mẫu hoạt động, không phải đánh giá hiệu quả dạy học.

Trong lần tải lại public đã phát hiện lỗi chọn không gian ban đầu. Bản sửa `6d5d6b490cc7fd57107809b1845c314e46ea0e4c` chỉ thay client tải dữ liệu, giữ AI Router/backend không đổi. Đã thêm ba case UI, build lại và chạy lại tám case compiled HTTP đạt. Bằng chứng kiểm lại sau triển khai nằm ở report public riêng.

**Bản cuối đã Live**, deployment `dep-db8fuc8473hc73aiud4g`. Google đăng nhập mới thành công; tạo tổ chức/lớp kiểm thử rồi tải lại tự nạp đúng lớp và quyền, không cần chọn lại. `/classroom` nhận đúng vai trò giảng dạy; `/admin` mở được hàng đợi giáo viên rỗng. Sáu kiểm tra HTTPS ẩn danh đạt, API lớp/xuất chặn401. Xem [public-live-check.json](public-live-check.json), [public-http-report.json](public-http-report.json) và [ảnh dashboard](public-teacher-dashboard.png).

Lần redeploy Free đã xóa DB kiểm thử trước, gồm giáo án AI vừa lưu, nên phải đăng nhập và tạo lại lớp rỗng. Ảnh/đầu ra giữ làm bằng chứng của lần AI trước; bản cuối không tự gọi lại AI để tạo hình minh họa. Không dùng môi trường này giữ sổ điểm chính thức.

## Giới hạn còn lại

Render Free/SQLite chưa là kho bền vững nhiều máy; reset host có thể mất dữ liệu. Có giới hạn dung lượng, CAS, quota, audit và công cụ snapshot; chưa có off-host DR/load test/toàn bộ job hạ tầng production. Chưa có pilot học sinh/giáo viên thật hoặc số liệu hiệu quả học tập. Analytics là kết quả quan sát, không chẩn đoán năng lực ổn định.

Giao diện chưa mở lại bài đã công bố để regrade, và học sinh chưa có UI sửa bài đã nộp dù API có hỗ trợ theo trạng thái. PDF dùng In → Lưu PDF của trình duyệt; chưa có dịch vụ PDF máy chủ. Thông báo trong ứng dụng, chưa email/push. Tùy chọn AI ẩn danh không bảo đảm loại hết thông tin riêng tư do người dùng nhập.

Source Flutter/Dart và Electron đi kèm không phải APK/IPA/EXE mới; Teacher Workspace chưa được kiểm trên thiết bị vật lý hoặc đồng bộ native đầy đủ. Thanh toán thật tiếp tục tắt. Biên nhận khu vực V3.1 được giữ, không tự tạo lần nộp mới.
