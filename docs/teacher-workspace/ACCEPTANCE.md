# Nghiệm thu phạm vi Teacher Workspace

Ngày: 15/10/2026. Source `3.2.0-teacher.1`, migration SQLite **1–13**. Nâng cấp tiếp trên Lumio V3.1; giữ gia sư học sinh và biên nhận khu vực đã có. Báo cáo này phân biệt **đã có code/luồng kiểm thử** với **đã triển khai public**, **AI thật** và **hiệu quả học tập**. Không đánh dấu toàn bộ yêu cầu production đã hoàn thành.

**PASS** trong bảng nghĩa là đạt các phép thử có phạm vi được ghi; **PARTIAL** là còn giới hạn; **NOT TESTED** là chưa có bằng chứng. Dữ liệu tổng hợp không phải giáo viên/học sinh thật; viewport điện thoại không phải thiết bị thật.

## Bốn giai đoạn

| Giai đoạn | Kết quả triển khai và bằng chứng | Giới hạn còn lại |
| --- | --- | --- |
| 1. Quyền, tổ chức, lớp, dashboard | **PASS trong kiểm thử**: canonical session/account/org/class; credential giáo viên, tạo lớp, mã mời băm, tham gia, enrollment, nhóm và đồng giảng viên. Backend49; compiled HTTP phase1 **3 case**; UI thực với HTTP tổng hợp. | Xét bản khai khác xác minh nghề nghiệp. Không có onboarding trường/SSO tổ chức hoặc giáo viên/học sinh thật trong các phép thử. |
| 2. Học liệu, giáo án, câu hỏi, giao bài | **PASS trong kiểm thử**: lưu/chỉnh nháp, exact references từ nguồn có quyền, review riêng, snapshot câu hỏi và recipients khi issue. Content QA38; API/ledger24; compiled phase2 **2 case**. Có thêm **2 request provider thật** trên server local đã biên dịch, phạm vi bên dưới. | AI vẫn review-required; quote khớp không chứng minh mọi khẳng định. Chưa là benchmark giáo án/độ khó/đáp án; chưa có kho media gốc bền vững hoặc proof mới cho mọi định dạng. |
| 3. Bài làm, chấm, công bố, tiến bộ | **PASS trong kiểm thử**: student chỉ nộp cho mình, MCQ tạm, giáo viên xác nhận từng điểm rồi công bố riêng. Student payload ẩn keys/rubric/điểm chưa công bố. Backend49; compiled phase3 **1 case**; UI kiểm luồng join → submit → chấm → publish. | API có resubmit khi còn cho phép và regrade làm rút công bố; UI chưa lộ đủ thao tác student resubmit và regrade bài đã công bố. Analytics mô tả kết quả, không chứng nhận mastery hay hiệu quả học. |
| 4. Giao tiếp, xuất, preferences, chất lượng UI | **PASS trong kiểm thử**: bảng tin draft/published, lịch lớp, CSV/JSON theo quyền, preferences/CAS/AI opt-out, UI 12 module và student classroom. Compiled phase4 **2 case**, gồm backup/restore DB riêng. | Thông báo trong app; chưa email/push/calendar ngoài. PDF dùng browser print/lưu PDF, không là dịch vụ tạo PDF máy chủ. Chưa có tải toàn trường, off-host DR hoặc thiết bị thật. |

## Bao phủ 12 module

