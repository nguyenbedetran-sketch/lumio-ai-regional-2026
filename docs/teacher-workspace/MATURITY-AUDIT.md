# Audit độ trưởng thành sản phẩm và phần AI cho giáo viên

Ngày audit: 15/10/2026. Căn cứ: mã hiện có trước đợt Teacher Workspace; prompt “FINAL PRODUCT MATURITY UPGRADE”; báo cáo V2/V3.1 và biên nhận khu vực. Đây là audit bằng mã và bằng chứng có phạm vi, không tự biến kết quả fixture cũ thành phép thử provider/public mới.

Tại thời điểm audit ban đầu, runtime public đã được báo cáo là `3.1.0-regional.1`, commit `6eabc3219f9298676bdd29ae0ee15a91b9593288`; Teacher Workspace chưa triển khai hoặc thử provider thật. Các kết quả bổ sung ở cuối tài liệu và báo cáo nghiệm thu cập nhật trạng thái sau đó. Phép thử thật V3.0/PDF/RAG khác phép thử thật V3.1/tutor; health không chứng minh chất lượng AI, retention, sync hoặc chức năng giáo viên mới.

| Yêu cầu mới | Hiện trạng có căn cứ | Trạng thái và giới hạn |
| --- | --- | --- |
| Audit live/demo | `docs/v3/public-v31-live-check.json`, teacher/http reports và cấu hình competition preview phân biệt API thật với fixture. | PASS trong lần smoke đã ghi; NOT TESTED cho workspace mới/public mới. Không suy từ giao diện hoặc health sang AI đúng. |
| Gia sư có trạng thái | `lib/server/tutor-core.ts`, `lib/tutor/policy.ts`: đề bất biến, canonical history, số gợi ý phía server, đổi nguồn tạo ngữ cảnh mới; không tin mode/client history. | PARTIAL về sư phạm: không phải mô hình lỗi/kiến thức tiên quyết đã hiệu chuẩn; câu đúng một lần không chứng minh hiểu. Một số lượt thật có nhiều thao tác. |
| Nguồn đối chiếu | `lib/ai/grounding.ts`, `lib/server/source-evidence.ts`, `lib/server/rag-core.ts`: exact quote, vị trí server, namespace và snapshot. | PASS trong giới hạn đã test; PARTIAL về chất lượng truy xuất/bao phủ khẳng định. OCR, Office math phức tạp, mọi URL/video và mọi suy luận không được chứng nhận. |
| Hồ sơ năng lực | `lib/lumio/skill-evidence.ts` và taxonomy: quan sát tách suy luận, chống đếm trùng, độ khó/ngày/giãn cách, lý do và tắt/xóa. | PARTIAL: 7 kỹ năng nền tảng, ngưỡng heuristic chưa hiệu chuẩn; NOT TESTED về hiệu quả học sinh thật. Lượt thích/thời gian không phải năng lực. |
| Math verification | `lib/tutor/math-exact.ts`: số hữu tỉ, thay nghiệm/điều kiện/đủ nghiệm và một số phép biến đổi trong grammar hữu hạn. | PARTIAL: kiểm nghiệm cuối không xác nhận mọi dòng; văn xuôi/hình học/biến khác có thể chưa kiểm. Giao diện phải giữ nhãn giới hạn; không được gắn xanh giả. |
| Content QA | Structured validators, exact references, duplicate detection hiện có trong `lib/ai/contracts.ts`. | PARTIAL trước thay đổi: chưa có hợp đồng nội dung giáo viên, chặn xuất bản theo QA hoặc kiểm đáp án độc lập cho câu giáo viên. Ưu tiên bổ sung module nhỏ và bộ dữ liệu đối kháng. |
| Database/migration/queue | SQLite migrations, receipt/CAS/outbox, job checkpoint/lease/fencing, ledger và rate quota dùng chung file DB. | PASS trong test scope đã ghi; PARTIAL production: không là DB nhiều máy bền vững, host miễn phí có thể ngủ/reset. Backup tooling khác backup ngoài host và diễn tập DR. |
| Routing/cost | `lib/ai/router.ts`, guard/billing/telemetry: provider sẵn có, fallback hữu hạn, reserve/settle/refund trước transport; không có key ở client. | PASS trong test scope; PARTIAL về đơn giá/chất lượng model tổng quát. Giữ provider/model hiện tại; không thêm SDK hoặc tự đổi model để “nâng cấp”. |
| Web–Android–iOS | Web opt-in snapshot; Flutter `0.4.0+4` giữ JSON metadata, sửa notes, native library riêng. | PARTIAL source; NOT TESTED cho APK/IPA mới, thiết bị thật hoặc full library sync qua hai điện thoại. |
| Tài khoản giáo viên | Bản khai và xét duyệt thủ công qua `lib/teachers/*`, quyền owner/admin; không đồng nghĩa xác minh nghề nghiệp. | PASS trong phạm vi form/permission; NOT TESTED danh tính thật. Workspace mới phải kiểm credential + membership/org ở mỗi thao tác, không tin role/org từ body. |
| Dữ liệu học sinh | Chưa có classroom production trong baseline. | Không gửi roster, tên hoặc submission học sinh tự động tới AI. Feedback mới chỉ nhận đoạn giáo viên tự gõ đã bỏ nhận dạng, có consent riêng. Chưa bảo đảm nhận diện được mọi dữ liệu riêng tư bằng regex. |
| Thử nghiệm tự nguyện | `docs/regional/STUDENT-PILOT.md`, feedback/matrix trống. | NOT TESTED: không có người tham gia, điểm trước/sau hoặc nhận xét thật; không tạo dữ liệu hoặc chữ ký thay người học. |
| Khác biệt sản phẩm | Gia sư theo tiến trình, trích nguồn, hoạt động học/đề xuất được giải thích. | Có phạm vi triển khai; PARTIAL chứng cứ hiệu quả. Không khẳng định vượt YouLearn/NotebookLM/Khanmigo khi chưa benchmark công bằng. |

