# Gợi ý học cá nhân hóa trong Lumio AI

Lumio sắp xếp lại **học liệu đã có trong thư viện của bạn** để gợi ý nội dung nên mở tiếp. Tính năng sử dụng lịch ôn, kết quả quiz, nội dung từng học liệu và phản hồi bạn chủ động chọn. Mục tiêu là hỗ trợ chọn việc học tiếp theo; thứ hạng không phải điểm năng lực, chẩn đoán kiến thức hoặc dự đoán chắc chắn về kết quả học tập.

## Cách dùng

Mở **Đề xuất cho bạn**. Mỗi học liệu có lý do gợi ý, nút **Học tiếp** và hai lựa chọn phản hồi:

- **Hợp với tôi**: nhãn tích cực, có giá trị `1`.
- **Ít đề xuất hơn**: nhãn tiêu cực, có giá trị `0`, làm học liệu đó xuống thấp trong danh sách khi cá nhân hóa bật.

Mỗi học liệu giữ một phản hồi hiện tại; chọn lại sẽ thay phản hồi cũ. Đây là nhận xét về mức phù hợp của gợi ý, không phải câu trả lời đúng/sai. Một lần mở học liệu không tự trở thành nhãn tích cực; bỏ qua một học liệu cũng không tự trở thành nhãn tiêu cực.

## Từ nội dung tới 48 đặc trưng

Mỗi học liệu được chuyển thành một vector gồm **48 số** ngay trong trình duyệt:

1. Lấy từ trong tiêu đề và tối đa 16.000 ký tự đầu của phần văn bản đã lưu. Chuyển chữ thường, chuẩn hóa Unicode và bỏ một danh sách từ phổ biến tiếng Việt/Anh. Bộ tách từ giới hạn tối đa 6.000 token cho mỗi lần xử lý.
2. Đếm từ bằng hàm băm vào **42 vị trí**. Từ trong tiêu đề được đếm bốn lần để tăng trọng số.
3. Sáu vị trí còn lại biểu diễn loại học liệu: văn bản, PDF, ảnh, âm thanh, video hoặc liên kết.
4. Giảm ảnh hưởng của số lần lặp bằng `log(1 + số đếm)`, rồi chuẩn hóa độ dài vector.

Đây là đặc trưng từ vựng có băm, **không phải embedding ngữ nghĩa từ mô hình ngôn ngữ**. Các từ khác nhau có thể rơi vào cùng một vị trí băm; từ đồng nghĩa hoặc các cách viết khác nhau có thể không được nhận ra. Khả năng tách từ giữa các ngôn ngữ cũng chưa được đánh giá riêng. Với ảnh, PDF hoặc video chưa có văn bản nguồn, bộ gợi ý chỉ sử dụng tiêu đề và loại học liệu; nó không tự đọc nội dung nhị phân để xếp hạng.

## Chọn phương pháp theo dữ liệu thực có

| Điều kiện                                                              | Phương pháp đang dùng                                                   |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Chưa có lịch sử/phản hồi phù hợp, hoặc đã tắt cá nhân hóa              | Cách xếp cơ bản dựa trên lịch ôn, quiz, yêu thích và khám phá thư viện. |
| Có lịch sử hoặc phản hồi tích cực, chưa đủ nhãn để học mô hình         | Đối chiếu độ tương tự giữa nội dung và hồ sơ quan tâm cục bộ.           |
| Có ít nhất **12 phản hồi**, gồm ít nhất **4 tích cực và 4 tiêu cực**   | Huấn luyện mô hình **hồi quy logistic** cục bộ.                         |
| Có ít nhất **40 phản hồi**, gồm ít nhất **10 tích cực và 10 tiêu cực** | Dùng thử mạng nơ-ron truyền thẳng **48 → 12 → 6 → 1**, có hai lớp ẩn.   |

Ngưỡng được tính trên phản hồi còn khớp với các học liệu đang được xét, tối đa **200 phản hồi** cho một lần huấn luyện. Không đếm phản hồi của học liệu đã xóa. Tùy chọn lưu tối đa 1.000 phản hồi, mỗi ID học liệu chỉ xuất hiện một lần. Mỗi lượt xếp hạng xét tối đa 1.000 học liệu và giao diện hiển thị 12 gợi ý đầu.

