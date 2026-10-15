# Định vị và điểm khác biệt có thể kiểm chứng

Đối chiếu thông tin công khai ngày 15/10/2026. Đây là so sánh phạm vi chức năng được mô tả, không phải benchmark chất lượng hoặc khẳng định Lumio vượt đối thủ. “Chưa xác nhận” nghĩa là trang đã đọc không đủ thông tin, không đồng nghĩa sản phẩm không có tính năng.

## Bảng đối chiếu

| Tiêu chí | Lumio bản nâng cấp khu vực | YouLearn | NotebookLM | Khanmigo |
|---|---|---|---|---|
| Học từ học liệu do người dùng thêm | Có thư viện local và yêu cầu AI từ nội dung đã chọn; xem báo cáo triển khai để biết AI thật đã kiểm tra | Trang sản phẩm công bố học từ PDF, video, slide, website, tệp và bài giảng [1] | Bài giới thiệu công bố thẻ/quiz từ nguồn học liệu và giải thích có trích dẫn [2] | Trang giới thiệu tập trung gia sư theo hội thoại và hoạt động học [3]; chưa xác nhận phạm vi nhập tệp từ trang này |
| Gợi ý thay vì đưa đáp án ngay | Chính sách phiên gia sư và mở khóa do máy chủ kiểm tra; trạng thái nghiệm thu theo bộ kiểm thử riêng | Có gia sư tương tác [1]; chưa xác nhận cơ chế mở khóa bằng máy chủ | Có Learning Guide hỗ trợ hiểu sâu [2]; chưa xác nhận cơ chế mở khóa bằng máy chủ | Công bố hướng dẫn qua câu hỏi, giúp người học tự tìm cách giải [3] |
| Ôn từ chính bài học | Flashcard, quiz, lịch ôn theo đánh giá thực, tóm tắt và sơ đồ; chất lượng nội dung cần đối chiếu nguồn | Công bố ghi chú, flashcard, quiz và gia sư [1] | Công bố flashcard/quiz, giải thích và trích dẫn nguồn [2] | Chưa xác nhận bộ công cụ tạo thẻ/quiz từ tệp riêng từ trang đã đọc |
| Đề xuất và quyền kiểm soát | Xử lý local, tách thích với điểm quiz, chỉ rõ dữ liệu cho từng gợi ý, chủ đề/độ khó/mục tiêu, tắt/xóa phản hồi | Chưa xác nhận chi tiết tín hiệu/quyền kiểm soát từ trang đã đọc | Có học tập cá nhân hóa [2]; chưa xác nhận thuật toán xếp hạng/thang năng lực từ trang này | Có gia sư cá nhân [3]; chưa xác nhận thuật toán gợi ý tài liệu riêng từ trang này |

[1] [Trang chính thức YouLearn](https://www.youlearn.ai/) và [ứng dụng](https://app.youlearn.ai/). [2] [Google — 6 NotebookLM features to help students learn](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-student-features/). [3] [Trang chính thức Khanmigo](https://khanmigo.ai/).

## Một câu định vị

**Lumio giúp học sinh học từ tài liệu của mình, suy nghĩ từng bước cùng gia sư, mở nguồn để kiểm chứng và ôn theo kết quả học thực.**

Đây là mô tả định hướng và tính năng; không phải lời hứa chắc chắn làm tăng điểm.

## Ba trọng tâm riêng của bản dự thi

1. **Tiến trình gia sư kiểm tra ở máy chủ.** Trạng thái đề bài, gợi ý và thử trả lời được giữ theo phiên; nút đổi chế độ không tự vượt điều kiện mở lời giải. Bằng chứng cần đi kèm: kiểm thử phiên/điều kiện và hội thoại 10 bài có chấm chuyên môn. Chỉ báo hiệu quả: tỷ lệ giải thích đúng và làm được bài tương tự, không chỉ số lần mở lời giải.
2. **Đối chiếu nguồn và nói rõ khi chưa có vị trí.** Học liệu được chia đoạn có metadata; trích dẫn phải khớp đoạn thực, không bịa trang hoặc thời gian. Bằng chứng cần đi kèm: ảnh giao diện mở nguồn và kiểm thử từ chối trích dẫn sai. Chỉ báo: số phát biểu có nguồn hỗ trợ / số phát biểu được người chấm kiểm tra, tách câu chưa xác minh.
3. **Cá nhân hóa có thể hiểu và điều chỉnh ngay trên thiết bị.** Lượt thích chỉ là sở thích; điểm quiz/những câu sai theo chủ đề và lịch ôn là bằng chứng riêng. Mỗi đề xuất cho xem số liệu hỗ trợ, có thay đổi chủ đề/định dạng, tắt cá nhân hóa và xóa phản hồi. Bằng chứng mã: `lib/lumio/recommendations.ts`, `components/lumio/recommendations.tsx`; kiểm thử: `tests/recommendations.cjs`. Chỉ báo: đánh giá hữu ích sau khi học thử, độ phù hợp độ khó và bài chuyển giao; không coi lượt nhấp là tiến bộ.

Các trọng tâm này mô tả cách Lumio triển khai cho nhóm học sinh mục tiêu, không khẳng định chưa từng tồn tại ở sản phẩm khác. Không dùng từ “duy nhất”, “chính xác tuyệt đối” hoặc “tốt hơn” khi chưa có nghiên cứu đối chứng.

## Ba ưu tiên tiếp theo và phép đo

| Ưu tiên | Thay đổi tiếp theo | Cách đo, điều kiện báo cáo |
|---|---|---|
| Độ đúng gia sư | Mở rộng bộ đề có đáp án/chấm độc lập và lỗi điển hình, đánh giá từng lượt | Tỷ lệ lỗi nghiêm trọng và tiết lộ đáp án sớm trên hội thoại đã chấm; ghi rõ số bài/phản hồi, model và cấu hình |
| Độ tin cậy của nguồn | Phủ thêm loại tệp, kiểm tra mức hỗ trợ của đoạn trích cho từng ý/câu | Tỷ lệ đúng vị trí và đủ căn cứ; ghi riêng tệp không thể xác định trang/thời gian |
| Hiệu quả cá nhân hóa | Chạy thử nghiệm tự nguyện, so sánh đề xuất với baseline công bằng | Hữu ích sau học, điểm trước/sau/chuyển giao, tỷ lệ phù hợp chủ đề và độ khó; chỉ kết luận theo dữ liệu thu thật |

Thử nghiệm học sinh hiện **NOT TESTED**. Dùng `STUDENT-PILOT.md`, `PILOT-FEEDBACK.md`, `pilot-metrics.csv` để thu dữ liệu; không điền kết quả giả vào hồ sơ.
