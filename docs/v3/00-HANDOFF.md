# Lumio AI · Bàn giao V2 + V3

Ngày chốt bảng: **15/10/2026**. Đội **AI26A0048**. Source hiện tại: `3.0.0-regional.1`. Trạng thái này phân biệt mã đã kiểm thử, AI thật và bản đã triển khai; không phải xác nhận mọi yêu cầu production đã hoàn tất.

## Bốn giai đoạn

| Giai đoạn                                  | Trạng thái hiện tại                                       | Điều kiện / bằng chứng                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. V2: sửa nền tảng và xác minh bản public | **PASS trong phạm vi thử đã ghi**                         | Baseline `2aaadeaeac7448a7759811e10a69f5103f7fb7df`, tag `v2.0.1-regional-verified`. Render đã chạy Google OAuth thật, ba gợi ý rồi mở lời giải bằng bốn yêu cầu AI thật, và phát bản đọc âm thanh. Xem [public-v2-live-check.json](../regional/public-v2-live-check.json). Không suy ra độ đúng toàn bộ nội dung hoặc hiệu quả học tập. |
| 2. V3: bổ sung từng module trên V2         | **PARTIAL tổng thể; các kiểm tra giới hạn bên dưới PASS** | Đã có RAG, bộ kiểm tra Toán chính xác có giới hạn, bằng chứng kỹ năng, đồng bộ có lựa chọn, queue tóm tắt và vận hành SQLite. Không viết lại toàn hệ thống; giữ luồng học liệu đơn và chính sách ba gợi ý.                                                                                                                               |
| 3. Chốt release, deploy và kiểm tra lại V3 | **NOT TESTED trên bản public tại thời điểm ghi bảng**     | Root đang chốt toàn bộ regression/build/audit. Cần deploy đúng commit V3, kiểm tra health, Google OAuth, RAG/AI thật và luồng lưu/đọc lại. Kết quả V2 không tự trở thành bằng chứng V3.                                                                                                                                                  |
| 4. Hoàn thiện minh chứng và nộp bài        | **Chưa thực hiện lần nộp cuối**                           | Gộp source GitHub, báo cáo, ảnh/video từ sản phẩm và các giới hạn sau khi V3 được xác minh. Kiểm tra quyền truy cập liên kết rồi **nộp một lần cuối sau V2 + V3** theo chỉ đạo mới nhất. Không đưa DB, token, khóa hoặc học liệu riêng vào minh chứng.                                                                                   |

