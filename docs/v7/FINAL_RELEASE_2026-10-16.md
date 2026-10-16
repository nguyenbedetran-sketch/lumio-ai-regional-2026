# Bản public và biên nhận cuối lần 4

Đội **AI26A0048**, Bảng A · Miền Trung. Cổng thi xác nhận **12:57:27 ngày 16/10/2026 (UTC+7)**, hiển thị **Lần 4 · Bản dùng để chấm**, tổng bốn lần. Lần 1–3 vẫn còn; không gửi lần 5.

- [Website public](https://lumio-ai-demo.onrender.com/)
- [Thư mục minh chứng](https://drive.google.com/drive/folders/1ARB9KHRNnAiHRMd_FH8tHLY4C8dlWbzG)
- [PDF nghiệm thu sáu trang](https://drive.google.com/file/d/1YIX7x4sfS6QEhNYrLYLnA3eyjLyY5YRl/view)
- [Gói minh chứng cuối](https://drive.google.com/file/d/1jPl7xlpRlCpMCVqtBiLLNeNnvimfMRs3/view)
- [Source ZIP đúng runtime](https://drive.google.com/file/d/1urEnphXFzKBqJughuvydbvvjIdQ6WtcS/view)
- [Ảnh biên nhận](https://drive.google.com/file/d/1gplc41lPJAtz6EwRRFUlY2MutF10qGBT/view)
- [Biên nhận JSON](https://drive.google.com/file/d/1ffmuPIb51Crc9MARrr0nsTScPlviMSdo/view)
- [Đọc trước: trạng thái cuối và cách mở](https://drive.google.com/file/d/1U7L2L8AY6090A7uc-6IjTlL2KHgPxq5T/view)

## Runtime và kiểm tra thực tế

Runtime **`2e64bbba32a02ca9fa1c7f3e1e1110b4633fc7f9`**, version `3.3.0-rc.1`, schema17. Render Free deployment `dep-db8rlr6i0phs738pfau0` Live12:51:33 UTC+7, duration2m01s. Commit được đối chiếu trong dashboard Render; health chỉ xác nhận version/readiness, không tự chứng minh commit.

[CI đúng commit đã thành công](https://github.com/nguyenbedetran-sketch/lumio-ai-regional-2026/actions/runs/38857692333), gồm frozen install, regression, production build và TypeScript. Local cùng các gate đó exit0. Lỗi hydration admin do UTC ở server và UTC+7 ở client được tái hiện rồi sửa;5 SSR +14 Edge hydration checks đạt. Public Google/admin đăng nhập thật, tải ban đầu và tải lại không ghi lỗi/cảnh báo trong lượt kiểm tra. Public cuối:53 assertions qua20 HTTPS GET;13 API riêng trả401 cho khách; trang admin/teacher/classroom có cổng đăng nhập; mọi checkout tắt.

Một câu hỏi AI thật trên checkpoint62f trước bản sửa múi giờ đã trả đúng một gợi ý/câu hỏi cho `3x - 6 = 9`, nguồn đoạn5/3 và khóa lời giải1/3. Sổ credit: cấp200, giữ4, quyết toán0 bổ sung, khả dụng196/đang giữ0. Journal:1 lần chuẩn bị/1 phản hồi HTTP,0 lỗi/không rõ,1.578 token vào/544 ra, chi phí chưa biết. Không gọi lại AI sau thay đổi một formatter. Đây là một mẫu, tách riêng72 HTTP local qua năm lượt chạy; không phải tỷ lệ AI luôn đúng.

## Tệp đã kiểm tra

| Tệp | Bytes | SHA-256 |
| --- | ---: | --- |
| Source2e64 |17930955|`49a2e678f5a456d46da213d2dd1fe54c41935811acae0d61c6d2c1b2729f17c1`|
| PDF |2688147|`3ecd8964963d85b9579200142c9a17e39dbd5648354af700660045209a0a9d7e`|
| Minh chứng ZIP |23684827|`3c4b3d871e9d59f49bd1e3260bcfe01f6b2dc13b7f58dab7d36b243f54d111df`|

Source895 tệp khớp Gitblob và CRC; sáu đường dẫn loại trừ có giải thích (bốn ảnh lỗi lịch sử, hai raw log). Sáu giá trị secret đã cấu hình được quét,0 khớp; không có `.env` thật/DB người dùng/raw log. Đây là quét phạm vi cụ thể, không phải chứng nhận bảo mật toàn diện. Gói minh chứng84 tệp CRC đạt,22 ảnh fixture dán nhãn riêng với public. Metadata Drive xác nhận tên/kích thước/thư mục đích và anyone-reader; listing thư mục có các tệp cuối.

PDF/ZIP đóng băng trước khi bấm nộp nên trạng thái receipt trong chúng là sẵn sàng/chưa nộp. Biên nhận riêng và trang này là cập nhật mới hơn; không thay tệp đã băm. Commit tài liệu sau2e64 không đổi runtime đã triển khai.

## Giới hạn giữ nguyên

Render Free có dữ liệu máy chủ tạm, đã quan sát reset khi redeploy; không khẳng định backup/migration/DR production đạt. Học liệu local vẫn tách theo tài khoản trên trình duyệt. Chưa có pilot học sinh thật, nghiệm thu thiết bị native, merchant billing, invoice/USD budget hay durable multi-instance database. Thanh toán vẫn tắt. Backlog chưa hoàn thành nằm trong [feature matrix](FEATURE_MATRIX.md), không được đánh dấu xong chỉ vì đã nộp thi.
