# Lumio Dashboard v3

Trang Tổng quan mới dùng dữ liệu học đã lưu trên trình duyệt hiện tại. Các số trong sơ đồ là số tài liệu, bài quiz đã hoàn thành, lượt ôn thẻ và mục tiêu đã hoàn thành hôm nay. Đây là đường dẫn nhanh đến các trang tương ứng; không phải điểm thành thạo kiến thức.

## Bước tiếp theo

Gợi ý theo thứ tự: tiếp tục đồng hồ đang chạy hoặc tạm dừng; thẻ đến lịch ôn; mục tiêu chưa hoàn thành hôm nay; tài liệu có kết quả quiz gần nhất dưới 80%; tài liệu vừa mở hoặc cập nhật; mở thư viện nếu chưa có tài liệu.

Gợi ý luyện tập chỉ dựa trên tối đa ba bài quiz hoàn thành gần nhất của từng tài liệu, tính theo tổng số câu trả lời đúng / tổng số câu hỏi. Mốc 80% là quy tắc gợi ý đơn giản, không phải đánh giá năng lực hay kết quả machine learning. Bài quiz có ngày trong tương lai, ngày không hợp lệ hoặc điểm không hợp lệ bị loại. Tài liệu đã xóa khỏi mục tiêu sẽ dẫn về kế hoạch học thay vì mở dữ liệu không còn tồn tại.

Vòng tiến độ là tỷ lệ số mục tiêu hoàn thành / số mục tiêu đã đặt cho hôm nay. Khi chưa có mục tiêu, hiển thị lời mời tạo mục tiêu và biểu tượng thay vì một tỷ lệ gây hiểu nhầm.

## Chuyển động

Giao diện luôn có trạng thái tĩnh nhìn thấy được. Các phần xuất hiện bằng Web Animations API tối đa một lần khi đi vào màn hình; các đường nối SVG vẽ trong thời gian hữu hạn. Không có vòng lặp trang trí chạy liên tục. Bộ đếm chỉ chuyển động khi giá trị lưu thật thay đổi; nội dung cho trình đọc màn hình luôn là giá trị hiện tại.

Trang theo dõi `document.documentElement.dataset.motion` (`full`, `subtle`, `off`), tùy chọn giảm chuyển động của hệ điều hành và trạng thái ẩn của trang. Thay đổi tùy chọn giữa phiên sẽ hủy chuyển động đang chạy. Không thay thế hoặc chờ animation để tháo trạng thái học của trang.

## Kiểm tra

Chạy `node tests/dashboard-insights.cjs` để kiểm tra các điều kiện gợi ý, thời điểm đến lịch ôn, dữ liệu quiz hợp lệ, thứ tự tài liệu, khử sự kiện trùng và bản dịch đủ năm ngôn ngữ. Kiểm tra toàn dự án bằng `npm run typecheck`.

Các tệp chính: `components/lumio/dashboard.tsx`, `components/lumio/dashboard-motion.tsx`, `lib/lumio/dashboard-insights.ts`, `lib/lumio/dashboard-v3-copy.ts`, `app/dashboard-v3.css`.
