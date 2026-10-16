# Quy trình thăm dò kết quả học tập — chưa thực hiện

Phiên bản quy trình 1, ngày 16/10/2026, dành cho Lumio AI `3.3.0-rc.1`. **Trạng thái: NOT_TESTED — chưa có người tham gia, điểm trước/sau hoặc kết quả ôn trễ.** Đây là kế hoạch thu bằng chứng thật, không phải báo cáo hiệu quả. Không điền dữ liệu thử vào mẫu pilot hoặc coi tài khoản tổng hợp trong ảnh UI là người tham gia.

Tái sử dụng [quy trình pilot tự nguyện](../regional/STUDENT-PILOT.md), [phiếu phản hồi trống](../regional/PILOT-FEEDBACK.md) và **[pilot-metrics.csv hiện có](../regional/pilot-metrics.csv)**. CSV vẫn chỉ có dòng tiêu đề; tài liệu này không tạo mẫu mới, dashboard hoặc hồ sơ người học giả.

## 1. Chốt mục tiêu và điều kiện trước khi mời

Người phụ trách chọn **một kỹ năng hẹp**, trình độ và tiêu chí chấm; giáo viên kiểm tra học liệu, đáp án, điều kiện và mức phù hợp lứa tuổi. Dự kiến mời 5–10 người cùng trình độ để thăm dò; đây là quy mô dự kiến, không phải số đã tuyển. Công bố trước lịch ôn trễ, thời lượng, cách chấm và cách xử lý dữ liệu thiếu, tránh chọn tiêu chí sau khi đã thấy điểm.

Chuẩn bị ba bộ **khác câu hỏi nhưng cùng mục tiêu**, tương đương theo nhận định giáo viên, cùng thang điểm và thời lượng: A trước học, B sau học, C sau 7 ngày (cho phép lệch ±1 ngày và ghi thời gian thực). Có câu yêu cầu giải thích/kiểm tra điều kiện và một cách biểu diễn khác để thăm dò chuyển giao. Việc giáo viên duyệt không có nghĩa đề đã được hiệu chuẩn thống kê. Có thể đảo A/B giữa các người tham gia, ghi lại phương án đã dùng.

Trong Teacher Workspace, tạo **ba bài gốc độc lập**, không dùng **Cho luyện lại** để tạo B/C. Ghi ID bài gốc, phiên bản câu hỏi đã chốt, mục tiêu, thang chấm và nhãn A/B/C trong biên bản riêng. Bài B/C có cửa sổ mở đúng lịch; trước mở, máy chủ không gửi đề/hướng dẫn cho học sinh. Không sửa đề/cửa sổ sau khi giao. Đóng cửa sổ không biến bài thành một kỳ thi có giám sát.

## 2. Tự nguyện, mã hóa và giới hạn dữ liệu

- Giải thích mục đích, hoạt động, phần dữ liệu có thể gửi ra dịch vụ AI và quyền dừng/rút; không gắn tham gia với điểm học chính thức hoặc thưởng phản hồi tích cực. Dùng phần đồng ý trong quy trình hiện có; người tổ chức kiểm tra yêu cầu phù hợp với trẻ vị thành niên và có đồng ý của người giám hộ khi cần. Ứng dụng chưa tự xác minh quan hệ giám hộ.
- Dùng mã ngẫu nhiên cho phân tích; không đưa tên, email, tài khoản, ảnh mặt hoặc giọng thật vào tài liệu công khai. Bảng nối mã–tài khoản và giấy đồng ý lưu riêng, hạn chế truy cập. Mã giả danh vẫn có thể nhận diện nếu ghép với dữ liệu khác, không được coi là dữ liệu vô danh hoàn toàn.
- Chụp/quay cần lựa chọn đồng ý riêng. Minh chứng public ưu tiên tài khoản của người phát triển; nếu dùng dữ liệu thật phải tối thiểu hóa, khử nhận diện và có căn cứ đồng ý phù hợp. Không gửi bài làm của người khác hoặc bản export có tên lên AI.
- Công bố người giữ dữ liệu, nơi lưu, thời hạn giữ và hạn cuối rút trước tổng hợp. Không hứa đã xóa khỏi hệ thống nhà cung cấp khi chỉ mới xóa hàng phân tích hoặc dữ liệu trình duyệt; dữ liệu lớp/điểm trên server không có nút tự xóa toàn bộ trong phạm vi này.

## 3. Tiến hành theo lịch cố định

