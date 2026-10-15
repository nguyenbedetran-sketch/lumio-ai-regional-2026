# Phong cách trình bày Toán từ tài liệu tham khảo

## Nguồn và phạm vi đã đọc

Nguồn người dùng: `E:\scule\lop_9\Toán C\Thaylamm.zip`, 43.641.562 byte. Kiểm kê trước khi trích xuất: 120 ảnh JPEG và một mục thư mục, tổng dữ liệu ảnh 51.726.481 byte; không có PDF, DOCX hoặc tệp chương trình. Kiểm tra đường dẫn, kích thước từng mục, tỷ lệ nén và tổng dung lượng trước khi đọc ảnh. Không chạy nội dung trong ZIP và không gửi ZIP hoặc ảnh tham khảo đến API bên thứ ba.

Đã xem contact sheet của toàn bộ 120 ảnh để chọn mẫu, sau đó đọc ảnh lớn của 13 trang dưới đây. Số thứ tự là chỉ số 0-based trong inventory, không phải số trang gốc. Đây là đánh giá phong cách từ mẫu đại diện, không phải OCR hoặc thẩm định toán học toàn bộ kho. Một ảnh đầu chứa nội dung hành chính không liên quan nên không dùng làm mẫu lời giải.

| Chỉ số | Tiền tố tên ảnh trong ZIP | Nội dung quan sát                                                                                          |
| ------ | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 3      | 1783434323002             | Hằng đẳng thức mở rộng; thay giả thiết, phân tích mẫu thành nhân tử; chốt vế trái bằng vế phải.            |
| 21     | 1784385136535             | Dự đoán tính chất ghép cặp, chứng minh tính chất rồi mới áp dụng vào tổng.                                 |
| 29     | 1785248349454             | Rút gọn căn thức từng dòng; đưa bình phương ra khỏi căn qua giá trị tuyệt đối.                             |
| 38     | 1785594989643             | Nêu AM–GM cùng điều kiện không âm, chứng minh và xét dấu bằng.                                             |
| 47     | 1786199502512             | Dự đoán điểm rơi để tách hệ số, sau đó chứng minh bằng AM–GM và kiểm tra đồng thời các điều kiện dấu bằng. |
| 60     | 1786459946416             | Chặn biểu thức để thu hẹp giá trị nguyên; giải từng trường hợp và nhận/loại nghiệm.                        |
| 85     | 1788579659856             | Hình học tiếp tuyến: dựng đường kính phụ, lập các góc, đánh số quan hệ và kết luận.                        |
| 87     | 1788579659930             | Chứng minh tích tiếp tuyến–cát tuyến bằng đồng dạng rồi dùng Pythagore; chia hai ý rõ ràng.                |
| 100    | 1788676263873             | Góc và tam giác trong hình bình hành; có phần nháp định hướng tách khỏi lập luận chính.                    |
| 103    | 1788877579809             | Hoàn thành bình phương để dẫn tới công thức nghiệm; tách ba trường hợp biệt thức.                          |
| 110    | 1789222652108             | Viète; biểu diễn các tổng/tích đối xứng của nghiệm và kiểm tra điều kiện nghiệm.                           |
| 113    | 1789222676078             | Bài tham số: xét biệt thức trước, dùng quan hệ nghiệm, đối chiếu điều kiện.                                |
| 118    | 1789280073731             | Bất đẳng thức phụ, điều kiện dấu bằng không thể đồng thời xảy ra, kết luận bất đẳng thức nghiêm.           |

## Cách đưa vào Lumio

Trong tab Gia sư, mở tùy chọn học, chọn **Định dạng → Lời giải Toán** rồi chọn cách trình bày:

- **Vở học · theo tài liệu tham khảo**: điều kiện cần thiết, nhận xét hoặc ý tưởng ngắn khi hữu ích, lời giải biến đổi từng dòng có lý do, đối chiếu điều kiện/dấu bằng, kết luận đóng khung. Đây là lựa chọn mặc định của định dạng Toán.
- **Bài thi · ngắn gọn, đủ ý**: bỏ nháp và lời dẫn dài; giữ các lý do, trường hợp, điều kiện và kết luận cần thiết.
- **Từng bước cơ bản**: dạng lời giải số thông thường, chỉ sử dụng tiêu đề phù hợp với bài đang làm.

