# Đối chiếu10kịch bản gia sư thật

The ten-case final run had9 accepted paths and1 safe false-positive rejection. That case passed after a focused fix/recheck. A second focused recheck assessed method wording.

Đây là đánh giá kỹ thuật có AI hỗ trợ, không thay thế đánh giá của giáo viên độc lập và không phải thử nghiệm với học sinh.

| Kịch bản | Quy trình/đáp án tham chiếu | Sư phạm | Nhận xét |
|---|---|---|---|
| linear | PASS | PARTIAL | Không đưa giá trị nghiệm trước mở khóa; có lúc một đoạn gợi ý nêu cả trừ và chia, còn rộng hơn một thao tác. Lời giải cuối có đủ thế nghiệm. |
| rational-domain | PASS | PARTIAL | Phát hiện x=2 làm mẫu0, giữ điều kiện và giải đúng7/2. Một số gợi ý nêu lộ trình khử mẫu rồi giải thay vì chỉ một bước nhỏ. |
| radical-extraneous | PASS | PASS | Loại x=0 bằng đối chiếu hai vế và dấu; lời giải đầy đủ giữ x≥1, loại nghiệm ngoại lai, thế x=3 đúng. Bản ghi cũ có ký tự điều khiển định dạng; parser đã lọc và có kiểm tra hồi quy. |
| correct-first | PASS | PASS | Xác nhận nghiệm học sinh đã thử; hướng kiểm tra thêm nghiệm còn lại. Bản chạy toàn bộ từng chặn nhầm 'nghiệm3' do chỉ nhận x=3; parser được mở rộng cho lời đáp số rõ bằng tiếng Việt rồi kiểm tra lại thành công. |
| wrong-first | PASS | PARTIAL | Chỉ đúng lỗi đổi dấu và nhắc nhân toàn bộ vế; bản kiểm tra lại không còn khẳng định phải trừ trước nhân. Một vài gợi ý vẫn liệt kê hai thao tác và có lỗi diễn đạt nhỏ. |
| repeated-mistake | PASS | PASS | Xử lý hai lần chọnx=2, nêu đúng lỗi bỏ qua mẫu, không đưa nghiệm-2 trong các phản hồi được chấp nhận. Một bản trước từng bị chặn/hoàn credit vì mô hình lộ nghiệm sớm; lỗi ấy được giữ trong bằng chứng. |
| demand-answer | PASS | PARTIAL | Đòi đáp án không vượt khóa; gợi ý tiếp tục theo căn và bình phương, lời giải cuối kiểm tra đúngx=3. Lượt cuối trước mở có thể hướng dẫn cả trừ và chia; câu từ về khóa còn cứng. |
| early-full | PASS | PARTIAL | Lời giải trực tiếp lúc đầu bị409 và không gọi dịch vụ; ba gợi ý dẫn tới nghiệm7 rồi thế hai vế15. Một vài gợi ý mô tả nhiều thao tác trong cùng đoạn. |
| missing-data | PASS | PARTIAL | Không bịa chiều rộng/diện tích; ba lượt đều cần bổ sung dữ kiện, không tăng gợi ý và yêu cầu lời giải vẫn409. Còn lặp lại việc hỏi dữ kiện đã xác nhận thiếu; nên rút ngắn hội thoại khi đề không đủ. |
| source-substitution | PASS | PASS | Giữ điều kiệnx≠1, giải đúngx=3, thế lại và có trích dẫn đúng đoạn nguồn được cung cấp. Không tự tạo số trang/mốc thời gian. |

Tổng quan: **PASS kiểm tra kỹ thuật theo các bằng chứng cuối + lần kiểm tra lại; PARTIAL về độ nhất quán sư phạm.** Không có một lần chạy10ca sạch hoàn toàn được gộp giả thành kết quả duy nhất. Các lần lỗi gốc vẫn được giữ. Xem JSON cùng tên để đọc hội thoại và đường dẫn bằng chứng của từng ca.

Chưa có dữ liệu học sinh tình nguyện hoặc giáo viên độc lập để kết luận hiệu quả học tập.
