# Nghiệm thu cá nhân hóa, dữ liệu và bảng giá đề xuất

Ngày kiểm tra: 15/10/2026 (Asia/Bangkok). Đọc cùng báo cáo nghiệm thu chung để biết phiên bản dependency, tình trạng AI thật và triển khai cuối. Báo cáo này không thay thế kiểm tra gia sư/độ đúng học liệu.

## Trước và sau

| Vấn đề tìm thấy khi kiểm tra ban đầu | Sửa trực tiếp | Giới hạn còn lại |
|---|---|---|
| Chỉ có bật/tắt và thích/không thích; chưa chọn chủ đề, độ khó hoặc mục tiêu | Tùy chọn được lưu theo tài khoản, dùng để xếp hạng và hiển thị lý do | Mức khó chỉ dùng metadata quiz đã ghi; không suy đoán trình độ cả môn học |
| Giải thích đề xuất còn chung chung | Hiện số thẻ đến hạn, tối đa 3 lần quiz gần đây trong 90 ngày, số câu đúng/tổng, những câu sai theo chủ đề và độ khó được ghi | Câu sai theo chủ đề không chứng minh một lỗi tư duy cụ thể; dữ liệu local không phải hồ sơ năng lực đã xác minh |
| Có thể dùng kết quả quiz tương lai/không hợp lệ hoặc lịch ôn của nội dung thẻ đã đổi | Lọc ngày/kết quả; so fingerprint nội dung thẻ; chỉ nhận chi tiết câu trả lời nhất quán với điểm | Không coi bản backup do người dùng sửa là dữ liệu server đáng tin để mở quyền/gói |
| Vector có thể gần nhau vì cùng định dạng hoặc va chạm hash | Lý do “gần nội dung đang học” cần có từ chủ đề trùng thật, không chỉ cosine | Mô hình xếp hạng nhỏ vẫn thử nghiệm, chưa chứng minh hiệu quả học |
| Học liệu tương tự có thể chiếm mọi vị trí | Xếp lại 12 vị trí đầu theo độ đa dạng chủ đề/định dạng bên cạnh mức ưu tiên | Độ đa dạng là quy tắc xếp hạng, không phải bảo đảm kiến thức phù hợp chương trình |
| Chưa đánh giá hữu ích sau học riêng với sở thích | Thêm tự đánh giá sau khi có hoạt động học/quiz/ôn thực, tách nhãn sở thích và số liệu quiz | Tự đánh giá không phải bài kiểm tra độc lập; không kết luận tăng điểm từ phản hồi này |
| Không có xóa phản hồi ngay trong mục đề xuất | Xóa phản hồi sở thích và sau học riêng, giữ học liệu/quiz/tùy chọn | Xóa dữ liệu tài khoản máy chủ khác vẫn cần quy trình riêng |
| Thông tin gửi AI chỉ có ở chính sách dài | Thành phần thông báo cho từng yêu cầu, chỉ liệt kê loại dữ liệu được chuẩn bị | Root tích hợp theo từng endpoint; cần xem kiểm tra triển khai chung để xác nhận toàn luồng thật |
| Chính sách chưa đề cập phiên gia sư mới và hosting thi | Nêu phạm vi đề bài/hội thoại, hết hạn 7 ngày, dọn khi truy cập, xóa phiên; nêu database tạm Render miễn phí | Chưa lịch dọn nền hoặc xóa tài khoản đầy đủ; reset hosting có thể làm mất phiên/credit sớm hơn |
| Gói trả phí chưa có giá để duyệt giao diện | Giá đề xuất VNĐ trong module riêng, có tháng/năm và credit pack, checkout luôn khóa | Không mở bán, không cấp credit trả phí, không tự gia hạn, chưa kiểm chứng chi phí thương mại |

## Bằng chứng chạy thực tế

