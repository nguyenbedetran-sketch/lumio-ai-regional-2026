# D04 · Học liệu theo mật độ nguồn và giữ nguyên khác biệt

Trạng thái: **IMPLEMENTED / SCOPED LOCAL ACCEPTANCE**. Prompt-contract12 PASS và một follow-up6 HTTP thật đã được review riêng. Không thay model/provider, routes, ledger, schema hoặc format dữ liệu lưu. Đây không phải chứng minh chất lượng trên mọi học liệu hay bản public.

## Bằng chứng dẫn tới sửa

Baseline [v7-live-content-20261016.json](reports/v7-live-content-20261016.json) giữ nguyên SHA-25637eb74bb0d9b247beb38dceeeb1e9b9f4884c1e230d809bfba75e71ea382da0e. [Developer review](reports/v7-live-content-review.json) đã chỉ ra:

- Nguồn Toán hai câu bị kéo thành ba chương và năm thẻ/câu hỏi, nhiều mục hỏi lại cùng điều kiện dưới cách viết khác. Hai quote đúng không biến chúng thành năm khái niệm độc lập.
- Nguồn chỉ ghi20 độ và30 độ cùng nhãn; summary thêm “hai trường hợp hoặc thời điểm khác nhau”, “ban đầu/tiếp theo” dù nguồn không có quan hệ thời gian hay điều kiện.
- Mục tiêu ngoài nguồn được giải thích đúng phạm vi nhưng lại thành chương/node học liệu không có citation, gây nhiễu khi đọc.

Đây là review developer trên dữ liệu tự soạn, không phải đánh giá của giáo viên độc lập hoặc pilot học sinh.

## Đã thay đổi

Chỉ phần prompt learner trong lib/ai/router.ts:

- Cards/quiz tạo **1–5 khái niệm được nguồn hỗ trợ**, dùng ít mục cho nguồn ngắn. Không ép năm mục, đảo câu/đổi ký hiệu để hỏi lại một ý, tautology, padding hoặc giải thích ngoài nguồn cho đủ độ dài. Mặt trước thẻ là câu hỏi gợi nhớ rõ, mặt sau ngắn.
- Summary **1–16 chương,1–8 ý chính,2–15 node** theo nội dung thực tế; một chương/ý và root+node được chấp nhận khi phù hợp. Không tự thêm ví dụ/chủ đề để đủ số.
- Khác biệt/mâu thuẫn giữ nguyên cùng evidence; quan hệ/bối cảnh chưa biết phải nói chưa biết. Không chọn, tính trung bình, hòa giải hoặc dựng thời gian/tác giả/điều kiện/nguyên nhân để giải thích khác biệt. Thứ tự trong văn bản không là thứ tự thời gian.
- Phân biệt quan sát nguồn và suy luận đề xuất được gắn nhãn. Quote có thật chỉ xác định đoạn nguồn, không tự chứng minh source entailment.
- Với goal không liên quan, scope note của assistant nằm riêng trong overview summary; không dựng thành chapter/keypoint/node hay một kiến thức được trích nguồn. Cards/quiz chỉ hỏi khái niệm có trong nguồn.

Teacher workflow vẫn giữ **exact requested count** và cấu trúc choices/correctIndex riêng. Stateful Tutor không nhận chính sách đếm mục learner này. Validator1–10 cũ vẫn tương thích với học liệu đã lưu; thay prompt không phải áp hard cap5 hoặc cơ chế semantic dedup mới.

## Kiểm tra và giới hạn

~~~powershell
node tests/v7-content-prompt.cjs
~~~

[content-prompt.json](reports/content-prompt.json): **12/12 PASS**,0 actual provider requests;3 dispatches giả được chặn trong transport. Kiểm prompt đủ5 ngôn ngữ, giữ hợp đồng teacher/tutor, một card/quiz/chương có citation qua validator thật, export Markdown và giới hạn item/graph cũ. Router thật gửi prompt mới qua cả protocol OpenAI/Gemini với response tự soạn.

Regression đọc lại chính summary sai về chronology trong raw report: validator cấu trúc/exact quotes **vẫn nhận** nội dung đó. Test giữ kết quả này như giới hạn được biết. Prompt mới cấm rõ hành vi, nhưng chưa có semantic entailment checker hoặc bộ chặn trùng nghĩa tổng quát. Giữ report gốc, không ghép kết quả mới thay lỗi cũ.

Follow-up [raw6 HTTP](reports/v7-live-content-targeted-20261016.json), SHA256 `643df53502ef9a949b9d418e8723b026e802c85e587319df2602b4d3fa846145`, được [developer review độc lập với tác giả prompt](reports/v7-live-content-targeted-review.json) đọc toàn bộ raw/delivered output:7/7 quote offsets khớp; nguồn ngắn sinh1 card/1 quiz/1 chương; đáp án đúng giữ nguyên sau chuyển vị trí; hai số20/30 được giữ và nói rõ bối cảnh/thời gian/nguyên nhân chưa biết. Không quan sát lỗi Toán/nguồn có ý nghĩa trong sáu output này. Canary injection không xuất hiện; mục tiêu ngoài nguồn được ghi riêng trong overview. Còn lặp trình bày và chưa có bằng chứng tổng quát về entailment, chống injection hoặc semantic dedup. Không có học sinh/giáo viên thực nghiệm.

Lượt thật chạy trước sửa nhận diện Unicode trong helper quiz. Hash helper lúc chạy và hash sau sửa được lưu ở [QUIZ_OPTION_ORDER.md](QUIZ_OPTION_ORDER.md);14 nhóm regression/960 batch/5280 câu chỉ là kiểm tra offline. Runner về sau lưu thêm hash helper, grounding, summary và math-exact cùng nhãn rõ đây chỉ là tập file chọn lọc; raw report cũ không bị viết lại.

Việc xoay vị trí lựa chọn quiz là sửa độc lập do source agent phụ trách; report12 này không tự chứng minh tính an toàn của bước đó. Không có điểm tăng thành tích, người tham gia hoặc kết quả pilot được tạo trong lần sửa.
