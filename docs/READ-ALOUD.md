# Đọc thành tiếng

Trong tài liệu, mở Studio học tập và chọn **Đọc ra tiếng**. Nội dung ưu tiên là kết quả vừa tạo, sau đó ghi chú hoặc văn bản nguồn. Bấm đọc để tạo âm thanh và phát ngay; việc mở tài liệu không tạo yêu cầu AI.

Nội dung dài được chia theo câu/đoạn, tối đa 3.000 ký tự mỗi phần. Chỉ khi phần hiện tại kết thúc mới tạo phần tiếp theo. Giao diện cho biết số phần và mức sử dụng 8 credit mỗi phần; máy chủ vẫn kiểm tra đăng nhập, quyền và credit. Giới hạn 200.000 ký tự/100 phần được báo rõ, không cắt lặng nội dung.

- Có điều khiển Play/Pause và **Dừng**. Dừng hủy yêu cầu đang chờ, xóa hàng đợi và giải phóng âm thanh trên trang.
- Nếu trình duyệt chặn tự phát, âm thanh vẫn hiện trong trình phát: bấm Play để nghe, không cần tạo lại và không trừ credit thêm cho thao tác phát.
- Lỗi mạng, định dạng âm thanh và phát âm thanh hiển thị cạnh nút để thử lại có chủ đích.
- Ngôn ngữ đọc đi theo ngôn ngữ đang chọn. Không hiển thị tên nhà cung cấp trong công cụ học.
- Trong **Phòng giọng nói**, nút đọc thủ công luôn phát câu trả lời dù tùy chọn tự đọc câu trả lời đang tắt. Tùy chọn này chỉ điều khiển các câu trả lời mới tự phát.
- Phát lại trong Phòng giọng nói bị chặn khi đang chọn nguồn, thu micro hoặc thu cuộc họp, tránh đưa tiếng của Lumio vào bản ghi.

Đọc AI cần dịch vụ đã cấu hình trên web và phiên đăng nhập hợp lệ. Bản Windows local chưa bật đọc AI; có thể nghe bản thu hoặc mở bản web trên máy.

Kiểm tra: `node tests/readout.cjs` có 17 kiểm tra logic; `pnpm test:readout` có 40 kiểm tra trình duyệt với âm thanh và API giả, gồm tự phát, tự phát bị chặn, nội dung dài, hủy, lỗi và nút đọc thủ công. Chưa kiểm tra giọng đọc trả phí hoặc thiết bị loa thật trong đợt này.