- `node tests/recommendations.cjs`: **23/23 PASS**; kiểm tra thuật toán dữ liệu, account namespace, khôi phục/corrupt/cross-tab, điều khiển, bằng chứng quiz/ôn, đa dạng, ngưỡng mô hình và dữ liệu thông báo gửi ra ngoài. Dữ liệu kiểm thử local, không gọi mạng.
- `node scripts/test-ui.cjs --regional-learning`: **40/40 PASS** trên Edge qua Playwright CLI; báo cáo máy đọc: `qa-regional-learning-report.json`. Kiểm tra dữ liệu local thật trong phiên browser QA: lưu/reload tùy chọn, bật/tắt, reset, dữ liệu quiz trong lý do, 5 ngôn ngữ, kích thước 325/375/768, bảng giá tháng/năm, checkout khóa và nội dung chính sách.
- Suite UI được chạy lại sau cập nhật Next 15.5.27 và next-auth 4.24.15; kết quả cuối vẫn 40/40, không cộng hai lần chạy thành 80 kiểm tra khác nhau. Ảnh cuối đã làm sạch khung cắt logo trang chính sách và vị trí cuộn khi chụp.
- Số yêu cầu nhà cung cấp trong suite UI: **0**. Số thay đổi dữ liệu máy chủ: **0**. Lỗi runtime browser: **0**.
- QA dùng tài khoản/học liệu/kết quả **giả lập có ghi nhãn để kiểm thử giao diện**. Không phải học sinh tình nguyện, không phải kết quả học tập hoặc giao dịch thật. Không dùng các ảnh này làm bằng chứng độ chính xác của model.
- Hộp xác nhận xóa phản hồi của dữ liệu QA được tự chấp nhận bên trong browser cô lập để tránh cơ chế modal race của CLI. Bộ kiểm thử xác nhận dữ liệu đã xóa, không đánh giá giao diện hộp thoại Windows native. Ứng dụng vẫn hỏi xác nhận thật khi người dùng xóa.

Ảnh giao diện đã chụp và kiểm tra trực quan:

1. `qa-personalization-evidence.png`: tùy chọn, lý do có số liệu, đánh giá sau học riêng.
2. `qa-personalization-mobile.png`: giao diện điện thoại.
3. `qa-pricing-preview.png`: giá gói/credit đề xuất, ví tách riêng, thông báo chưa thu tiền.
4. `qa-pricing-mobile.png`: bảng giá trên điện thoại.
5. `qa-privacy-mobile.png`: phạm vi thi, nơi lưu dữ liệu và xử lý bên ngoài.

## Tệp thêm/sửa trong phần này

- `lib/lumio/recommendations.ts`, `lib/lumio/recommendation-copy.ts`, `components/lumio/recommendations.tsx`, `app/personalization.css`, `tests/recommendations.cjs`.
- `lib/lumio/outbound-disclosure.ts`, `components/lumio/outbound-data-notice.tsx` (root tích hợp AIPanel/VoiceStudio/AudioReadout).
- `app/privacy/page.tsx`, `app/data-deletion/page.tsx`, `components/lumio/policy-shell.tsx`, `app/policy.css` (sửa khung cắt logo để không lộ phần chữ thừa).
- `lib/lumio/pricing-preview.ts`, `components/lumio/billing.tsx`, `app/billing.css` (chỉ hiển thị; không sửa billing core máy chủ).
- `components/lumio/study-tools.tsx`: thêm chi tiết câu trả lời vào lần quiz đã hoàn thành; metadata types/storage và nguồn được thực hiện phối hợp với module truy xuất nguồn.
- `tests/regional-learning.browser.js`, nhánh `--regional-learning` trong `scripts/test-ui.cjs` (nhánh source QA do module nguồn bổ sung sau).
- Các tài liệu `STUDENT-PILOT.md`, `PILOT-FEEDBACK.md`, `pilot-metrics.csv`, `PRODUCT-POSITIONING.md`, `PRICING-PROPOSAL.md` và báo cáo/ảnh này.

## Trạng thái nghiệm thu

| Hạng mục | Trạng thái | Căn cứ |
|---|---|---|
| Logic cá nhân hóa và điều khiển | PASS | 23 kiểm tra logic và các thao tác browser trong 40 kiểm tra UI |
| Tính hữu ích/tiến bộ học trên học sinh | NOT TESTED | Chưa có người tham gia; packet và CSV chỉ là mẫu trống |
| Minh bạch dữ liệu và xóa phản hồi local | PASS | Nội dung trang + luồng lưu/xóa đã kiểm tra |
| Quản trị dữ liệu toàn nền tảng | PARTIAL | Giới hạn host tạm, retention/xóa tài khoản đã công bố; chưa quy trình production đầy đủ |
| Giá đề xuất và khóa checkout | PASS | Xem giá không tạo API ghi hoặc giao dịch; checkout disabled |
| Thu tiền, cấp credit trả phí, hoàn tiền hoặc subscription thật | NOT TESTED | Không triển khai trong phạm vi bản thi miễn phí |

Hồ sơ thử nghiệm học sinh phải giữ **NOT TESTED** cho tới khi thực sự thu, chấm và tổng hợp dữ liệu theo `STUDENT-PILOT.md`. Không sao chép các điểm quiz QA thành dữ liệu người dùng.
