# V8 — Ma trận đề và quan sát hàng đợi

Phạm vi ngày 16/10/2026: bổ sung vào Teacher Workspace hiện có; không tạo hệ thống giáo viên hay kỳ thi mới. Không có migration cho phần này. Migration18 thuộc nâng cấp Tutor riêng.

## Ma trận đề hoạt động thế nào

Trong **Bài tập → Tạo bài tập → Cách chọn câu → Ghép theo ma trận đề**, giáo viên chọn lớp, hạn nộp, đối tượng và các dòng chủ đề/độ khó/dạng/số lượng. Giới hạn 12 dòng và tổng 30 câu. Mỗi tổ hợp xuất hiện một lần. Đây là chọn câu đã duyệt bằng thuật toán xác định, không gọi AI, không dùng credit và không mô phỏng trả phí.

`POST /api/teaching` nhận action `assignment.compose`, `orgId`, `requestId`, `expectedClassRevision`, `draft` và `blueprint`. `draft` dùng các trường tạo bài hiện có nhưng không được chứa `questionIds`; mỗi dòng blueprint có `topic`, `difficulty` (basic/medium/advanced), `kind` (mcq/short/essay), `count`.

Máy chủ kiểm tra phiên hiện hành, chứng nhận giáo viên, thành viên tổ chức, quyền lớp và CAS phiên bản lớp trước khi đọc ngân hàng. Chỉ lấy câu `reviewed` của đúng lớp, hoặc câu không gắn lớp mà chính giáo viên sở hữu; quản trị tổ chức được dùng ngân hàng chung trong chính tổ chức. Vai trò quản trị hệ thống không tự cấp quyền lớp khác.

Thuật toán matching có giới hạn chọn câu không trùng ID/nội dung cho toàn đề. Câu cùng nội dung ở hai dòng không làm thuật toán chọn tham lam rồi báo thiếu sai khi còn cách ghép đủ. Thứ tự ứng viên theo ID được giữ ổn định; đây không phải chọn ngẫu nhiên. Nội dung trùng được so bằng NFC, khoảng trắng và chữ hoa/thường, giữ nguyên ký hiệu số mũ. Không tuyên bố hiểu tương đương ngữ nghĩa hay chứng minh mọi đáp án đúng.

Nếu không ghép đủ, API trả422 `TEACHING_BLUEPRINT_SHORTAGE` cùng danh sách dòng, số cần, số chọn được không trùng và số thiếu. Không lưu đề, người nhận, receipt hay audit của thao tác thất bại. Chỉ số thiếu mô tả cách matching xác định hiện tại; không đếm câu trong ngân hàng ngoài quyền truy cập. Nguồn và trạng thái từng câu đã chọn tiếp tục được kiểm tra lại trước khi ghi.

Nếu đủ, đề là **bản nháp thông thường**, chưa có người nhận và chưa giao. Gửi lại cùng request ID và nội dung trả lại cùng đề; nội dung khác dùng lại ID bị409. Cùng thao tác transaction bao gồm đề, cửa sổ nhận bài, audit và receipt. Khi tạo xong, ma trận được thể hiện bằng phân bố thực của đề; các dòng yêu cầu ban đầu không trở thành ràng buộc ẩn. Giáo viên có thể dùng trình chỉnh sửa hiện có để bỏ/thêm câu; thay đổi quay lại trạng thái nháp và vẫn cần duyệt/giao rõ ràng.

## Kiểm tra toàn đề

`inspectAssessment` bổ sung cho kiểm tra từng câu đã có, không thay thế nó. Cùng quy tắc chạy ở tạo/cập nhật/duyệt/giao:

- Chặn số câu ngoài1–30, ID/câu trùng sau chuẩn hóa, điểm không hợp lệ hoặc tổng điểm không khớp.
- Hiển thị phân bố chủ đề, độ khó, dạng câu, tổng điểm và số câu cần giáo viên chấm.
- Nhắc kiểm tra khi thiếu trích đoạn nguồn, hoặc ít nhất75% của từ4 câu trắc nghiệm có cùng vị trí đáp án. Đây là lời nhắc, không phải lý do tự động kết luận đề sai.
- Giáo viên vẫn kiểm tra độ tuổi, nội dung, đáp án, rubric và cách diễn đạt. Trích đoạn khớp không chứng minh tất cả khẳng định đúng.

