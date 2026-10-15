# Lumio 1.4 — không gian học tập

## Chức năng đã thêm

- Thẻ ghi nhớ có hai mặt, hiển thị công thức bằng KaTeX. Enter/Space lật thẻ; ←/→ chuyển thẻ khi focus ở vùng học. Các nút Thẻ trước/Thẻ tiếp vẫn dùng được trên màn hình cảm ứng. Mặt đang ẩn không được đọc bởi trình đọc màn hình.
- Ôn tập theo lịch giữ thuật toán cũ, bổ sung phím 1/2/3/4 tương ứng Học lại/Khó/Nhớ được/Dễ sau khi mở đáp án. Mỗi lượt đánh giá có khóa để tránh ghi hai lần do bấm nhanh; focus trở về thẻ tiếp theo.
- Bài luyện tập lấy bản sao câu hỏi khi bắt đầu. Sửa thư viện trong lúc luyện không làm thay đổi đáp án hay tổng số câu của lượt đang làm. Tiến độ dựa trên câu đã trả lời; một lựa chọn đã chốt không đổi được. Kết quả hiển thị điểm thực, phần trăm và toàn bộ câu đã làm, gồm lựa chọn, đáp án và giải thích. Lượt hoàn thành vẫn dùng cấu trúc lịch sử cũ.
- Dùng A–D hoặc 1–4 để chọn đáp án trong vùng luyện. Phím tắt bỏ qua ô nhập, phím đang giữ và tổ hợp phím trình duyệt. Câu hỏi và nút Tiếp nhận focus theo lượt; kết quả nhận focus khi kết thúc.
- Đọc thoải mái: cỡ chữ 16/18/20 px, giãn dòng 1.6/1.9/2.2. Áp dụng cho nguồn văn bản, ghi chú, phần văn bản AI và mẫu kế hoạch; không sửa nội dung hay font của PDF nhúng. Chỉ hai tùy chọn typography lưu ở `lumio:reader-preferences:v1`, không lưu dữ liệu bài học/tài khoản vào khóa này. Nếu trình duyệt chặn lưu, có thông báo và cài đặt dùng được trong lần mở hiện tại.
- Studio hiển thị số tóm tắt, thẻ, câu hỏi và trạng thái ghi chú có thật của tài liệu. Không tạo dữ liệu minh họa hay tiến độ xử lý giả.
- Nháp transcript liên kết, kịch bản bản đọc, kế hoạch học, form tạo thẻ/câu hỏi và lượt quiz đang làm giữ trong bộ nhớ khi chuyển các tab của cùng tài liệu. Nháp chưa lưu mất khi đóng tài liệu/tải lại trang; ghi chú và nguồn đã lưu vẫn dùng bộ lưu thư viện theo tài khoản. Nội dung âm thanh cũ không được giữ khi phần bản đọc unmount; object URL được thu hồi như trước. Request bản đọc dùng khóa riêng để tránh gửi hai lần khi bấm nhanh; response sau khi hủy/đóng không tạo object URL mới.
- Tab tài liệu hỗ trợ ←/→/Home/End, `aria-controls`, `aria-labelledby` và một tab focusable tại một thời điểm.

## Chuyển động

Thẻ lật 3D trong chế độ đầy đủ; workbench, phản hồi và vòng điểm xuất hiện bằng chuyển động ngắn. Không có vòng lặp tự phát, tự chạy âm thanh hay gọi AI do animation. Dataset `motion=off` hoặc `motion=subtle` đổi mặt thẻ tức thì, bỏ 3D; thiết lập giảm chuyển động của hệ điều hành có ưu tiên. Có thể đổi chế độ ngay khi đang học mà không reset câu trả lời, bản nháp hoặc timer.

## Tích hợp và kiểm tra

Root layout cần import `./study-v3.css` sau các CSS hiện tại. Lệnh kiểm thử bổ sung: `node tests/study-v3.cjs` (11 kiểm tra logic, preference và copy đủ 5 ngôn ngữ). Các kiểm tra gồm dữ liệu lưu hỏng, giới hạn typography, bỏ trường riêng tư, snapshot không bị thay đổi, điểm không tính câu chưa trả lời và phím tắt không chiếm ô nhập/tổ hợp trình duyệt.

`tsc --noEmit` đã qua sau thay đổi phần này. Kiểm tra giao diện tích hợp cần thử thẻ/quiz/ôn tập trên desktop và mobile, giảm chuyển động, sáng/tối, nháp khi đổi tab, tải lại cài đặt đọc. Các API, giới hạn credit và dữ liệu thư viện theo tài khoản vẫn qua các luồng hiện có.