Website V2 đã kiểm tra: [lumio-ai-demo.onrender.com](https://lumio-ai-demo.onrender.com/). Repo public của baseline V2: [lumio-ai-regional-2026](https://github.com/nguyenbedetran-sketch/lumio-ai-regional-2026). Chỉ coi GitHub/Render là V3 sau khi commit mới và phép kiểm tra tương ứng được ghi lại.

## Kiến trúc được giữ lại và mở rộng

```text
Web / Flutter dùng cùng hợp đồng API
  → danh tính chuẩn + phiên hiện hành + kiểm tra origin/bearer
  → quyền sử dụng + hạn mức SQLite + giữ credit
  → nguồn đơn đã xử lý HOẶC snapshot RAG bất biến của tài khoản/workspace
  → AI Router phía máy chủ
  → kiểm tra schema, trích dẫn nguyên văn và Toán trong phạm vi hỗ trợ
  → một transaction: kết quả/tutor/checkpoint + quyết toán credit

Thư viện thiết bị → đồng bộ opt-in, epoch/revision/idempotency → SQLite
Tóm tắt dài → queue/checkpoint/lease có hàng rào phiên → cùng guard/router/ledger
```

API key chỉ ở máy chủ. Người dùng không gửi vai trò, số dư hoặc kết quả job để tự cấp quyền. Provider/model nằm trong router và telemetry admin; giao diện học tập hiển thị Lumio. Dữ liệu qua AI được thông báo trước thao tác; embedding và bản sao nguồn máy chủ cần đồng ý riêng.

SQLite dùng chung một tệp điều phối được nhiều process trên **cùng host**. Bản thi vẫn là một instance Render Free với ổ tạm; không phải kiến trúc nhiều máy, PostgreSQL hoặc dịch vụ vector production.

## Ma trận yêu cầu và kết quả

| Nhóm                            | Đã thực hiện và bằng chứng                                                                                                                                                                                                                                                  | Trạng thái / phần còn thiếu                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2: nguồn và ingestion          | PDF có trang thật, DOCX đoạn/heading, PPTX theo thứ tự presentation; HMAC gắn người dùng và nội dung. Grounding **20**, HTTP **7**, UI **16 PASS**. Compiled `next start` extraction **10 PASS** trong bộ release sạch với JWT tổng hợp.                                    | **PASS trong định dạng được hỗ trợ**. Ảnh scan/Office math không được giả thành văn bản đã đọc. Windows standalone gặp lỗi symlink riêng; không báo thành Linux proof.                                                                         |
| V2: gia sư                      | Khóa lời giải phía server, lịch sử chuẩn, nguồn thay đổi tạo bài mới, trích dẫn đối chiếu được. Tutor UI **33 PASS**; [đánh giá AI thật](../regional/tutor-evaluation-reviewed.json) lưu cả lỗi và kiểm tra lại. Bản public có thêm bốn lượt thật.                          | **PARTIAL về chất lượng sư phạm**. Bộ đề nhỏ, không phải một lần chạy sạch tuyệt đối; chưa có chấm độc lập hoặc học sinh thật.                                                                                                                 |
| A. RAG                          | Namespace tài khoản/workspace, BM25, embedding tùy chọn, hybrid RRF, snapshot bất biến qua gợi ý, không có bằng chứng thì không gọi model. Core **23**, API **21**, UI **23**, nhóm quyết toán **7 PASS**.                                                                  | **PARTIAL**. Năm tài liệu/250k UTF-16 units/300 chunks; TTL bảy ngày. Xung đột ngữ nghĩa rộng, generated-answer accuracy và RAG public V3 chưa được xác minh. [Chi tiết](../RAG-V3.md).                                                        |
| A/G. Đánh giá retrieval thật    | **Hai yêu cầu embedding thật**, corpus tự soạn sáu chunk/bảy truy vấn; keyword recall@3/MRR@3 `0.833/0.833`, hybrid `1.0/1.0`; lưu vector để replay offline. [Report](../regional/rag-live-evaluation.json).                                                                | **PARTIAL**, mẫu rất nhỏ. Không dùng chỉ số retrieval để tuyên bố độ đúng câu trả lời, thành tích học sinh hoặc quy mô trường học. Không tự chạy lại phép thử trả phí.                                                                         |
| B. Math Verification            | Phân số BigInt, điều kiện gốc, thay nghiệm, nghiệm hữu tỉ bậc ≤2, một số biến đổi tương đương và phép tính tường minh. **25 kiểm tra PASS**; metadata lưu/đọc lại từ tutor thật.                                                                                            | **PARTIAL**. Không chứng nhận toàn bộ lời giải văn xuôi, hình học, nhiều biến, nghiệm vô tỉ tổng quát hay toán siêu việt. Kết quả ngoài phạm vi hiện “chưa xác minh”. [Chi tiết](02-MATH-VERIFICATION.md).                                     |
| C. Learning Intelligence        | Graph bảy kỹ năng, snapshot lần chọn đầu, chống đếm trùng, độ khó khai báo, giãn cách/ngày, lý do gợi ý và opt-out/xóa thật. Unit **39**, UI **43 PASS**.                                                                                                                   | **PARTIAL**. Ngưỡng heuristic chưa hiệu chuẩn, không gọi một câu đúng là thành thạo. Chưa có pilot học sinh hay kết quả giáo dục độc lập. [Chi tiết](03-LEARNING-INTELLIGENCE.md).                                                             |
| D. Đồng bộ và mobile            | API web/bearer chung, account header, epoch/revision/CAS, receipt thử lại, merge ba phía, outbox và phục hồi lỗi. Có source Flutter/Dart; key AI không nằm trên thiết bị.                                                                                                   | **PARTIAL**. Unit/HTTP/client-fault fixture kiểm tra riêng; không đồng nhất với hai thiết bị thật hoặc sync public. Không tự đồng bộ nền khi bảng đã đóng. Android/iOS thật và phát hành store **NOT TESTED** trong V3.                        |
| E. Queue tác vụ dài             | SQLite checkpoint, retry có giới hạn, lease/fencing, hủy/thu hồi phiên, quyết toán nguyên tử, khôi phục part dở. **23 kiểm tra PASS** với provider transport được chặn bằng fixture.                                                                                        | **PARTIAL** về vận hành. Text ≤120k ký tự; queue YouTube ≤2 giờ theo thời lượng khai báo, không thay luồng foreground 12 giờ. Render ngủ/reset có thể mất queue; chưa có boot daemon/host-crash proof. [Chi tiết](04-BACKGROUND-SUMMARIES.md). |
| E. Vận hành                     | Migration 1–10, readiness không lộ bí mật, giới hạn dùng chung DB, telemetry metadata, `VACUUM INTO` backup/restore riêng. Rà soát operations có **9 kiểm tra PASS**, gồm thiếu bảng RAG và URL Unicode/cap sau chuẩn hóa.                                                  | **PARTIAL**. Cần release/build/health cuối. Chưa có load test toàn trường, giám sát ngoài host, backup bền vững ngoài Render hoặc disaster recovery thật. [Chi tiết](05-OPERATIONS-AND-SYNC.md).                                               |
| F. Billing/entitlement          | Guard phía server; reserve/settle/refund; nguồn RAG/session được kiểm tra trong transaction; chat và semantic query quyết toán cùng tutor. Không có quyền trả phí do client tự cấp.                                                                                         | **PARTIAL**. Thanh toán tiền thật/webhook/đối soát/Google Play Billing/App Store **BLOCKED do chưa chốt giá và nhà cung cấp**, không giả invoice hoặc thanh toán thành công.                                                                   |
| G/H. Đánh giá và quyền riêng tư | Report tách fixture UI, SQLite thật, AI thật và public. Summary/cards/quiz/vision đã gọi thật trong [sáu request có giới hạn](../regional/content-live-evaluation.json), kèm [review](../regional/CONTENT-REVIEW.md). Consent, không log prompt và cơ chế xóa được công bố. | **PARTIAL**. Trích dẫn đúng chữ không bảo đảm kết luận đúng. Còn hạn chế đa dạng vị trí đáp án quiz, kiểm định nội dung và kết quả học sinh. Không thay bài thử thật bằng ảnh mock.                                                            |

Không cộng số của các suite thành “số người dùng” hoặc phần trăm hoàn thiện. Báo cáo JSON/log gốc là bằng chứng chi tiết; con số ở bảng phản ánh lần chạy đã đọc tại ngày trên.

## Cách mở source và cấu hình

Mở thư mục có `package.json` trong VS Code; dùng **Node.js 24.x** và **pnpm 11.25.0**:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Mở `http://localhost:3000`. Điền cấu hình riêng trong `.env.local` theo [README](../../README.md); không gửi file này lên GitHub. Thiếu key thì thư viện local vẫn dùng được, AI không giả thành công. OAuth cần client và callback đúng origin; production dùng HTTPS.

Embedding mặc định tắt: `LUMIO_EMBEDDINGS_ENABLED=false`. Nếu chủ dự án bật, dùng key OpenAI hiện có phía server và model `text-embedding-3-small`/256 chiều; vẫn cần đồng ý trên UI và giữ hai credit mỗi lần index/query semantic. Đây là đơn vị sử dụng của app, không phải giá tiền đã công bố.

Queue có thể tắt bằng `LUMIO_BACKGROUND_JOBS_DISABLED=true`. Xem [hướng dẫn operations](05-OPERATIONS-AND-SYNC.md) trước khi đổi đường dẫn DB, backup hoặc rollback. Không chạy build cũ với migration history bị xóa thủ công.

## Cổng nghiệm thu cuối còn lại

1. Chốt regression/typecheck/audit/build của **đúng commit V3**, gồm các sửa whitelist ảnh, URL Unicode và readiness cuối.
2. Deploy đúng commit, lưu report public V3 mới; xác minh tài khoản/AI/RAG/nguồn/reload và trạng thái credit mà không lộ dữ liệu riêng.
3. Đóng gói báo cáo dễ đọc, source đã quét bí mật, ảnh/video được ghi đúng loại fixture/thật; không dùng bản Markdown cũ bị lỗi định dạng làm tài liệu chính.
4. Kiểm tra quyền mở GitHub/Drive, rồi nộp hai URL vào vòng khu vực và lưu xác nhận phiên bản nộp. Trước bước này không ghi “đã nộp”.

Pilot học sinh, thiết bị thật, hosting bền vững và thu tiền thật là các bước tiếp theo có điều kiện riêng; không được đánh dấu PASS chỉ vì đã có giao diện.