Hồ sơ nội dung sử dụng tối đa 500 sự kiện có học liệu trong 90 ngày gần đây; sự kiện tương lai bị bỏ qua. Trọng số sự kiện giảm theo `exp(-số ngày / 30)`. Phản hồi tích cực bổ sung vào hồ sơ quan tâm. Tính điểm tương tự và huấn luyện mô hình đều chỉ chạy khi cá nhân hóa bật.

Hồi quy logistic được tối ưu bằng gradient trong 160 vòng, có điều chuẩn trọng số. Mạng hai lớp ẩn dùng hàm kích hoạt `tanh`, đầu ra sigmoid và lan truyền ngược trong 200 vòng với tốc độ học giảm dần. Khởi tạo là xác định để cùng dữ liệu cho cùng kết quả. Dữ liệu huấn luyện bị giới hạn về số lượng, kích thước vector và biên độ; mảng thiếu phần tử, NaN hoặc số vô hạn bị từ chối.

Đây là hai thuật toán học từ nhãn thật do người dùng cung cấp. Mạng hai lớp ẩn là mô hình nhỏ thử nghiệm cho việc xếp hạng; không phải mô hình nền tảng, mô hình gia sư đã huấn luyện riêng, hay bằng chứng về khả năng “deep learning” ở quy mô lớn. Không dùng API bên ngoài để thực hiện huấn luyện này. Trọng số được tính trong bộ nhớ, chưa được lưu thành một tệp mô hình riêng.

## Thứ hạng còn dựa trên việc cần học

Điểm cơ bản cộng ưu tiên cho thẻ còn tồn tại và đã đến lịch ôn, quiz gần đây có tỷ lệ đúng dưới 70%, nội dung tương tự, mục yêu thích và học liệu chưa mở. Phần quiz dùng tối đa ba lần làm gần nhất của học liệu. Khi có mô hình, điểm dự đoán phản hồi được kết hợp với điểm cơ bản; phản hồi tiêu cực trực tiếp làm học liệu bị giảm hạng.

Lý do hiển thị như “Thẻ đã đến lịch ôn” hoặc “Gần với nội dung bạn đang học” là giải thích ngắn về tín hiệu liên quan, không phải bản giải thích đầy đủ mọi trọng số trong mô hình. Điểm dự đoán chưa được hiệu chỉnh thành xác suất đáng tin cậy. `trainingLoss` trong mã là sai số trên dữ liệu huấn luyện, không phải độ chính xác trên người học mới và không phải điểm học tập.

## Tắt cá nhân hóa và quyền riêng tư

Tắt **Cá nhân hóa theo lịch sử học** sẽ bỏ lịch sử đọc, hồ sơ quan tâm và phản hồi tích cực/tiêu cực khỏi việc tính thứ hạng; không huấn luyện mô hình. Danh sách vẫn dùng lịch ôn, quiz, yêu thích và trạng thái đã mở/chưa mở để gợi ý học liệu trong thư viện. Các nút phản hồi bị vô hiệu hóa khi tính năng tắt.

Tắt không xóa các phản hồi đã lưu. Bật lại sẽ cho phép dùng chúng trở lại, nếu học liệu tương ứng vẫn còn. Chưa có chức năng xóa riêng từng phản hồi trong giao diện.

Việc trích đặc trưng, lập hồ sơ và huấn luyện chạy trên thiết bị. **Bộ gợi ý không gửi lịch sử học, phản hồi hoặc vector sang dịch vụ AI.** Khi bạn mở một học liệu rồi chủ động gọi gia sư/tóm tắt, chức năng AI đó vẫn tuân theo luồng gửi nội dung riêng của ứng dụng; việc xử lý cục bộ của bộ gợi ý không làm mọi chức năng AI trở thành offline.