| Bước                        | Hoạt động dự kiến                                                                              | Ghi nhận thật sau khi làm                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Trước học — khoảng 5–8 phút | Làm A độc lập, không AI/tài liệu trợ giúp; giải thích một bước quan trọng.                     | Bài gốc/lần 1, điểm theo rubric, giải thích 0–3, trợ giúp hoặc sự cố nếu có.                                |
| Học — khoảng 10–15 phút     | Đọc nguồn → dùng Studio/gia sư → tự thử → đối chiếu đoạn nguồn; ghi các phản hồi cần kiểm tra. | Thời gian hoạt động thực được quan sát, số gợi ý thực chất, lỗi nguồn/AI/UI; không suy từ thời gian tab mở. |
| Sau học — khoảng 5–8 phút   | Làm B khác câu hỏi, cùng kỹ năng, không AI/tài liệu; có câu chuyển giao.                       | Điểm, giải thích, điểm chuyển giao riêng nếu có; ghi nhận việc dùng trợ giúp.                               |
| Ôn trễ — ngày 7 ±1          | Làm C mới, không xem lại đáp án ngay trước bài; ghi việc học thêm giữa hai buổi.               | Ngày/giờ thực, số ngày trễ, điểm và giải thích, trợ giúp và dữ liệu thiếu.                                  |
| Phản hồi — khoảng 3 phút    | Dùng phiếu hiện có; hỏi nguồn có dễ kiểm tra, gợi ý có hữu ích sau khi thử không.              | Phản hồi tự đánh giá và lỗi cụ thể, tách khỏi điểm học tập.                                                 |

Người phụ trách quan sát điều kiện làm bài; UI không có chế độ khóa mọi công cụ AI bên ngoài. Nếu có trợ giúp không theo quy trình, đánh dấu và báo riêng, không gọi đó là kết quả độc lập. Có thể chấm nội bộ A/B nhưng giữ công bố đáp án/nhận xét của các bài đo đến sau C để giảm lộ đề; ghi rõ mọi phản hồi đã nhận. Không dùng câu AI chưa được giáo viên kiểm tra làm đáp án chuẩn.

## 4. Chấm và lấy dữ liệu từ chức năng đang có

Dùng cùng rubric, tối đa 10 điểm: hiểu đề/điều kiện 2, phương pháp 2, biến đổi/tính toán 4, kết luận/kiểm tra 2; điều chỉnh trước phiên nếu kỹ năng khác. Giải thích 0–3 theo [quy trình pilot](../regional/STUDENT-PILOT.md). Người chấm có thể chỉ nhận mã, không biết bài thuộc giai đoạn nào; nhờ người thứ hai đối chiếu các trường hợp bất đồng. Ghi ai chấm trong hồ sơ riêng, không phát minh chứng nhận chuyên môn.

Giáo viên chấm/xác nhận qua **Chấm & nhận xét**; công bố là bước riêng. Nếu sửa điểm, dùng E1 với lý do/lịch sử, chốt ngày cắt dữ liệu và phiên bản dùng phân tích; không chọn phiên bản có lợi hơn mà bỏ qua điều chỉnh. Xuất **Báo cáo → CSV** theo đúng lớp sau khi công bố kết quả cần dùng. Export có tên thật: giữ bản gốc riêng, tạo bản phân tích khử nhận diện, không đưa nguyên export lên GitHub/Drive public.

CSV giáo viên có **Bài gốc, Lần làm, Luyện lại cùng đề, Dùng trong phân tích hiện tại**. Với thăm dò trước/sau/trễ, ưu tiên lần 1 của A/B/C đã xác định trước. Cột “Dùng trong phân tích hiện tại” phục vụ thống kê hiện tại của app, **không tự chọn đúng lần làm theo thiết kế nghiên cứu**. Nếu một người làm lại, giữ lần đầu và ghi riêng lần luyện lại; không thay điểm trước học bằng điểm làm lại mới nhất.

Điền `pilot-metrics.csv` **chỉ sau khi có dữ liệu thật**, đúng ý nghĩa cột: phiên bản/ngày/đồng ý/hoàn tất; điểm trước/sau; giải thích; chuyển giao; số phản hồi AI/ý tóm tắt/câu quiz được người chấm kiểm tra. Ô chưa đo để trống, ghi `missing_data_reason`; không điền 0 và không coi `completed` là đạt kiến thức. Các tỷ lệ lỗi/chất lượng phải kèm mẫu số đã kiểm tra, tách chưa xác minh.

