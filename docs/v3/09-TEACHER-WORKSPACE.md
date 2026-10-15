# Không gian giáo viên và góc học sinh

## Mở và dùng

1. Khởi động dự án theo README, mở `/teacher`. Khách và tài khoản chưa có quyền giáo viên vẫn thấy hồ sơ đăng ký hiện có. Tài khoản giáo viên đã được duyệt hoặc SUPER_ADMIN thấy không gian giảng dạy. Không có tài khoản học sinh, điểm hoặc lớp mẫu trong sản phẩm.
2. Tạo một không gian, sau đó vào **Lớp học → Tạo lớp**. Trong lớp, tạo mã tham gia có giới hạn ngày/lượt; gửi riêng mã này cho học sinh. Quản trị có thể phân công đồng giảng dạy bằng mã tài khoản giáo viên đã được duyệt và điều chỉnh thành viên trong Cài đặt.
3. Học sinh đăng nhập ở `/classroom`, nhập mã, rồi xem tài liệu và bài tập được chia sẻ cho mình. Tên tài khoản và bài làm trong lớp được giáo viên có quyền xem; dữ liệu học riêng ngoài lớp không tự chia sẻ.
4. **Thư viện giảng dạy** nhận văn bản hoặc trích xuất PDF/DOCX/PPTX/TXT. Xem văn bản đã xử lý trước khi lưu. Bản quét cần OCR hoặc phương trình Office không trích xuất được không được coi là nội dung đã đọc. URL nhập vào là địa chỉ nguồn, không tự thu thập website hay toàn bộ video.
5. Soạn **Studio bài giảng** và **Ngân hàng câu hỏi**, sửa nội dung rồi đánh dấu đã kiểm tra. AI hỗ trợ tạo bản nháp, không tự lưu hoặc xuất bản. Nguồn có trích đoạn hiển thị đúng phiên bản/vị trí đã kiểm chứng; chủ đề không có nguồn được ghi là suy luận chưa được nguồn xác nhận.
6. **Bài tập** chọn câu hỏi đã duyệt, lớp, toàn lớp/nhóm/cá nhân, hạn nộp. Lưu nháp, duyệt, sau đó giao. Đề và đối tượng đã giao được đóng băng. Học sinh chủ động xác nhận nộp bài.
7. **Chấm & nhận xét** dùng đề đã giao và tiêu chí chấm. Giáo viên xác nhận điểm/nhận xét rồi lưu. **Công bố kết quả** là hành động riêng; trước đó học sinh không được nhận đáp án, tiêu chí nội bộ hoặc điểm chưa công bố.
8. **Tiến bộ học tập** dùng kết quả đã công bố. Dưới ba bài theo chủ đề ghi chưa đủ bằng chứng. Bảng lựa chọn cần xem lại chỉ đếm câu trắc nghiệm thực trả lời theo khóa của phiên bản đề đã giao; bỏ qua câu trống và bài chưa công bố. Gợi ý dạy lại là hoạt động theo quy tắc, không chẩn đoán nguyên nhân hay khẳng định thành thạo.
9. **Bảng tin & lịch** lưu thông báo nháp/đăng riêng, lịch học/hạn cần nhớ/buổi gặp. Chưa có email, thông báo đẩy hoặc lịch đồng bộ bên ngoài. Nhãn số thông báo là tổng đã đăng, không phải số chưa đọc.
10. **Báo cáo** chỉ xuất kết quả đã công bố. CSV có vô hiệu hóa dữ liệu có thể kích hoạt công thức. **In / Lưu PDF** dùng hộp thoại in của trình duyệt. Tệp chứa tên/kết quả, cần lưu và chia sẻ riêng theo mục đích phù hợp.
11. **Cài đặt** lưu tên/múi giờ/cho phép nộp muộn của tổ chức, quyền thành viên và tùy chọn cá nhân: tên hiển thị, môn, khối, ngôn ngữ AI, độ khó, bật/tắt AI, nhãn thông báo. Tên hiển thị không đổi hồ sơ xác minh. Mỗi lần gửi AI vẫn cần đồng ý riêng.

## Phạm vi 12 mô-đun

| Mô-đun | Đã kết nối giao diện với hành động máy chủ |
|---|---|
| Tổng quan | Số liệu thật từ state, bài gần đây, lịch; CTA cho dữ liệu trống |
| Lớp học | Tạo/sửa/lưu trữ, mã mời, thu hồi, học sinh ngừng/khôi phục, nhóm, đồng giảng dạy |
| Studio bài giảng | Soạn thủ công hoặc bản nháp AI, mục tiêu/phần/nội dung/nguồn, sửa/lưu/duyệt/chia sẻ, Markdown |
| Bài tập | Nháp/duyệt/giao/đóng, hạn và phạm vi lớp/nhóm/cá nhân, đề đóng băng |
| Ngân hàng câu hỏi | Trắc nghiệm/tự luận/ngắn, đáp án, giải thích, tiêu chí, điểm, nguồn, xem lại |
| Chấm & nhận xét | Câu trả lời/tiêu chí, điểm mỗi câu, xác nhận giáo viên, công bố riêng, góp ý AI trên đoạn tự ẩn danh |
| Tiến bộ học tập | Kết quả công bố, ngưỡng bằng chứng, lựa chọn sai quan sát và gợi ý hoạt động dạy lại |
| Thư viện giảng dạy | Tìm/lưu/sửa, tệp đã xử lý, nguồn chứng thực, duyệt/chia sẻ, xuất văn bản |
| Bảng tin & lịch | Nháp/đăng thông báo, tạo/sửa/xóa lịch |
| Trợ lý giảng dạy | Nguồn đã lưu hoặc chủ đề, đồng ý xử lý bên ngoài, kết quả nháp và hạn chế nguồn |
| Báo cáo | Lọc lớp, CSV, in/Lưu PDF từ kết quả công bố |
| Cài đặt | Tổ chức/thành viên, tùy chọn giáo viên lưu máy chủ, quyền riêng tư |