Tùy chọn và phản hồi nằm trong `localStorage` với khóa `lumio-personalization-v1:<account được mã hóa URL>`. Namespace được gắn đúng tài khoản; hook chặn callback cũ khi chuyển tài khoản, không hiển thị trạng thái tài khoản trước nếu dữ liệu tài khoản mới bị lỗi, và nhận sự kiện xóa dữ liệu từ tab khác. Việc tách khóa không phải mã hóa dữ liệu. Hiện không có đồng bộ cá nhân hóa tự động giữa các thiết bị.

Nếu trình duyệt không đọc/ghi được dữ liệu hoặc dữ liệu lưu bị hỏng, giao diện báo lỗi và không tiếp tục ghi đè ngầm. Có thể mất dữ liệu khi xóa dữ liệu website trong trình duyệt; hãy giữ bản sao nếu cần chuyển máy hoặc giữ lịch sử.

## Sao lưu và khôi phục

Nút **Xuất bản sao** trong cài đặt thêm trường `personalization` vào JSON cùng thư viện và dữ liệu học, khi phần tùy chọn đang đọc bình thường. Trường này chứa trạng thái bật/tắt và các phản hồi theo ID học liệu; không chứa trọng số mô hình. Vì vậy bản sao có thể tiết lộ phản hồi học tập nếu bạn chia sẻ tệp.

Khi nhập bản sao, dữ liệu cá nhân hóa được kiểm tra trước bước xác nhận. Phiên bản lạ, ID rỗng/trùng, nhãn không hợp lệ, thời điểm không đọc được hoặc quá nhiều phản hồi bị từ chối. Bản sao hợp lệ có trường `personalization` sẽ khôi phục vào tài khoản đang mở sau khi bạn xác nhận. Bản sao cũ không có trường này giữ nguyên tùy chọn cá nhân hóa hiện tại; các phản hồi không còn khớp học liệu sẽ không được tính vào mô hình. Lỗi quyền lưu trữ vẫn có thể ngăn khôi phục tùy chọn và được báo trong phần cá nhân hóa.

## Bằng chứng kiểm tra và giới hạn

Lệnh `node tests/recommendations.cjs` hiện có **12 kiểm tra đã đạt**, dùng dữ liệu tự tạo cục bộ, không gọi provider:

- Khởi đầu không tự tạo nhãn hoặc mô hình; lịch sử liên quan tăng hạng đúng hướng; lịch sử quá cũ/tương lai không được dùng.
- Phản hồi tiêu cực giảm hạng; tắt cá nhân hóa cho cùng điểm như trường hợp không có lịch sử/phản hồi; thẻ đã xóa không làm phát sinh lý do đến hạn.
- Logistic học được nhãn tuyến tính và phân biệt các vector chưa có trong tập huấn luyện. Mạng hai lớp ẩn học được mẫu phi tuyến XOR trên các điểm giữ riêng để kiểm tra, trong khi logistic không giải được mẫu XOR đó.
- Ngưỡng kích hoạt mô hình, giới hạn và dữ liệu lỗi; khóa tài khoản, chuyển tài khoản trước khi effect chạy, dữ liệu tài khoản mới bị hỏng, xóa từ tab khác và cập nhật dựa trên dữ liệu lưu mới nhất.

Các bài kiểm tra chứng minh những hành vi này của mã và một số khả năng học trên dữ liệu tổng hợp. **Chưa đo độ chính xác gợi ý trên người học thật**, chưa có A/B test, đánh giá thiên lệch giữa nhóm người dùng/ngôn ngữ hoặc kiểm định tác động đến kết quả học tập. Chất lượng phản hồi, số mẫu ít, từ bị băm trùng và nội dung thay đổi đều có thể làm gợi ý kém phù hợp. Không suy rộng kết quả XOR thành chất lượng học tập hoặc chất lượng gợi ý thực tế.

Mã chính: `lib/lumio/recommendations.ts`, `components/lumio/use-personalization.ts`, `components/lumio/recommendations.tsx`; tích hợp sao lưu và tài khoản ở `components/lumio/app.tsx`. Kiểm tra ở `tests/recommendations.cjs`.
