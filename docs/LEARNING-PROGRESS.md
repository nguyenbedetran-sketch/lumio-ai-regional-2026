# Tiến độ học và chuông tập trung

Chuỗi ngày học tính theo ngày địa phương trên thiết bị. Hôm nay có hoạt động thì chuỗi kết thúc ở hôm nay; nếu chưa học hôm nay, chuỗi của ngày hôm qua vẫn được giữ đến hết ngày. Một ngày bỏ trống làm gián đoạn chuỗi. Đăng nhập, mở ứng dụng hoặc mở tài liệu rồi đóng ngay không tạo tiến độ.

Các hoạt động được ghi nhận: đọc nội dung đang hiển thị khoảng 20 giây, lưu thay đổi ghi chú có nội dung, nhận câu trả lời hoặc tóm tắt thành công, hoàn thành quiz, tự đánh giá thẻ ôn, hoàn thành mục tiêu và kết thúc phiên tập trung. Mỗi loại tương tác với một tài liệu chỉ ghi một lần trong ngày; kết quả quiz không bị cộng hai lần. Các bản tóm tắt đã lưu từ phiên bản trước có thời điểm tạo được dùng làm bằng chứng học tập. Không suy đoán lịch sử từ thời điểm đăng nhập, mở tài liệu hoặc ghi chú không có thời gian đáng tin cậy.

Lịch bảy ngày hiển thị ngày có hoạt động. Điểm chính xác vẫn chỉ tính từ quiz đã làm; chuỗi ngày học không phải điểm thành thạo. Dữ liệu thuộc tài khoản hiện tại trên trình duyệt này và đi kèm bản sao JSON. Bản sao phiên bản 1 cũ vẫn đọc được. Ngày địa phương của sự kiện mới được lưu cùng sự kiện để việc đổi múi giờ không chuyển lịch sử đó sang ngày khác.

Trong **Phòng tập trung**, chọn thời lượng rồi bấm **Bắt đầu tập trung**. Đồng hồ vẫn chạy khi chuyển mục trong Lumio; tạm dừng và đặt lại không cộng phút. Phiên hết thời gian chỉ được ghi một lần, kể cả khi tải lại hoặc mở nhiều tab. Phiên đã hết từ lâu được khôi phục vào lịch sử mà không đột ngột phát chuông.

Chọn **Chuông dịu**, **Chuông trong**, **Âm chim hót**, **Âm thanh riêng** hoặc **Im lặng**. Có thanh âm lượng và nút **Nghe thử**. Chuông có sẵn được tạo bằng Web Audio ngay trên thiết bị, không gọi API. Bấm bắt đầu hoặc nghe thử để trình duyệt cho phép phát tiếng. Giữ Lumio mở; khi máy ngủ hay trình duyệt tạm ngưng, âm báo có thể trễ. Sau khi tải lại trang, nếu âm thanh chưa được cho phép, Lumio hiển thị thông báo cần nghe thử.

Âm thanh riêng tối đa **5 MB và 2 phút**, phải được trình duyệt giải mã thành công. Nút nghe thử phát tối đa 5 giây; cuối phiên phát tối đa 8 giây đầu. Mỗi tài khoản chỉ lưu một tệp dưới dạng Blob trong IndexedDB của trình duyệt. Thay tệp sẽ thay bản cũ; nút xóa xóa tệp của tài khoản hiện tại. Tệp này **không có trong bản sao JSON**; sau khi chuyển thiết bị hoặc nhập bản sao, chọn lại tệp hoặc một chuông có sẵn. Bản sao chỉ chứa lựa chọn và âm lượng. Không tải âm thanh lên dịch vụ bên ngoài.

Hiệu ứng chuỗi ngày và phiên tập trung dựa trên trạng thái thật. Cài đặt giảm chuyển động của hệ điều hành được tôn trọng.