| Module | Chức năng hiện có | Phạm vi nghiệm thu / phần chưa có |
| --- | --- | --- |
| Tổng quan | Counts, việc chờ chấm, lịch hạn và số liệu từ state đã lưu; tài khoản mới rỗng. | Không seed lớp/học sinh hoặc biểu đồ giả. Không suy KPI thử nghiệm thành kết quả giáo dục. |
| Lớp học | Tạo/sửa/lưu trữ, invite, join, enrollment, nhóm, đồng giảng viên và quyền tổ chức. | Backend ràng buộc tenant/lớp và thu hồi. Không có institutional SSO hoặc xác minh công tác chính thức. |
| Studio bài giảng | Mục tiêu/phần học sửa được, nguồn có quyền, AI lesson draft, lưu → duyệt → chia sẻ. | Provider thật đã trả một lesson draft với nguồn **mixed**, Toán **not-checked**; cần giáo viên review. Không tự xuất bản. |
| Bài tập | Chọn câu đã duyệt, class/group/individual target, due date, late policy, review rồi issue; snapshot bất biến. | Recipient snapshot không tự thay khi sửa nhóm. Student resubmit phía API có giới hạn trạng thái; UI chưa có đầy đủ thao tác resubmit. |
| Ngân hàng câu hỏi | MCQ/short/essay theo schema; choices/key/explanation/model answer/rubric, nháp/chỉnh sửa/review; kiểm lỗi độc lập có phạm vi. | AI mới tạo MCQ bốn lựa chọn. Hai câu AI thật có exact excerpts nhưng math **not-checked**; không gọi là đáp án đã được xác minh toàn diện. |
| Chấm & nhận xét | Xem bài, điểm tạm MCQ, xác nhận per-question, lưu grade và công bố riêng; gợi ý nhận xét chỉ từ excerpt giáo viên tự gõ đã bỏ nhận dạng. | AI không tự chấm/công bố. API hỗ trợ regrade/withdraw; UI chưa lộ trọn luồng regrade kết quả đã công bố. |
| Tiến bộ học tập | Phân tích theo kết quả đã công bố, số assessment/chủ đề và nhãn thiếu bằng chứng. | Ít nhất ba assessment khác nhau trước nhãn topic; chưa là năng lực ổn định, so sánh lớp chuẩn hóa hoặc kết quả pilot. |
| Thư viện giảng dạy | Lưu/tìm/chỉnh extracted text hoặc nội dung/link, references và quyền chia sẻ; giữ proof server hợp lệ cho text không đổi. | UI test import text; baseline extraction có báo cáo riêng. Không tuyên bố mọi PDF/scan/Office math/video đều đọc được; chưa lưu media gốc bền vững. |
| Bảng tin & lịch | Draft/publish thông báo, lịch lesson/deadline/meeting theo lớp, revision. | Chỉ trong ứng dụng; chưa email, push hoặc đồng bộ lịch ngoài. |
| Trợ lý giảng dạy | Teacher-only generation, nguồn được chọn/topic inference, consent mới, UUID chống gọi/tính credit lặp, không autosave. | Cùng UUID sau hoàn tất trả409; request đang chạy có thể429 trước ledger. Không có replay output để lấy lại draft mất ACK; tạo mới có thể tốn credit. |
| Báo cáo | Backend CSV/JSON theo quyền; student chỉ kết quả của mình đã công bố. CSV download và browser print/lưu PDF ở UI. | Không có server-rendered PDF, báo cáo toàn trường đã kiểm định hoặc xuất dữ liệu ngoài tenant. |
| Cài đặt | Tổ chức/timezone/late policy; preferences môn, khối, tên hiển thị, ngôn ngữ, độ khó, AI và thông báo trong app. | AI tắt được kiểm trước gọi và khi settlement; ngôn ngữ giới hạn 5 mã AI hỗ trợ. Chưa có email/push, self-service xóa toàn workspace hoặc retention production tự động. |

## Đối chiếu bằng chứng

