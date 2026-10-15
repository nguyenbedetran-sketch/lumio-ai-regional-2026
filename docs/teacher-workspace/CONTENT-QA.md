# AI giáo viên và cửa kiểm tra nội dung

## Luồng thực thi

`POST /api/teaching/generate` chỉ nhận phiên web có account header khớp, origin hợp lệ và quyền giáo viên/quản trị tổ chức hiện hành. Backend đọc nguồn có quyền từ DB; không lấy class roster, bài nộp hoặc điểm học sinh để gửi AI. Lease/quota và credit ledger hiện có chạy trước transport; source/credential/org/session được kiểm lại bên trong transaction settlement. Nguồn đổi hoặc quyền bị thu hồi làm request bị từ chối và refund.

AI Router giữ nguyên provider/model/fallback đang cấu hình. Một context **chỉ server đặt được** chọn JSON schema giáo viên; `validateInput` của API học sinh không nhận context này từ client. Luồng gia sư học sinh và khóa ba gợi ý được giữ nguyên. Không thêm SDK, provider, cloud hoặc checkout.

Request gồm `requestId` (UUIDv4 bắt buộc), `kind` (`lesson`, `questions`, `feedback`, `assistant`), `orgId`, `sourceIds` (0–3), `topic` (≤100 ký tự), `grade` (≤40), `objective` (≤500), `difficulty` (`basic`, `medium`, `advanced`), `count` (1–5), `language` và `externalProcessingConsent:true`. Chỉ `feedback` nhận thêm `anonymousExcerpt` (5–1.500 ký tự), do giáo viên tự gõ và tự loại thông tin nhận dạng. Không nhận student ID, history, arbitrary source text, role, class ID, proof hoặc cờ đã duyệt từ client.

Tối đa 30.000 ký tự nguồn được chọn; quá giới hạn phải thu hẹp nguồn, không âm thầm coi văn bản cắt là toàn bộ tài liệu. Media/link không có text phải báo thiếu bản chép/nội dung, không giả đã xem/nghe. Dấu email/điện thoại/nhãn định danh hoặc secret rõ được chặn; bộ lọc không thể phát hiện mọi tên riêng hoặc dữ liệu nhạy cảm. Trách nhiệm bỏ nhận dạng vẫn phải có người thực hiện.

## Đầu ra và việc sử dụng

Đầu ra luôn là **draft-only**, `teacherReviewRequired:true`. Giáo án dùng `LessonDraft`; câu hỏi dùng `QuestionDraft[]` với bốn lựa chọn ở bộ AI mới; nhận xét/trợ lý dùng `{text,references}`. Topic-only là `inference-no-source`; AI không chứng nhận curriculum, official approval, năng lực học sinh hay đã xuất bản.

Không tự lưu output vào ngân hàng hoặc bài giao. Giáo viên chỉnh sửa rồi chủ động lưu. Backend lưu nháp có revision; sửa nội dung làm mất trạng thái duyệt. Review và issue phải kiểm lại draft/nguồn hiện tại bằng QA chung; câu sai có chứng cứ bị chặn, nội dung chưa đủ căn cứ không tự được chứng nhận đúng. Nhận xét AI không tự chấm điểm hoặc công bố.

## Những gì QA xác minh được

- Schema/size, số lựa chọn, chỉ số đáp án, giải thích bắt buộc; rubric dương có tổng khớp điểm đối với tự luận.
- Lựa chọn trùng và một số biểu thức số tương đương (ví dụ `1/2`, `0.5`, `50%`); tránh “tất cả” và tổ hợp nhiều đáp án. Batch AI không được trùng prompt.
- Câu phương trình/số literal trong grammar hỗ trợ: đối chiếu số lựa chọn đúng và correctIndex; một số đẳng thức số viết thành dòng riêng trong giải thích. Không trích một phần như `3=11` từ phương trình `2x+3=11` để kết luận sai giả.
- Trích đoạn exact, material ID, paragraph và vị trí từ nguồn canonical. Page/slide/heading hoặc `seconds` do model tự khai không có thẩm quyền. Timestamp chỉ từ cue literal của bản chép; quote khớp chỉ chứng minh văn bản hiện diện, không chứng minh mọi khẳng định đúng.
- Một số dấu nội dung gây hại/phỉ báng không phù hợp được chặn. Không tự coi regex là bộ kiểm độ tuổi/ngữ nghĩa đầy đủ.

Chất lượng giáo án, độ khó thực, tính đúng toàn bộ lập luận, câu hỏi mơ hồ ngữ nghĩa và hiệu quả dạy học vẫn cần giáo viên đối chiếu. Nhãn `checked-supported-cases` không đồng nghĩa “AI chính xác”.

## Credit, dữ liệu và thử nghiệm

Giá credit theo ledger hiện có: lesson dùng task `summary`, questions dùng `quiz` (mode quick/text, hiện 8 credit); feedback/assistant dùng `chat` (hiện 2 credit). Provider vẫn có thể tính phí request thất bại; refund credit không phải hoàn phí từ provider. Chưa thu tiền thật.

Đầu vào được gửi tới provider text đang cấu hình (OpenAI và fallback Gemini theo Router); chỉ có task đã chọn, topic/grade/objective và nguồn/excerpt tối thiểu. Không gửi toàn bộ workspace, roster, bài nộp hay điểm một cách tự động. API không trả provider/model/key cho client; telemetry giữ metadata/usage/error, không chủ đích ghi raw prompt/nội dung. Kết quả AI không tự persist trong teaching tables. Khi giáo viên lưu nháp, nguồn/giáo án/câu hỏi và các bản ghi lớp/bài làm/điểm là dữ liệu tài khoản của workspace, **không tự áp TTL 7 ngày của tutor/RAG**. Render Free có thể làm mất DB sớm; cần chính sách retention/backup/delete đầy đủ trước production.

Chạy `node tests/teaching-content.cjs` và `node tests/teaching-content-api.cjs`. Report tương ứng ghi **38 kiểm tra QA +24 kiểm tra handler/SQLite**, **16 provider calls bị chặn bằng fixture**, **0 provider request thật**. Clock DB được điều khiển giữa các case để tách quota phút. Đây là kiểm logic và đầu ra đối kháng, chưa phải benchmark mô hình, giáo viên/học sinh thật hoặc phép thử public bản mới.

Generation không tự retry sau lỗi mạng. Cùng UUID được namespace theo tài khoản và giữ uniqueness ở ledger/telemetry: sau khi kết thúc, retry trả 409 không gọi/tính credit lần hai; trong khi request đang chạy có thể bị guard đồng thời chặn 429 trước ledger. Không có receipt output để phục hồi draft đã mất. Giữ UUID cũ khi kiểm tra request không chắc trạng thái; việc chủ động tạo mới với UUID mới có thể gọi/tính credit mới. Tắt AI trong preferences được kiểm trước transport và khi settlement; tắt lúc chờ làm request bị từ chối/refund. Xem `SECURITY-REVIEW.md` để biết giới hạn retry và dữ liệu phản hồi toàn bộ workspace.
