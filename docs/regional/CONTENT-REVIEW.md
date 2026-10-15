# Kiểm tra nội dung AI thật trên học liệu tác giả soạn

Trạng thái tổng thể: **PARTIAL**. Đã gọi nhà cung cấp thật và kiểm tra mẫu cuối; phạm vi còn hẹp, chưa có giáo viên độc lập hay học sinh tham gia.

## Mẫu và kết quả

Nguồn kiểm tra do tác giả bộ kiểm thử soạn, gồm phương trình bậc nhất, phân thức và nghiệm bị loại, phương trình căn, tam giác vuông 6–8–10 và phân biệt đơn vị. Không chứa dữ liệu học sinh.

| Chức năng | Kết quả đối chiếu mẫu cuối | Nguồn |
|---|---|---|
| Tóm tắt và sơ đồ | 6 chương giữ đúng các dữ kiện, điều kiện và giới hạn của phép thử số | 6/6 chương có trích đoạn khớp |
| Flashcard | 5 câu trả lời đúng với nguồn, giữ điều kiện và đơn vị | 5/5 thẻ có trích đoạn sau sửa bộ chuẩn hóa |
| Quiz | 5 đáp án và giải thích cuối đúng với nguồn; mỗi câu một lựa chọn đúng | 5/5 câu có trích đoạn khớp |
| Đọc ảnh | Ảnh phương trình tự tạo `2x + 3 = 11` được chép lại đúng | Không bịa trang hoặc vùng ảnh |

Tổng cộng **6/6 yêu cầu HTTP nhà cung cấp** trong đợt kiểm tra này: 1 tóm tắt, 1 bộ thẻ, 2 bộ quiz, 2 lần đọc ảnh. Không gọi thêm sau khi hết hạn mức của đợt đánh giá. Không coi kiểm tra CLI này là bằng chứng OAuth, credit, mở khóa gia sư hoặc hiệu quả học tập; những phần đó được kiểm tra riêng.

## Lỗi đã tìm và cách sửa

1. Thẻ ghi nhớ có nội dung Toán đúng nhưng mô hình đặt JSON `References` trong chuỗi mặt sau, khiến bộ đọc ban đầu không nhận được trích dẫn. Đã làm rõ schema và bổ sung chuẩn hóa hậu tố JSON chỉ khi **mọi trích dẫn đều khớp nguyên văn nguồn**. Đã chạy lại chính phản hồi thật đã lưu qua bộ kiểm tra mới, không gọi AI thêm: 8 kiểm tra ngoại tuyến PASS, 5/5 trích dẫn được nhận đúng. Đầu ra ban đầu vẫn được giữ để đối chiếu.
2. Quiz đầu tiên có một câu giải thích sai khái quát: gọi việc chia cho `x` chưa biết là “vô nghĩa”. Quy tắc đúng là phải có điều kiện số chia khác 0. Đã bổ sung chỉ dẫn Toán tương ứng và dùng yêu cầu thứ sáu, cuối cùng để tạo lại quiz. Cả 5 giải thích cuối được đọc đối chiếu, không còn khái quát sai đó. Quiz ban đầu được giữ trong báo cáo.
3. Khung ảnh tự tạo ban đầu quá hẹp, làm cắt phương trình. Mô hình đã nói không đọc chắc chắn thay vì đoán. Đã giữ ảnh và phản hồi ban đầu, sửa giới hạn khung, xem lại ảnh rồi kiểm tra đúng một lần với ảnh hoàn chỉnh.

## Những điều chưa được chứng minh

- Tất cả đáp án đúng của mẫu quiz vẫn ở lựa chọn đầu tiên. Nội dung đúng nhưng phân bố vị trí đáp án chưa tốt; chưa dùng bộ này như bài thi an toàn. Cần cải tiến cách xáo lựa chọn và kiểm tra chất lượng đánh giá.
- Một học liệu ngắn không chứng minh độ chính xác trên mọi sách, ảnh quét, video, môn học hay phiên bản mô hình.
- Đây là đối chiếu của tác nhân lập trình với lời giải tham chiếu tự soạn, chưa phải đánh giá độc lập của giáo viên.
- Chưa có thử nghiệm học sinh, điểm trước/sau hoặc bằng chứng tăng hiệu quả học tập.
- Trích đoạn khớp không tự chứng minh suy luận đúng. Chưa có bộ kiểm định ngữ nghĩa tổng quát độc lập cho tóm tắt, quiz và thẻ.

## Bằng chứng và cách chạy

- `content-live-evaluation.json`: nguồn, đáp án tham chiếu, kết quả thật, lịch 6 yêu cầu, các phản hồi cũ và nhận xét từng mục.
- `content-offline-revalidation.json`: chạy lại phản hồi thẻ đã lưu qua bộ chuẩn hóa mới, không gọi nhà cung cấp.
- `content-vision-equation-fixture.png`: ảnh hoàn chỉnh đã xem và dùng để kiểm tra.
- `content-vision-equation-fixture-initial-clipped.png`: ảnh lỗi ban đầu, được giữ minh bạch.

`node scripts/evaluate-content.cjs --live` chỉ đọc biến mô hình/khóa từ `.env.local`, chỉ cho phép endpoint chính thức và tối đa 6 yêu cầu HTTP. Đây là lệnh có thể phát sinh phí thật; không chạy trong kiểm thử mặc định. Các lần tiếp tục đã ghi rõ trong lịch, không đặt lại bộ đếm. `node tests/content-live-revalidation.cjs` chỉ đọc phản hồi đã lưu và không dùng mạng.
