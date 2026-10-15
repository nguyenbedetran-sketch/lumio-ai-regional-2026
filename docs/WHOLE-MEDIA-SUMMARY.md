# Tóm tắt toàn bộ video và âm thanh

Trong Studio học tập, **Tóm tắt** mặc định chọn **Toàn bộ nội dung**. Chỉ khi người dùng bấm tạo mới gửi yêu cầu AI; việc thêm tài liệu hoặc đọc metadata không gọi AI.

## Video

- Video tải lên: đọc thời lượng từ metadata của trình duyệt.
- YouTube: dùng IFrame Player API chính thức để thử đọc `getDuration()` từ trình phát. Không tự phát video. Nếu metadata chưa sẵn sàng, người dùng phát video hoặc nhập tổng thời lượng. Thời lượng tự nhập được ghi rõ trong bản đã lưu.
- Chỉ dùng video đã kết thúc, tối đa 12 giờ; livestream đang phát không được xem là nguồn hoàn chỉnh.
- Tự chia phạm vi từ 0 đến hết video thành các phần tối đa 10 phút. Không có khoảng trống giữa các phần; các mốc chương là thời gian tuyệt đối của video gốc.
- Gọi `/api/ai` lần lượt cho từng phần, giữ nguyên xác thực, gói sử dụng, kiểm tra credit, giới hạn tần suất và hoàn credit khi yêu cầu lỗi của máy chủ. Video 12 giờ có 72 yêu cầu; đủ credit và hạn mức là điều kiện cần.
- Chỉ ghép và lưu bản **toàn bộ** khi mọi phần đã trả về tóm tắt hợp lệ. Giữ mọi chương; bản đồ kiến thức gom các phạm vi thành tối đa 24 nhánh để điều hướng, không tạo thêm nội dung giả.
- Nếu hủy, mất kết nối hoặc hết credit, hiển thị số phần đã xử lý và trạng thái chưa hoàn thành. Giữ trang đang mở rồi bấm **Tiếp tục tóm tắt toàn bộ** để bỏ qua các phần đã xong. Bộ nhớ tiếp tục hiện ở trang đang mở; đóng trang hay đổi nguồn/ngôn ngữ/thời lượng sẽ bắt đầu một tác vụ khác.
- Muốn học một phần riêng: chọn **Chọn một đoạn**. Bản lưu đó vẫn ghi rõ đoạn đã yêu cầu, không được gắn nhãn toàn bộ.

## Âm thanh và văn bản

Âm thanh gửi nguyên tệp qua đường xử lý đa phương thức hiện có, không gán offset của video cho audio. Các chương âm thanh có mốc ước lượng khi AI có thể nhận diện; có thể bấm mốc để nghe ở trình phát gốc. Giới hạn tệp inline vẫn là 6 MiB ở giao diện; tệp lớn hơn được từ chối rõ ràng.

Văn bản/phụ đề gửi toàn bộ nội dung đã cung cấp. Nhãn này không khẳng định bản chép lời là toàn bộ video gốc. Nếu nguồn nhập có cờ `truncated`, nút tóm tắt toàn bộ bị chặn cho tới khi bổ sung nội dung đầy đủ.

## Kiểm tra

`pnpm exec node tests/full-summary.cjs` dùng dữ liệu giả, không gọi AI trả phí. Bao gồm chia 12 giờ, 1.728 chương hợp lệ, bảo toàn mọi chương, thực thi tuần tự, dừng, tiếp tục, lỗi ở phần cuối và kiểm tra coverage/mốc thời gian khi nhập bản sao.

Browser QA dùng các API giả trong một phiên trình duyệt riêng, không dùng tài khoản hoặc âm thanh thật. Thành công của kiểm tra giả không chứng minh nhà cung cấp đã xử lý được một video cụ thể.

Tài liệu API chính thức: https://developers.google.com/youtube/iframe_api_reference#Retrieving_video_information