## Thứ tự triển khai có giới hạn

1. Backend teacher credential/org/ownership và source snapshot là điều kiện bắt buộc, trước AI transport. Chống lẫn tài khoản, nguồn thay đổi và credential bị thu hồi.
2. Generation riêng phía server dùng AI Router, lease, credit ledger và telemetry đang có; kết quả luôn là **draft**, không tự publish/assign. Consent minh bạch; không nhận student records hoặc client-supplied proof.
3. QA độc lập: schema/size, exactly-one-answer, options trùng hoặc tương đương số, đáp án/explanation có mâu thuẫn chứng minh được, nguồn exact/server-only, một số kiểm Toán hỗ trợ. Không đủ căn cứ phải giữ `review-required`, không tự gọi “đã đúng”.
4. Khi lưu/đưa vào bài giao, backend chạy lại QA trên nội dung hiện thời và kiểm xác nhận review của giáo viên. Chặn nội dung sai có bằng chứng; nội dung chưa kiểm ngữ nghĩa không tự được chứng nhận.
5. Test adverse outputs, refund/cancel, cross-org, mất phiên/thu hồi và chỉnh nguồn trong lúc AI chạy. Fixture dùng để kiểm logic, không thay phép thử provider/public. Sau cùng mới cân nhắc smoke thật giới hạn do root chạy.

## Cửa nghiệm thu cho AI giáo viên mới

Trước khi có report mới, nội dung dưới đây đều **NOT TESTED**: generation provider thật; chất lượng ngữ nghĩa giáo án/quiz/feedback; vận hành public; giáo viên thật sử dụng; hiệu quả học sinh. Báo cáo test mới phải ghi loại transport, phiên/SQLite thật hay tổng hợp, số request provider thực và giới hạn. Không công bố số test như tỷ lệ AI chính xác.