**Giới hạn mẫu CSV hiện có:** chưa có cột điểm ôn trễ hoặc phút hoạt động. Không đổi nghĩa `transfer_score_0_10` thành điểm trễ, không nhét phút vào số gợi ý và không sửa schema để tạo kết quả giả. Giữ kết quả C trong export giáo viên có giới hạn truy cập, nối mã và ID bài gốc trong biên bản phân tích riêng; báo cáo tổng hợp sau này phải chỉ rõ nguồn này và ngày đo. Điểm chuyển giao tức thời chỉ đi vào cột tương ứng khi thực sự có câu chuyển giao được chấm riêng.

## 5. Diễn giải đúng điều đã đo

| Đại lượng                         | Có thể nói                                                               | Không được suy ra                                                            |
| --------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Phút học/focus, hoàn tất, lượt mở | Mức sử dụng/tham gia được quan sát theo cách đo đã nêu.                  | Học tốt hơn, hiểu sâu hoặc thành thạo.                                       |
| Điểm B − A                        | Chênh lệch trong các cặp đủ dữ liệu, dưới bộ đề/quy tắc đã chọn.         | Hiệu quả nhân quả của Lumio; mọi bộ đề hoàn toàn tương đương.                |
| Điểm C, C − B                     | Kết quả ở buổi trễ, khoảng thời gian và điều kiện học thêm đã ghi.       | Ghi nhớ bền vững cho toàn môn hoặc không bị ảnh hưởng việc ôn ngoài app.     |
| Bài chuyển giao                   | Khả năng làm dạng mới cụ thể đã thử.                                     | Chuyển giao ra toàn chương trình.                                            |
| Nhãn phân tích/“secure”           | Heuristic theo bằng chứng hiện có; dưới 3 bài gốc là chưa đủ bằng chứng. | Năng lực đã hiệu chuẩn. Có đủ 3 bài gốc cũng không tự chứng minh thành thạo. |
| Luyện lại cùng đề                 | Cơ hội luyện tập và nhận phản hồi; vẫn giữ lịch sử.                      | Bài đánh giá độc lập mới hoặc đề bí mật. Điểm tăng có thể do nhớ câu/đáp án. |

Báo cáo số đã mời/đồng ý/làm đủ/rút/thiếu, số cặp thật, phân bố/chênh lệch từng mã khi đủ an toàn riêng tư, trung vị hoặc trung bình mô tả và số ngày trễ. Tách kết quả lần đầu với luyện lại, có/không trợ giúp. Không coi người bỏ buổi là 0; nêu lý do thiếu nếu được tự nguyện cung cấp. Không công khai nhóm quá nhỏ khiến có thể đoán cá nhân.

Nhóm nhỏ tự nguyện/thuận tiện có thiên lệch lựa chọn, khác kiến thức nền, luyện đề, độ khó đề và học thêm. Không ngẫu nhiên hóa hoặc không có đối chiếu phù hợp thì **không kết luận Lumio gây ra tiến bộ**, không dùng p-value hay một tỷ lệ đẹp để che các giới hạn này. Kết quả chỉ gợi ý lỗi cần sửa và một nghiên cứu tốt hơn.

## 6. Minh chứng người chấm nên thấy

Hiện tất cả nội dung dưới đây **NOT_TESTED/chưa thu**, không có số người hoặc điểm đã điền:

1. Quy trình/thang chấm/ba bộ A–B–C có phiên bản và review nguồn; không công khai đáp án trước khi kết thúc đo.
2. Xác nhận đã có quy trình đồng ý/rút phù hợp; giấy ký và bảng nối danh tính không đưa public.
3. Export gốc riêng của ba bài gốc, bản khử nhận diện được phép chia sẻ, ID/lần làm/phiên bản điểm và ghi chú dữ liệu thiếu; CSV pilot không bị điền từ fixture.
4. Biên bản review phản hồi AI/nguồn/quiz với lỗi và mẫu số thực; phiếu phản hồi trống hoặc trả lời thật đã được phép dùng, phân biệt hai loại.
5. Báo cáo mô tả trước/sau/trễ với giới hạn, sự cố và việc học thêm; không biến ảnh kiểm thử, log sử dụng hoặc mô phỏng thành bằng chứng người học.

Render Free có thể mất database trước ngày đo trễ. Người phụ trách cần xuất/giữ an toàn kết quả sau mỗi buổi và dùng backup phù hợp ở nơi riêng; thư viện JSON của trình duyệt không thay backup lớp/server. Nếu mất dữ liệu không phục hồi được, ghi thiếu và dừng suy luận liên quan, không tái tạo điểm từ trí nhớ. Quy trình này không gỡ trạng thái chưa có pilot và không thay điều kiện phát hành/nộp cuối.