Đề đã giao, người nhận chốt, lịch sử điểm, retake và số bằng chứng độc lập giữ hành vi V7. Học sinh không nhận đáp án/rubric/giải thích trước khi công bố kết quả riêng của mình. Câu không còn duyệt được báo trong trình chỉnh sửa; giáo viên có thể loại câu khỏi bản nháp để sửa tiếp.

## Admin: trạng thái hàng đợi thật, chỉ đọc

`GET /api/admin/jobs` yêu cầu quyền hệ thống `system.read`, phiên admin được xác thực lại trong một giờ và header tài khoản hiện hành. Bearer/cross-site/query lọc tùy ý bị từ chối. Role/session được kiểm tra thêm trong transaction đọc để không dùng quyền đã bị thu hồi giữa authorization và truy vấn.

Panel Tổng quan chỉ tải khi bấm **Kiểm tra hàng đợi**. Báo cáo đếm trạng thái tác vụ tóm tắt còn lưu, việc chờ đủ điều kiện, việc sẵn sàng theo mốc thời gian, retry chờ, tuổi tác vụ chờ lâu nhất, lease đang chạy/hết hạn/thiếu dữ liệu, tác vụ hết hạn còn lưu và phiên bị thu hồi. Bản hoàn tất/hết hạn chưa dọn vẫn được tính trong tổng còn lưu. `readyNow` biểu thị điều kiện của hàng đợi; không đảm bảo còn quota/credit hoặc provider khả dụng.

Không có ID tác vụ/tài khoản, tên, tiêu đề, nội dung nguồn, đầu ra, lease token hoặc error text trong response. Không kích hoạt worker, dọn dữ liệu, retry, hoàn credit hay ghi audit khi đọc. Mốc cấu hình bật không chứng minh worker đang chạy. Không có số liệu backup/uptime giả. Phục hồi vẫn dựa vào chủ sở hữu truy cập; host miễn phí có thể ngủ. Đây là số liệu một DB, không phải tổng nhiều server độc lập.

## Kiểm chứng cục bộ

| Lệnh                                           | Kết quả đã chạy                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `node tests/v8-assessment.cjs`                 | 14 nhóm kiểm thử: handler thật + SQLite tạm, gồm phân quyền, shortage rollback, CAS, replay, snapshot và thu hồi phiên |
| `node scripts/test-v8-assessment-ui.cjs`       | 19 kiểm tra trình duyệt, component/CSS thật với HTTP tổng hợp; kèm32 kiểm tra SSR nền                                  |
| `node tests/v8-job-health.cjs`                 | 9 nhóm kiểm thử: handler admin thật + SQLite tạm, bao gồm không lộ dữ liệu và race thu hồi quyền                       |
| `node scripts/test-v8-job-health-ui.cjs`       | 10 kiểm tra trình duyệt, gồm account switch, response muộn, lỗi quyền và mobile                                        |
| `node tests/teaching-api.cjs`                  | 49 kiểm tra hồi quy PASS                                                                                               |
| `node tests/teaching-content.cjs`              | 38 kiểm tra hồi quy PASS                                                                                               |
| `node tests/teaching-content-api.cjs`          | 24 kiểm tra hồi quy PASS; transport được mock, không gọi provider thật                                                 |
| `node tests/v7-admin-hydration.cjs --ssr-only` | 5 kiểm tra SSR/múi giờ PASS                                                                                            |

Hồi quy `node tests/v7-retakes.cjs` cũng PASS 24 kiểm tra sau khi cập nhật kiểm tra phiên bản schema18; không thay đổi hành vi retake. Typecheck toàn dự án PASS.

Các report có thời điểm chạy nằm trong `docs/v8/reports`. Tài khoản, lớp, câu hỏi và queue của kiểm thử đều là dữ liệu tổng hợp. Không dùng DB người dùng, không gọi AI trả phí, không công bố/deploy từ các kiểm thử này. Kiểm thử browser với HTTP tổng hợp không thay thế các kiểm thử handler/SQLite và không phải đánh giá với học sinh thật.

Chưa triển khai: đề thi ngẫu nhiên có kiểm soát, đồng hồ thi cá nhân, giám sát/chống gian lận, accommodations, tự chấm kết luận bài tự luận, backup ngoài máy chủ hay worker thường trực. Các cửa sổ nhận bài và retake cùng đề hiện tại là luồng bài tập/luyện lại đã kiểm soát, không được mô tả là kỳ thi bảo mật.