Các bằng chứng baseline nằm ở `docs/regional`, `docs/v3`; audit này không xóa các giới hạn trong đó. Giữ runtime đã nộp riêng cho tới khi chủ dự án cho triển khai bản mới; đợt này không tự deploy, upload hoặc nộp lại cổng.

## Kiểm tra mới sau thay đổi AI giáo viên

- `content-qa-report.json`: **38 PASS**, kiểm tra xác định với nội dung tự soạn và đầu ra đối kháng; **0 request provider thật**. Bao gồm đáp án sai, nhiều/không có đáp án đúng, lựa chọn số tương đương, phép tính sai được hỗ trợ, nội dung gây hại, source/paragraph/page/time giả, consent/minimization, UUID hợp lệ và client cố giả `teachingContext` server-only. Không phải 38 bài AI thật trả đúng.
- `content-api-report.json`: **24 PASS**, handler Request/Response và ledger/guard/source assertion **SQLite thật trong DB riêng**, nhưng OAuth session và **16 lần transport provider đều là fixture**; **0 request provider thật**. Clock DB tiến giữa các case để tách hạn mức phút; không là phép đo tải thời gian thật. Bao gồm cross-org/student, nguồn thay đổi trong khi chờ, thu hồi credential/phiên, tắt AI, hủy request, refund, chống tính credit hai lần khi retry và không tự lưu/duyệt/xuất bản.
- Kiểm tra độc lập assertion nguồn diễn ra ngay trong transaction settlement thật; không mock hook này. Lỗi nested-BEGIN trước tích hợp đã được sửa ở backend. Kết quả lỗi không để dư credit đang giữ.
- TypeScript toàn dự án đã chạy đạt ở thời điểm tích hợp. Chưa có kết quả build/deploy/public mới hoặc provider thật cho Teacher Workspace trong hai report này. Kết quả backend/browser khác phải đọc report riêng, không cộng chạy lặp thành số người dùng hoặc độ chính xác.
- Kiểm Toán chỉ áp dụng câu literal trong grammar hữu hạn và một số đẳng thức số tường minh. Câu văn dài, giải thích ngữ nghĩa, toàn bộ giáo án, hình học và loại bài ngoài grammar vẫn cần review; không gắn cờ “đã kiểm mọi bước”. PII/safety regex là hàng rào bổ sung, không là công cụ ẩn danh hoặc phân loại độ tuổi hoàn chỉnh.

Đánh giá bảo mật đọc mã và các giới hạn dung lượng/retry nằm ở `SECURITY-REVIEW.md`. Finding dung lượng đã được giảm thiểu bằng ngân sách UTF-8 trong transaction (2 MiB active content, 256 KiB communication, 8 MiB tổng workspace content/snapshot/submission), nhưng chưa là pagination/load test/hosting bền vững. Không dùng PASS của logic fixture để tuyên bố đã có giáo viên thật, official identity verification hoặc kết quả học sinh.

## Bổ sung bằng chứng sau audit ban đầu

`production-http-report.json` ghi 8 case trên compiled local Next/HTTP/SQLite thật (session tổng hợp,0 provider), bao phủ bốn giai đoạn và restore DB sang file riêng. `real-provider-report.json`/`real-provider-output.json` ghi **2 request provider thật HTTP200** trên compiled local server với synthetic owner/bài tự soạn: lesson còn mixed references/math not-checked, hai MCQ có exact excerpts/math not-checked; cả hai review-required. Đây không thay chấm chuyên môn, public OAuth, người học thật hoặc kiểm thành công bản sửa ngôn ngữ được thêm sau đó. UI report mới nhất có52 browser +32 SSR/pure với HTTP tổng hợp. [ACCEPTANCE.md](ACCEPTANCE.md) phân biệt các bằng chứng mới này với report validator/API chỉ dùng fixture phía trên; không cộng chúng thành tỷ lệ AI đúng.