| Report / kiểm tra | Kết quả | Loại bằng chứng |
| --- | --- | --- |
| [backend-api-report.json](backend-api-report.json) | **49 PASS** | Handler Request/Response, canonical policy, migration/reopen, SQLite và CAS/receipt/exports/quotas; account/credential dữ liệu tổng hợp, không provider. |
| [content-qa-report.json](content-qa-report.json) | **38 PASS** | Validator xác định, đầu ra đối kháng, exact quote/locator, MCQ/math hữu hạn, consent/minimization và generic-client context injection; không provider. |
| [content-api-report.json](content-api-report.json) | **24 PASS**, **16 transport bị chặn**, **0 request provider thật** | Handler/SQLite ledger và assertion thật; OAuth/provider/clock kiểm soát trong fixture. Nguồn/quyền/phiên/AI preference đổi khi chờ bị reject/refund; UUID không tính credit lặp. |
| [qa-teaching-ui-report.json](../v3/qa-teaching-ui-report.json) | **52 browser +32 SSR/pure PASS** | React/CSS/DOM thật, HTTP tổng hợp; 29 mutation/3 generation mocks; không OAuth/provider/student thật. Report mới nhất thay lần trước51 browser. Có desktop,768px,390px/reduced-motion/private-cache checks; không device proof. |
| [production-http-report.json](production-http-report.json) | **8 PASS**, phase1/2/3/4 = **3/2/1/2** | `next start` local đã biên dịch, HTTP thật, DB riêng và business handlers thật; session/account tổng hợp, **0 provider**. Restore sang SQLite file riêng/schema13 đạt; không là khôi phục host hoặc off-site DR. |
| [real-provider-report.json](real-provider-report.json), [output](real-provider-output.json) | **2 request thật HTTP200** | Compiled local Next, synthetic authenticated owner, bài tiếng Việt tự soạn; một lesson và một batch hai MCQ. Khác phép thử public/OAuth/người học thật. |
| TypeScript / regression / build staging do root chốt | **711 assertions PASS**; build production trước các sửa cuối đã PASS | Không cộng vào tổng các suite bên trên vì có giao nhau. Build chốt sau MathText/private-cache/localization fix được root xác minh riêng; không suy phép thử cũ sang release mới nếu chưa có report. |

### Hai kết quả provider thật cho biết điều gì

- Lesson: HTTP200, khoảng **11,6 giây** trong một mẫu; `review-required`, `sourceSupport:mixed`, ba section thiếu reference; `math:not-checked`. Có heading trộn tiếng Anh. Đây là lỗi/giới hạn được ghi nhận, không che bằng schema PASS.
- Hai MCQ: HTTP200, khoảng **7,7 giây** trong một mẫu; `review-required`, `sourceSupport:exact-excerpts`, `math:not-checked`. Exact excerpt chỉ xác nhận quote có trong nguồn; chưa có chấm ngữ nghĩa độc lập cho mọi câu.
- Cùng UUID trả409, không gọi provider thêm; không auto-save lesson/question, ledger còn184 từ200 trial và không còn credit held. Các thời gian n=2 không phải SLO hoặc load test.
- Root đã bổ sung chỉ dẫn bản địa hóa sau hai request này. **Chưa có bằng chứng ở hai report đó rằng sửa ngôn ngữ đã chạy thành công trên public**; lần kiểm tra public sau, nếu có, phải ghi report riêng.

## Điều kiện còn lại trước tuyên bố production

- **NOT TESTED**: giáo viên/học sinh thật, pilot tự nguyện và điểm trước/sau/ghi nhớ; không tạo người tham gia hoặc nhận xét giả. Protocol trống hiện có không phải kết quả.
- **NOT TESTED trong report này**: deployment/public Teacher Workspace mới, Google OAuth của bản mới và kiểm lại ngôn ngữ sau sửa. Runtime đã nộp V3.1 có bằng chứng riêng; không tự nộp lại cổng khi cập nhật source.
- **PARTIAL**: semantic accuracy, độc lập kiểm mọi giải thích/giáo án, curriculum alignment, calibrated learner mastery và độ phù hợp độ tuổi. AI chỉ tạo draft cần review.
- **PARTIAL**: SQLite/Render Free, full-state reads và hàng rào dung lượng 2MiB content/256KiB communication/8MiB tổng không thay DB nhiều máy, pagination, off-host backup/DR, monitoring và load test. Đổi host/reset có thể mất dữ liệu.
- **NOT TESTED / chưa triển khai đầy đủ**: APK/IPA Teacher Workspace, hai thiết bị vật lý, full native sync, realtime voice/Zoom loopback, store, institutional SSO, email/push và retention/xóa workspace tự phục vụ.
- **Chủ động tắt**: thanh toán/checkout thật. Credit/quota là guard máy chủ đã kiểm, không là bằng chứng doanh thu, hóa đơn hoặc Google Play/Apple billing.

Đọc cùng [BACKEND.md](BACKEND.md), [CONTENT-QA.md](CONTENT-QA.md), [SECURITY-REVIEW.md](SECURITY-REVIEW.md), [MATURITY-AUDIT.md](MATURITY-AUDIT.md) và hướng dẫn root. Không có deploy/upload/nộp cổng từ tài liệu nghiệm thu này.