## Xử lý AI, mạng và quyền

- Gửi tối đa ba nguồn đã lưu, tổng văn bản tối đa 30.000 ký tự. Giao diện chỉ gửi ID nguồn; máy chủ tự kiểm tra tổ chức, quyền và phiên bản. Đoạn nhận xét phải tự ẩn danh; không tự gửi hàng bài làm/tên học sinh cho AI.
- Mỗi lượt AI có UUID thanh toán. Không tự thử lại khi phản hồi mạng không chắc chắn. Gửi lại nguyên nội dung giữ UUID để tránh khoản trừ trùng. Một lượt đã kết thúc không khôi phục bản nháp thất lạc; bắt đầu lượt mới là lựa chọn riêng và có thể dùng thêm credit.
- Tắt AI trong tùy chọn được máy chủ thực thi; vẫn soạn thủ công được. AI không tự chấm/công bố hay đặt kết quả thành đã được giáo viên kiểm tra.
- Mọi ghi dữ liệu có UUID, kiểm tra phiên bản và tài khoản hiện tại. Thử lại cùng thay đổi khi mất phản hồi dùng cùng UUID; không tự tạo thêm bản. Xung đột yêu cầu tải lại/đối chiếu.
- Không có hàng đợi ghi ngoại tuyến. Nội dung chưa gửi chỉ còn trên trang đang mở. Khi nhận 401/403 đúng yêu cầu hiện tại hoặc phản hồi sai tài khoản, xóa dữ liệu lớp đã tải khỏi giao diện; đóng bài tập học sinh theo quyền/phạm vi hiện tại. Phản hồi cũ không được áp dụng vào tài khoản/không gian mới.
- Responsive 390/768/1440, hộp thoại có bàn phím/focus, hỗ trợ giảm chuyển động. Không có dữ liệu lớp riêng trong HTML SSR của khách.
- Bản trình diễn miễn phí vẫn chịu giới hạn và vòng đời lưu trữ đã mô tả trong README/triển khai. Đây chưa phải triển khai trường học quy mô lớn hoặc bằng chứng cải thiện học lực thực tế.

## Kiểm chứng frontend

Chạy `node scripts/test-teaching-ui.cjs` khi máy chủ local cổng 3000 sẵn sàng. Bộ kiểm tra dựng chính React/CSS đang dùng vào một trang được chặn HTTP trong phiên trình duyệt dùng riêng; không thêm đường dẫn test hoặc bỏ qua đăng nhập trong sản phẩm.

- Báo cáo cuối: `docs/v3/qa-teaching-ui-report.json` — **55 kiểm tra trình duyệt, 32 kiểm tra SSR/hàm thuần PASS**. Luồng tạo lớp→nguồn→bài giảng→câu hỏi→giao→tham gia→nộp→chấm→công bố, UUID/mất phản hồi, tùy chọn, 401/403, riêng tư, responsive, TeX và mở lại tổ chức đã có sau tải trang được kiểm tra. Công thức dùng MathText/KaTeX hiện có với trust:false; nội dung giống HTML vẫn là văn bản, không trở thành phần tử HTML thực thi.
- Ảnh: `qa-teaching-desktop.png`, `qa-teaching-tablet.png`, `qa-teaching-mobile.png`, `qa-classroom-mobile.png` trong thư mục này. Đã xem trực quan; tên/lớp/bài làm trong ảnh là dữ liệu tổng hợp có nhãn KIỂM THỬ.
- Không có người học thật, thanh toán thật hoặc lần gọi nhà cung cấp AI trong bộ UI. Kiểm tra SQLite/handler/compiled HTTP và triển khai là báo cáo riêng; UI mô phỏng không thay thế các bằng chứng đó.
- Lần thử đầu có lỗi định vị quá chặt (mã mời kèm chú thích; textbox có datalist nhận vai trò combobox; tên nút có số chờ chấm). Đã sửa định vị/nhãn truy cập và chạy lại. Xem ảnh đã phát hiện/fix crop logo và thanh điều khiển học sinh trên điện thoại trước bản PASS cuối.
- Kiểm tra public phát hiện lỗi khôi phục tổ chức: GET không có `orgId` chỉ là danh mục thành viên, nhưng giao diện trước đó coi đó là không gian hoàn chỉnh. Đã sửa client thực hiện GET có phạm vi đầu tiên trước khi hiển thị, giữ cùng kiểm tra tài khoản/thứ tự yêu cầu/hủy. Fixture nay mô phỏng đúng danh mục rỗng dữ liệu riêng; kiểm tra tải lại xác nhận vai trò quản trị, lớp đã có và không tạo thêm tổ chức. Không thay đổi quyền hoặc dữ liệu máy chủ để sửa lỗi này.
