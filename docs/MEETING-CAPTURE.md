# Thu âm buổi học trên Lumio

Mở **Lumio Voice**, tới **Ghi chú buổi học**, rồi bấm **Chọn nguồn âm thanh**. Tính năng không tự mở micro hoặc tự bắt đầu ghi.

Trên Chrome hoặc Edge ở Windows:

1. Nếu học bằng Zoom/Meet/Teams trên trình duyệt, chọn tab đang phát bài học và bật **Chia sẻ âm thanh**.
2. Nếu dùng ứng dụng Zoom trên máy, chọn toàn màn hình và bật **Chia sẻ âm thanh hệ thống** nếu trình duyệt có tùy chọn này. Âm thanh hệ thống có thể gồm tất cả ứng dụng đang phát tiếng. Chọn một cửa sổ không đảm bảo có âm thanh, hoặc chỉ thu được tiếng cửa sổ đó.
3. Chỉ bật **Thu cả micro của tôi** nếu muốn ghi thêm phần bạn nói. Tùy chọn mặc định tắt; trình duyệt sẽ hỏi thêm quyền micro. Dùng tai nghe để hạn chế âm thanh bị lặp/tiếng vọng.
4. Bấm **Tạm dừng / Ghi tiếp / Hoàn tất bản ghi**. Tạm dừng chỉ dừng ghi dữ liệu, nguồn chia sẻ vẫn hoạt động. **Hủy thu âm** bỏ lần ghi đang thực hiện và kết thúc toàn bộ nguồn thu.
5. Nghe lại hoặc **Tải âm thanh**. **Dùng để chép lời** chỉ đưa bản ghi sang Lumio Voice. Bấm nút **Chép lời** riêng để gửi dữ liệu qua tài khoản; cổng API hiện có vẫn kiểm tra quyền, credit và giới hạn tệp.

Tối đa 10 phút hoặc 8 MiB mỗi bản ghi, bitrate mục tiêu 64 kbps. Nếu bản ghi vượt giới hạn kích thước, bỏ lần ghi đó để tránh xuất tệp cắt hỏng; bản ghi hoàn chỉnh trước đó vẫn được giữ. Tổng thời gian nguồn chia sẻ hoạt động giới hạn 30 phút, kể cả thời gian tạm dừng. Ghi buổi học dài thành các đoạn ngắn; chưa có chế độ tự chia đoạn hoặc tự chép lời liên tục.

Chỉ âm thanh được đưa vào MediaRecorder. Screen Capture API yêu cầu luồng video để cấp quyền/chọn nguồn; luồng video này chỉ duy trì phiên chia sẻ tại thiết bị và không được ghi, lưu hay tải lên. Các track audio/video, micro, output của bộ trộn và AudioContext đều được giải phóng khi dừng, hủy, nguồn kết thúc, lỗi, chuyển trang hoặc quyền cấp muộn sau khi đã hủy. Bộ trộn không nối vào loa, tránh vòng phản hồi âm thanh.

Việc ghi tại máy không cần đăng nhập; dữ liệu ở bộ nhớ của trang và mất khi đóng trang trừ khi bạn tải về. Chuyển qua mục khác cũng kết thúc phiên thu. Trình duyệt hỏi chọn nguồn mỗi lần; Lumio không lưu quyền nghe mọi ứng dụng. Chỉ ghi khi người tham gia đã biết/đồng ý. Chưa kiểm tra âm thanh Zoom thật trên mọi thiết bị; QA sử dụng luồng tổng hợp và không nghe dữ liệu họp của người dùng.

## Dành cho lập trình

`MeetingRecorder` nhận `locale`, `disabled`, `onActiveChange(active)` và `onUseRecording(recording)`. Callback sau cùng chỉ chạy khi người dùng bấm **Dùng để chép lời**, không chạy ngay khi kết thúc ghi. Đặt `disabled` bằng trạng thái bận của các thao tác Voice khác, không đặt bằng trạng thái hoạt động của chính MeetingRecorder. `MeetingCapture` có môi trường media/timer tách riêng để kiểm tra các trường hợp quyền chậm, tài nguyên và giới hạn mà không truy cập thiết bị.

Chạy `node tests/meeting-capture.cjs` tại thư mục web. Kiểm tra trình duyệt tổng hợp nằm tại `tests/meeting-capture.browser.js`; không cấp quyền nghe Zoom thật cho công cụ kiểm thử.

Tài liệu tham chiếu: [Screen Capture — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [Screen sharing controls — Chrome](https://developer.chrome.com/docs/web-platform/screen-sharing-controls), [MediaRecorder — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder).