Chế độ **Gia sư + Gợi ý từng bước** vẫn chỉ đưa một gợi ý và một câu hỏi tiếp theo. Phong cách vở học/bài thi không được mở khóa lời giải đầy đủ. Khi cần cả bài giải, chọn hướng dẫn **Lời giải đầy đủ** hoặc chế độ trả lời phù hợp.

Các quy tắc được rút ra là quy tắc trình bày và sư phạm, không sao chép nét chữ, không gắn tên tác giả lên kết quả và không tuyên bố tác giả đã duyệt lời giải. Chỉ dẫn yêu cầu kiểm tra phép biến đổi; lỗi có thể có trong tài liệu không trở thành quy tắc bắt buộc.

## Những ràng buộc có chủ đích

- Điều kiện mẫu khác 0, căn bậc hai, phép bình phương và nghiệm ngoại lai phải được xét khi liên quan. Không dùng `⇔` cho một bước chỉ suy ra một chiều.
- Giữ `sqrt(u²) = |u|` đến khi đã biết dấu. Với bất đẳng thức, nêu điều kiện áp dụng và dấu bằng thực sự tương thích; không suy ra giá trị nhỏ nhất nếu không đạt được.
- Bài phương trình/Viète phân biệt hệ số đầu khác 0, nghiệm thực và hai nghiệm phân biệt, điều kiện mẫu theo tham số.
- Bài hình giữ thứ tự đỉnh tương ứng khi đồng dạng, viện dẫn định lý ở bước dùng, không coi hình nhìn giống vuông/song song là giả thiết. Đường dựng phụ phải được nói rõ.
- Ảnh/PDF vẫn qua khả năng đọc media hiện có. Người học cần chỉ rõ số bài khi ảnh có nhiều bài. Ký hiệu quan trọng mờ hoặc thiếu dữ kiện phải được hỏi lại; chưa có OCR confidence engine hoặc bộ vẽ hình hình học được kiểm chứng.
- Đây là **prompt profile**, không fine-tune hoặc deep learning trên 120 ảnh, không hệ thống truy xuất đáp án từ ZIP. Những ảnh đó không được đưa vào gói mã nguồn hay tự động gửi trong câu hỏi.
- Kiểm tra lại trong câu trả lời chỉ là tự kiểm của mô hình. Chưa có CAS/theorem prover độc lập; không cam kết mọi lời giải đúng hoặc tái tạo chính xác phong cách của một người.

## Mã và kiểm tra

`lib/ai/math-style.ts` chứa enum/profile; `lib/ai/contracts.ts` kiểm tra tập lựa chọn đóng; `lib/ai/router.ts` chỉ áp dụng phong cách vào chat có định dạng Toán, giữ schema JSON của summary/cards/quiz. `lib/ai/math-copy.ts` và `components/lumio/ai-panel.tsx` cung cấp tùy chọn bằng năm ngôn ngữ. LaTeX tiếp tục được hiển thị qua KaTeX với cấu hình không tin cậy.

Tests kiểm tra giá trị style không hợp lệ, không thay đổi routing ảnh, ngăn xung đột với gợi ý và JSON task, các chỉ dẫn về ký hiệu mờ/điều kiện/dấu bằng và chuỗi LaTeX. Đây là kiểm tra contract/prompt bằng mock; không tương đương chấm độ đúng của một tập bài Toán sinh ra bởi API.

Kịch bản kiểm tra thủ công nên có: căn `sqrt((x-2)²)` với `x < 2`; AM–GM có dấu bằng; bài Viète có mẫu chứa tham số; hình tiếp tuyến có nhãn rõ; ảnh thiếu dấu hoặc có hai bài chưa chọn. Không dùng đầu ra của những kịch bản chưa chạy làm bằng chứng chất lượng mô hình.
