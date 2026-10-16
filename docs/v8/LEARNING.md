# V8 · Kế hoạch học, minh chứng và quyền điều chỉnh

Phạm vi này nâng cấp engine hiện có; không thêm provider, SDK, cơ sở dữ liệu hay tự gửi yêu cầu AI. Trạng thái dưới đây là kiểm thử local với dữ liệu tổng hợp. Không có nghiên cứu học sinh, đo tăng điểm, kiểm chứng hiệu quả sư phạm, thiết bị thật hay xác nhận public V8 trong báo cáo này.

## Những thay đổi đã kiểm tra

| Hạng mục | Kết quả và giới hạn |
| --- | --- |
| Câu quiz đảo đáp án | `q2` dùng câu hỏi, tập đáp án chuẩn hóa và **nội dung đáp án đúng**, nên đổi thứ tự không tạo thêm câu độc lập. Không suy ra tương đương đại số hoặc ngữ nghĩa. |
| Đáp án phụ thuộc vị trí | Dùng bộ nhận diện bảo thủ đã có cho năm ngôn ngữ trên câu hỏi/đáp án; `q3` giữ thứ tự. Chỉ nhắc “đáp án A/B” trong lời giải không tạo câu độc lập mới. Bộ bảo vệ đảo đáp án của generator không bị thay đổi. |
| Minh chứng `q1` cũ | Vẫn đọc, xuất và giữ điểm/lịch sử. Định danh cũ phụ thuộc thứ tự nên không cộng vào số câu độc lập hoặc suy luận lỗi gần đây. Không tự bịa snapshot mới từ quiz hiện tại. |
| Nhận ra câu cũ | Khi có lịch sử `q1`, tối đa24 hoán vị của câu hiện tại được so để giữ trạng thái “đã gặp”; không tính việc gặp lại thành bằng chứng mới. |
| Hàng đợi ôn | Thẻ thực sự đến hạn đứng trước thẻ chưa từng ôn. Lịch khác nhau vẫn dựa đánh giá nhớ lại và nội dung thẻ. |
| Kế hoạch gọn | Một hành động chính luôn hiện, tối đa hai lựa chọn khác trong mục mở rộng native có thể điều khiển bằng Enter, không lặp học liệu. Chỉ trỏ tới tài liệu đang có. Lý do phân biệt lịch ôn, lỗi quan sát, nền tảng khai báo, cần thêm mẫu và trọng tâm tự chọn. |
| Quyền người học | Có thể chọn trọng tâm, xem từng lượt luyện, loại/khôi phục lượt khỏi diễn giải kỹ năng. Điểm, đáp án, số lượt và tài liệu gốc không bị sửa. Đây không phải quyền ghi đè đánh giá chính thức của giáo viên. |
| Đổi lịch ôn | Dời một ngày, chọn ngày/giờ tương lai trong365 ngày hoặc dùng lại lịch thích ứng. Override riêng; không tạo sự kiện học, lượt ôn hoàn thành, điểm hay tăng số lần nhớ. |
| Quyền riêng tư | Tính trên dữ liệu tài khoản hiện tại. Tắt cá nhân hóa không tính hồ sơ kỹ năng; lịch đã đặt vẫn là dữ kiện để người học mở ôn. Không gửi hồ sơ tới AI. |
| Giao diện | Nhãn/trợ giúp năm ngôn ngữ, sáng/tối theo token chung, giảm chuyển động theo OS hoặc lựa chọn `data-motion="off"`, nút native có nhãn, màn hình390px không tràn trong fixture. |

Nền tảng vẫn giữ quy tắc thận trọng:8 câu khác nhau,3 ngày trải ít nhất7 ngày và2 độ khó được khai báo trước khi gắn nhãn kết quả ổn định hơn. Đây là quy tắc thử nghiệm, không phải xác suất thành thạo. Độ khó chưa được hiệu chuẩn. Một câu đúng, lượt thích hoặc thời gian dùng app không chứng minh năng lực.

## Dữ liệu và tương thích

- `Preferences.excludedSkillAttemptIds?`: tối đa1000 ID không trùng; chỉ ảnh hưởng suy luận kỹ năng.
- `Preferences.studyFocusSkillId?`: một ID trong taxonomy7 kỹ năng Toán đã khai báo; `null` biểu thị chủ động quay về thứ tự tự động. Không thay kết quả quan sát.
- `LearningState.reviewOverrides?`: tối đa20000 bản ghi `{key,itemId,cardId,fingerprint,dueAt,updatedAt}`. Nội dung đổi hoặc thẻ bị xóa làm override cũ không còn áp dụng. Chỉ thao tác đánh giá nhớ thật mới cập nhật lịch thích ứng và sự kiện ôn.
- Giữ `version:1` và các trường mới tùy chọn để bản sao cũ vẫn đọc được. Bộ kiểm tra từ chối kiểu sai, khóa trùng, thời gian vô hiệu hoặc quá giới hạn.
- JSON backup giữ các trường này. Cloud sync hiện có giữ override và phát hiện xung đột gộp ba chiều theo khóa thẻ; hai lựa chọn lịch cùng bị sửa không được âm thầm ghi đè. Trong web/Dart merge và PUT tại máy chủ, trường tùy chọn bị thiếu từ client cũ được giữ theo bản đã biết; `[]` hoặc focus `null` mới biểu thị xóa rõ ràng. Tắt `enabled`/`skillTracking` vẫn được áp dụng. Không cần thay phiên bản envelope hoặc migration.
- Phát lại cùng yêu cầu cũ dùng fingerprint của dữ liệu đầu vào, không ghi lại bản cũ hoặc khôi phục lựa chọn đã xóa ở revision mới. Digest của snapshot lưu là digest dữ liệu sau bảo toàn; tổng kích thước được kiểm tra lại trước khi ghi.
- Source Flutter được sửa giới hạn ở bộ gộp Web snapshot để không bỏ override khi sửa ghi chú. Thư viện native vẫn tách riêng. **APK/iOS/desktop cũ chưa xây lại và không được coi là đã kiểm chứng V8.**

Việc xóa snapshot kỹ năng giữ nguyên quiz và các ID đã loại; nếu lưu thư viện thất bại hoặc xung đột, snapshot cũ trở lại vẫn bị loại. Chỉ nút khôi phục rõ ràng mới bỏ loại trừ. Thông báo xóa ghi nhận yêu cầu, không khẳng định callback lưu bất đồng bộ đã hoàn tất. Các lượt cũ có thể vẫn xuất hiện ở lịch sử tổng quát. Việc loại khỏi diễn giải không xóa cloud snapshot hoặc bản sao JSON đã xuất. Xóa/đồng bộ vẫn theo lựa chọn rõ ràng của người dùng và quyền hiện có.

## Điểm tích hợp

`DailyLearningPlan` nhận `items`, `learning`, `preferences`, `locale`, `open`, và tùy chọn `onReview`, `onPreferences`, `storageError`. Không có mạng hoặc tự tạo bài luyện. Recommendations đã dùng component này; trang chủ do phần tích hợp chung gắn thêm.

`Review` nhận thêm `storageError?` để khóa điều chỉnh lịch khi lưu bị chặn. Khi `useLearning` giữ thay đổi chưa ghi được ở bộ nhớ, có cảnh báo chưa lưu, không dùng callback trả về làm bằng chứng đã lưu. Workspace hiện được gắn khóa theo tài khoản. Các callback hiện có tiếp tục quản lý điều hướng và lưu dữ liệu; component không tự thay tài khoản hoặc đọc storage chung.

## Bằng chứng local

- `node tests/v8-learning.cjs`: **34 PASS**, fixture tự viết, không có provider. Có hồi quy câu hỏi trùng do lời giải nhắc chữ cái đáp án, loại lượt đầu rồi làm lại và gộp bản đồng bộ client cũ. [Báo cáo](reports/learning-unit.json).
- Bộ skill cũ: **39 PASS**; report mới được chuyển sang [bản tương thích V8](reports/skill-evidence-compatibility.json), không ghi đè bằng chứng V3.
- `node tests/learning.cjs`: **14 PASS**; `node tests/recommendations.cjs`: **23 PASS**. Không mạng.
- `node tests/runtime-sync.cjs`: **17 PASS**, SQLite tạm thật, hai store và backup/restore. Có PUT từ client cũ tắt cá nhân hóa nhưng giữ trường mới, phát lại ACK cũ sau khi chủ động xóa, kiểm tra tổng kích thước và rollback snapshot/receipt. [Báo cáo](reports/sync-compatibility.json).
- `node scripts/test-v8-learning-ui.cjs`: **44 PASS**, React/CSS thật trong Edge cách ly, toàn bộ HTTP bị chặn/phục vụ từ fixture; không đăng nhập, gọi API sản phẩm hoặc AI. Gồm callback xóa thư viện thất bại và hook `useLearning` thật gặp `localStorage` từ chối ghi. [Báo cáo](qa-learning-ui.json).
- Flutter: `flutter test --no-pub test/web_sync_test.dart --reporter expanded`: **25 PASS** (6 trường hợp V8 mới), và phân tích tĩnh hai file sửa không có issue. Chỉ mã nguồn và fixture HTTP/tệp tạm, không phải APK hoặc thiết bị thật. [Báo cáo](reports/mobile-web-sync.json).
- Kiểm tra TypeScript trong đồ thị file sở hữu: không có diagnostic ở các file đó. Đây không thay full regression/build/typecheck của bản tích hợp.

Ảnh đã mở và kiểm tra bố cục; đều có nhãn dữ liệu tổng hợp:

1. [Kế hoạch desktop](qa-learning-plan-desktop.png).
2. [Xem/loại minh chứng trên mobile](qa-evidence-mobile.png).
3. [Đổi lịch ôn trên mobile](qa-review-mobile.png).
4. [Kế hoạch giao diện tối390px](qa-learning-plan-dark-mobile.png).

## Còn giới hạn

Chưa mở rộng taxonomy thành toàn bộ môn học. Không chẩn đoán tâm lý hoặc tự gắn loại hiểu lầm từ một đáp án sai. Lịch sử hint của Tutor chưa được liên kết đáng tin cậy với quiz, nên không gán nhãn “không dùng trợ giúp” hoặc tăng/giảm năng lực dựa dữ liệu không có. Chưa có teacher override đối với hồ sơ local của học sinh, nghiên cứu hiệu quả với người học thật hoặc mô hình năng lực đã hiệu chuẩn. Các giới hạn hosting miễn phí và thanh toán tắt vẫn giữ nguyên.
