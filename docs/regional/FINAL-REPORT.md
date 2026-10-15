# Lumio AI26A0048 - Báo cáo nâng cấp V2 + V3

Web: 3.1.0-regional.1 | Flutter source: 0.4.0+4 | 15/10/2026 | Bản chốt theo trạng thái đã cung cấp.

Đọc cùng PDF và JSON kiểm thử trong thư mục minh chứng. Các số QA không phải kết quả học sinh.


## 01 / Phạm vi và trạng thái

BÁO CÁO NÂNG CẤPV2 + V3

LUMIO AI · AI No Name · AI26A0048

Web 3.1.0-regional.1 | Flutter source 0.4.0+4 | 15/10/2026

Runtime commit: 6eabc3219f9298676bdd29ae0ee15a91b9593288

Bản chốt theo bằng chứng đã cung cấp

Nâng cấp trên sản phẩm hiện có: AI thật, gia sư giúp người học suy nghĩ, nguồn kiểm chứng được, dữ liệu có quyền lựa chọn và kiểm tra có thể tái hiện. Giữ toàn bộ luồng V2 khi bổ sung V3; không dùng số test để tuyên bố phần trăm hoàn thiện.

| Giai đoạn | Trạng thái | Bằng chứng / giới hạn |

| --- | --- | --- |

| 1. V2 public | PASS | Google OAuth +4 lượt gia sư +1 bản đọc; đúng commit V2, không suy thành V3. |

| 2. Mã V3 | PARTIAL | RAG, Toán chính xác có giới hạn, kỹ năng, sync, queue và vận hành; phạm vi từng nhóm bên dưới. |

| 3. V3 public | PASS | Public3.1: Google OAuth và4 lượt tutor thật; khóa lời giải tới3 gợi ý, sửa lỗi x=6, lời giải x=5. Xác minh độc lập nghiệm/điều kiện/đủ nghiệm trong phạm vi hỗ trợ; bước biến đổi chỉ kiểm tra một phần. Public3.0 đã thử riêng PDF và hybrid RAG trên2 nguồn tự soạn. Chưa là đánh giá toàn diện hoặc kết quả học sinh. |

| 4. Nộp cuối | NOT TESTED | Chưa nộp. Chỉ gửi một lần sau khi hoàn tất V2, V3 và phần giáo viên theo yêu cầu. |

| Hạng mục V3 | Trạng thái tổng thể | Giới hạn chính |

| --- | --- | --- |

| RAG và nguồn | PARTIAL | Đã có kiểm tra; corpus nhỏ và không bảo đảm mọi kết luận đúng. |

| Toán / kỹ năng | PARTIAL | Parser và taxonomy hữu hạn; chưa chấm chuyên môn/pilot. |

| Sync / queue / hosting | PARTIAL | Một DB/host; free disk tạm, chưa thử hai điện thoại thật. |

| Hồ sơ giáo viên | PASS | Tự khai +admin xét duyệt; không chứng nhận nghề nghiệp hoặc mở toàn bộ classroom. |

| Học sinh / thu tiền | NOT TESTED | Không tạo người tham gia, kết quả học hoặc giao dịch giả. |

PASS = đã làm và có bằng chứng trong phạm vi nêu. PARTIAL = còn giới hạn. BLOCKED = thiếu điều kiện. NOT TESTED = chưa có bằng chứng. Ảnh UI tổng hợp khác AI thật và khác thử nghiệm học sinh.


## 02 / Hiện trạng, nguyên nhân và cách nâng cấp

1. Hiện trạng trước nâng cấp

Next.js/React/TypeScript + API Node 24 + SQLite; dữ liệu học local IndexedDB/localStorage. Có Flutter/Dart và Windows/Electron cũ. Đợt khu vực mở rộng từng module, không đổi sang dịch vụ cloud trả phí hoặc viết lại nền tảng.

| Vấn đề được kiểm tra | Nguyên nhân gốc và thay đổi |

| --- | --- |

| Public không chạy AI | Chế độ demo tắt AI/máy chủ. Tách competition preview; key và quyền sử dụng chỉ ở server; kiểm tra chính URL triển khai. |

| Đổi full có đáp án sớm | Client mode/history không đủ tin cậy. Server giữ bài, hội thoại và số gợi ý thực chất; mở sau ít nhất 3 gợi ý hợp lệ. |

| Nguồn khó đối chiếu | Metadata chưa đủ. Tách trang/đoạn/slide thật, trích nguyên văn, proof gắn nội dung/chủ sở hữu; không tin vị trí model tự nêu. |

| Đề xuất chưa phản ánh học | Điểm tổng/thích không chứng minh năng lực. V2 lưu từng câu; V3 giữ snapshot kỹ năng, độ khó, lần chọn đầu, ngày và trùng lặp. |

| Mất trạng thái / tác vụ dài | V3 thêm opt-in snapshot sync, CAS/outbox, queue checkpoint/fencing và hạn mức SQLite cùng DB; không hứa tính bền vững của free disk. |

2. Quy trình giữ khả năng kiểm chứng

Audit toàn dự án trước sửa; ưu tiên AI/auth/credit/tutor, rồi nguồn/Toán, cá nhân hóa/privacy và hồi quy. V2 đã được kiểm tra public riêng; V3 kế thừa và có test riêng trước lần nộp cuối.

Căn cứ: docs/regional/01-INITIAL-AUDIT.md; docs/v3/00-HANDOFF.md; từng report JSON/log. Những giới hạn ban đầu trong audit là lịch sử, không phải mô tả mã hiện hành.


## 03 / Gia sư và kiểm tra Toán

3. Gia sư giữ quyền kiểm soát ở máy chủ

24 kiểm tra quy tắc/phiên và 33 UI đã ghi. Phiên thuộc tài khoản/bài, lịch sử canonical, đổi nguồn tạo ngữ cảnh mới; lỗi/rỗng/lặp không được cộng gợi ý. Mở full được kiểm tra phía server; không dựa vào bộ đếm frontend.

Mặc định hướng dẫn một ý và hỏi lại; hội thoại AI thật vẫn có lượt nêu hơn một thao tác. Vì vậy chất lượng sư phạm được ghi PARTIAL thay vì gọi mọi lượt hoàn hảo.

4. Đánh giá AI thật đã lưu

10 kịch bản có 10 đường đi được chấp nhận qua các run/recheck được chọn (46 request dịch vụ theo report). Không phải một lần chạy sạch 10/10: run cuối từng có 9 đạt/1 bị chặn nhầm an toàn, sau đó sửa và kiểm tra tập trung. Chín lời giải số được đối chiếu, bài thiếu dữ kiện giữ khóa.

| # | Tình huống | Đường đi kỹ thuật | Sư phạm |

| --- | --- | --- | --- |

| 1 | Bậc nhất | PASS | PARTIAL |

| 2 | Phân thức / điều kiện | PASS | PARTIAL |

| 3 | Căn / nghiệm ngoại lai | PASS | PASS |

| 4 | Đúng từ đầu | PASS | PASS |

| 5 | Sai bước đầu | PASS | PARTIAL |

| 6 | Sai lặp | PASS | PASS |

| 7 | Đòi đáp án | PASS | PARTIAL |

| 8 | Mở full sớm | PASS | PARTIAL |

| 9 | Thiếu dữ kiện | PASS | PARTIAL |

| 10 | Thế nghiệm / nguồn | PASS | PASS |

5. Math Verification V3

25 kiểm tra độc lập: phân số BigInt, điều kiện gốc, thay nghiệm, tập nghiệm hữu tỉ bậc≤2 và một số bước/phép tính tường minh. Ngoài phạm vi hiển thị chưa xác minh; nghiệm cuối đúng không chứng nhận toàn bộ chứng minh văn xuôi, hình học hoặc nhiều biến.

Bằng chứng: tutor-evaluation-reviewed.json; docs/v3/02-MATH-VERIFICATION.md. Harness local dùng danh tính tổng hợp, không phải OAuth thật hoặc học sinh thật.

Public V3.1 đúng commit 6eabc32: 4 lượt tutor thật, khóa 0→1→2→3; sửa phép tính 15/3 khi người học cố ý trả x=6, rồi full x=5. Verifier chứng minh ứng viên/điều kiện/đủ nghiệm trong phạm vi; bước chỉ kiểm một phần, phép tính hiển thị chưa kiểm. Sư phạm/trình bày vẫn PARTIAL.


## 04 / Học liệu, RAG và nguồn đối chiếu

6. Nguồn đơn được giữ; RAG là lựa chọn bổ sung

• V2: PDF text layer có trang thật, DOCX mục/đoạn, PPTX thứ tự slide; quote phải khớp đoạn gốc. Vị trí ký HMAC gắn tài khoản và nội dung, model không tự cấp trang/time. Scan/OCR và Office math không hỗ trợ phải báo rõ.

• V3: chỉ mục theo tài khoản/workspace, BM25; semantic embedding cần đồng ý riêng, mặc định tắt. Hybrid dùng RRF trên corpus SQLite có giới hạn. Snapshot cố định qua gợi ý, sửa/xóa nguồn làm snapshot cũ hết hiệu lực; không có bằng chứng thì không gọi model.

• Tối đa 5 tài liệu / 250k UTF-16 units / 300 chunks mỗi tài khoản, mỗi tài liệu100k; retention bảy ngày. Đây không là vector DB production hoặc khả năng đọc mọi file/video.

Hình 1. Public V3.0: trích nguyên văn PDF trang2 trong hai nguồn đã lập chỉ mục. Ảnh Render thực, commit28fbcdc; bài tự soạn, không phải học sinh thật.

7. Kiểm tra truy xuất, không suy ra độ đúng câu trả lời

Nguồn V2: 20 grounding, 7 HTTP, 16 UI. RAG: 23 core, 21 API, 23 UI và 7 nhóm quyết toán.

Retrieval thật: 2 request embedding, corpus tự soạn 6 chunk / 7 câu hỏi. Keyword recall@3/MRR@3 0.833/0.833; hybrid 1.000/1.000. Mẫu nhỏ, ngưỡng heuristic, không phải benchmark trường học hoặc generated-answer accuracy.

Public V3.0 (report riêng): Google OAuth, Linux trích PDF2 trang/482 ký tự, hybrid trả6 đoạn từ2 nguồn;4 lượt tutor qua khóa0→3 rồi full x=5. Parser không hỗ trợ đề có văn xuôi nên hiện chưa kiểm chứng; lời giải được đối chiếu tay. Không suy kết quả3.0 thành3.1 hoặc hiệu quả học sinh.

Chi tiết: docs/RAG-V3.md; docs/regional/rag-live-evaluation.json; docs/v3/public-v3-live-check.json. Trích dẫn khớp chữ chưa đủ chứng minh kết luận đúng.


## 05 / Bằng chứng kỹ năng và đề xuất

8. Quan sát được và suy ra được tách riêng

V3 lưu snapshot tại lúc hoàn thành quiz: kỹ năng/chủ đề và độ khó khai báo, thời điểm, lần chọn đầu quan sát được trong app, chống đếm trùng cùng câu. Attempt cũ chỉ là lịch sử quan sát; không tự gán lại kỹ năng hoặc kết luận học không có hỗ trợ.

Hình 2. Graph bảy kỹ năng với quan hệ tiên quyết khai báo rõ, chọn nhánh để xem. Ảnh giao diện thật; dữ liệu QA tổng hợp, không phải học sinh thật.

Không gọi một câu đúng là thành thạo. Nhãn mô tả dùng số câu khác nhau, ngày/giãn cách, ít nhất hai mức độ khó và khoảng bất định mô tả; ngưỡng tạm chưa hiệu chuẩn. Lượt thích, streak, thời gian và nhấp không được dùng làm năng lực.

Hình 3. Bằng chứng, khoảng bất định và lý do gợi ý; cho tắt/xóa metadata kỹ năng. Ảnh giao diện thật; dữ liệu QA tổng hợp, không phải học sinh thật.

39 unit +43 UI có bằng chứng: dữ liệu cũ, chống trùng, giảm lỗi, prereq, tắt/xóa/reload,5 ngôn ngữ và khung điện thoại. Đề xuất chỉ lấy học liệu thật trong thư viện; graph chỉ bao phủ 7 kỹ năng Toán nền tảng. Hiệu quả trên học sinh: NOT TESTED.


## 06 / Đồng bộ, Flutter và tác vụ dài

9. Web snapshot sync có lựa chọn

Opt-in, account/session binding, epoch/revision/CAS, receipt idempotent, merge ba phía và outbox. ACK mất thử lại cùng ID/body; reset/xung đột dừng để chọn; response account cũ không được apply. 14 HTTP thực SQLite và 17 fault checks đã ghi; đây chưa phải hai điện thoại thật.

| Dữ liệu / thao tác | Phạm vi và giới hạn |

| --- | --- |

| Web snapshot | ≤2 MiB / 100 items, learning/preferences và metadata; không PDF/ảnh/audio/video gốc, live timer hoặc chuông tự chọn. Xóa server giữ local; tắt không tự xóa bản đã gửi. |

| Flutter source 0.4.0+4 | Bản Web JSON riêng, giữ metadata và chỉ sửa ghi chú; thư viện native vẫn tách riêng. Bearer + X-Lumio-User; file/outbox theo origin/account, generation guards. |

| Kiểm tra mobile | Analyze 0 lỗi; 71/71 Flutter tests (19 core/API/file +2 widget mới). HTTP mock, không backend/device E2E; chưa build APK/IPA mới, chưa Android/iOS thật. |

10. Queue tóm tắt có checkpoint

23 kiểm tra SQLite: input bất biến, checkpoint từng part, tối đa 3 lần dispatch/part, backoff, lease/fencing, hủy/thu hồi phiên và quyết toán nguyên tử với credit. Part lỗi được refund; cancel không thu hồi dữ liệu provider đã nhận.

Text≤120k chia tối đa 12 parts; YouTube≤2 giờ theo thời lượng người dùng khai báo, không chứng minh toàn bộ video gốc đã được đọc. Không nhận media blob trong queue; luồng foreground12 giờ vẫn riêng. Free 200 credit có thể không đủ task dài, queue dừng trước yêu cầu không đủ tiền.

Worker chạy khi host ấm, phục hồi qua truy cập chủ sở hữu; không phải daemon luôn chạy. Cùng SQLite file mới phối hợp được nhiều process. Nếu free disk reset, queue/snapshot có thể mất. Bản sao local không mã hóa nội dung học ở cấp app; token mobile nằm secure storage riêng.


## 07 / Dữ liệu, dịch vụ bên ngoài và an toàn

11. Người học biết và điều khiển dữ liệu gửi đi

| Loại dữ liệu | Lưu / gửi / xóa và giới hạn |

| --- | --- |

| Thư viện / kỹ năng / đề xuất | Local theo thiết bị/tài khoản; xuất JSON, tắt cá nhân hóa, xóa phản hồi hoặc metadata kỹ năng riêng. Chưa đo năng lực thật hoặc chẩn đoán tâm lý. |

| Đăng nhập / credit | Máy chủ giữ danh tính chuẩn, quyền, ledger. Không tin admin flag, số dư hoặc principal từ body. OAuth không đồng nghĩa tự đồng bộ thư viện. |

| Hồ sơ giáo viên | Tên/quốc gia/địa phương/trường/cấp/môn tự khai và hai đồng ý; email công việc/link chứng cứ tùy chọn. Chỉ owner/admin được đọc; không tự fetch link. Không là xác minh chính thức, không áp TTL tutor sang hồ sơ. |

| Phiên gia sư | Đề≤4.000 ký tự, tối đa 100 lượt và source digest; hết hiệu lực 7 ngày, dọn khi truy cập; xóa phiên chính chủ. Không giữ media gốc trong bảng phiên. |

| Sync tự chọn | Snapshot JSON không gồm file gốc, tối đa 7 ngày từ lần ghi; có xóa server riêng, local giữ lại. Free host có thể reset trước hạn. |

| RAG tự chọn | Text/chunk/vector và snapshot theo tài khoản, tối đa 7 ngày. Đồng ý riêng trước gửi text/query để embedding OpenAI. Xóa chỉ mục không bảo đảm xóa forensic/backup/provider. |

| Queue tự chọn | Input text/YouTubeURL và kết quả part tối đa 7 ngày từ tạo; retry không gia hạn. Dọn qua truy cập/worker, không hứa tác vụ dọn luôn chạy đúng wall-clock. |

| Yêu cầu AI | Câu hỏi, phần nguồn cần thiết, hội thoại và ảnh/PDF/audio/video/URL theo chức năng qua server đến OpenAI/Gemini/xAI. Notice cạnh send; không gửi cả thư viện/likes để chạy tutor. |

| Log / nhà cung cấp | Vận hành giữ metadata, mã lỗi/usage/credit, không chủ đích log toàn prompt/học liệu. Không hứa thay provider về lưu giữ/huấn luyện/xóa dữ liệu họ đã nhận. |

API key chỉ ở server; auth/origin/SSRF/file bounds/quota/credit trước transport. Nội dung học liệu không có quyền thay quy tắc hệ thống. Sync/index/job requests không được tự cấp role, kết quả hoặc credit. Có /privacy và /data-deletion; xóa tài khoản/consent production toàn diện còn PARTIAL.

Minh chứng công khai chỉ chứa tên dự án/đội và dữ liệu QA tự soạn; không kèm ngày sinh, điện thoại, địa chỉ, email cá nhân, token, DB hoặc màn hình admin OAuth.


## 08 / Kết quả kiểm thử và cửa nghiệm thu cuối

12. Kiểm tra theo từng nhóm

| Nhóm | Trạng thái | Số mục | Loại bằng chứng |

| --- | --- | --- | --- |

| V2 nguồn | PASS | 20 grounding / 7 HTTP / 16 UI | Fixture file/SQLite; không teacher accuracy |

| V2 gia sư | PASS | 24 logic / 33 UI | Canonical fixture, transport chặn |

| V2 đề xuất/giá | PASS | 23 logic / 40 UI | Tổng hợp, không giao dịch |

| RAG V3 | PASS | 23 core / 21 API / 23 UI | SQLite+fixture transport |

| Math exact | PASS | 25 | CPU độc lập; parser giới hạn |

| Learning V3 | PASS | 39 unit / 43 UI | Synthetic; không học sinh |

| Sync V3 | PASS | 14 HTTP / 17 faults | SQLite thật; không hai thiết bị |

| Queue / ledger | PASS | 23 jobs / 7 nhóm credit | SQLite thật; provider fixture |

| Flutter source | PASS | 71 tests; analyze 0 lỗi | Không APK/hardware mới |

| Giáo viên | PASS | 27 API / 31 admin / 43 self | Tổng hợp; không hồ sơ giáo viên thật |

| Danh mục địa phương | PASS | 9 | Data pin/hash/license; không xác minh danh tính |

13. Chốt đúng commit, không cộng chạy lặp

| Kiểm tra cuối | Trạng thái | Report root cung cấp |

| --- | --- | --- |

| TypeScript | PASS | Bản source staging sạch: tsc --noEmit hoàn tất, mã thoát0. |

| Production build | PASS | Build Next production thành công. 15 kiểm tra HTTP từ mã đã biên dịch đạt, gồm worker tài liệu và API hồ sơ giáo viên. Dùng phiên tổng hợp/SQLite riêng, không gọi AI trong nhóm này. |

| Dependency audit | PASS | pnpm audit --prod không ghi nhận lỗ hổng ở mọi mức được báo. Quét source không có khóa đã cấu hình hoặc tệp riêng tư. |

| Hồi quy tổng | PASS | 600/600. 600 kiểm tra trong bộ mặc định; đây không phải số người dùng hoặc tỷ lệ AI đúng. Riêng UI giáo viên: admin31 +3SSR, biểu mẫu43 +4SSR. Danh mục địa phương9 nằm trong600. |

| V3 AI public | PASS | Public3.1: Google OAuth và4 lượt tutor thật; khóa lời giải tới3 gợi ý, sửa lỗi x=6, lời giải x=5. Xác minh độc lập nghiệm/điều kiện/đủ nghiệm trong phạm vi hỗ trợ; bước biến đổi chỉ kiểm tra một phần. Public3.0 đã thử riêng PDF và hybrid RAG trên2 nguồn tự soạn. Chưa là đánh giá toàn diện hoặc kết quả học sinh. |

Các suite có phần giao nhau; không cộng thành số test độc lập toàn dự án. Hồi quy tổng chỉ lấy manifest/run cuối. PASS local không thay public; browser media play state không chứng minh loa/micro/Zoom vật lý. Dữ liệu tổng hợp không trở thành người tham gia.


## 09 / Độ chính xác AI và thử nghiệm học sinh

14. Đánh giá chất lượng có giới hạn

| Phép thử | Kết quả / điều không được suy ra |

| --- | --- |

| Gia sư AI thật | 10 kịch bản có đường đi được ghi qua run/recheck; sư phạm PARTIAL. Giữ cả lỗi và sửa, không báo một run10/10 sạch. |

| Toán độc lập | V2 kiểm tra số; V3 thêm exact hữu tỉ và scope theo bước. Câu đúng cuối không xác nhận văn xuôi, hình học hoặc dạng ngoài parser. |

| Summary/quiz/card/vision | 6 request thật theo report nội dung. Dùng bài tự soạn/ảnh tổng hợp; cần review ngữ nghĩa, vị trí đáp án quiz còn hạn chế. |

| Nguồn / retrieval | Quote nguyên văn +truy xuất corpus nhỏ được đo riêng. Không biến recall@3 thành độ đúng câu trả lời hoặc hiệu quả học. |

| Năng lực người học | Chỉ mô tả bằng chứng; ngưỡng heuristic chưa hiệu chuẩn. Không công bố mastery thật, điểm chuẩn hoặc hiệu quả giáo dục độc lập. |

15. Thử nghiệm học sinh: NOT TESTED

Chưa có học sinh tự nguyện tham gia hoặc điểm trước/sau đã thu và chấm. STUDENT-PILOT.md, PILOT-FEEDBACK.md, pilot-metrics.csv trống đã sẵn sàng; không tạo người dùng, chữ ký hoặc nhận xét giả.

• Mã giả danh, đồng ý phù hợp với lứa tuổi; lựa chọn chụp/quay riêng; không công khai mặt/giọng/thông tin riêng.

• Đo trước/sau và bài tương tự, khả năng giải thích, chất lượng gợi ý/nguồn/tóm tắt/quiz và gợi ý học. Công bố mẫu số thực, thiếu dữ liệu không xem là 0.

• Nhóm nhỏ tự nguyện chỉ là quan sát thăm dò; thời gian dùng/lượt mở/cảm nhận không chứng minh nhân quả.

Định vị: học từ tài liệu của mình, gia sư từng bước, nguồn đối chiếu và ôn theo hoạt động. Không tự nhận duy nhất/tốt hơn YouLearn, NotebookLM, Khanmigo khi chưa benchmark công bằng. Nguồn và giới hạn so sánh trong PRODUCT-POSITIONING.md.


## 10 / Hồ sơ giáo viên, gói và credit

16. Đăng ký và xét duyệt hồ sơ giáo viên

Trạng thái PASS. Hồ sơ gồm tên tự khai, quốc gia/vùng lãnh thổ, tỉnh/thành, xã/phường, trường, cấp và môn dạy. Danh mục 249 mã quốc gia tĩnh; Việt Nam lazy-load snapshot 34 tỉnh / 3.321 xã có phiên bản, hash và MIT. Giá trị địa phương vẫn là bản khai.

Gửi hồ sơ không tự cấp quyền. Owner theo dõi pending/approved/rejected/revoked; admin duyệt/từ chối/thu hồi bằng revision và ghi lý do. Credential luôn identityVerified:false, basis manual-review-of-declaration; chưa có roster, giao bài hoặc đọc dữ liệu học sinh.

Hình 4. Public V3.1: form chọn quốc gia/tỉnh/xã; tên đã xóa, chưa gửi hồ sơ. Ảnh Render thực, commit6eabc32; không xác minh danh tính/công tác.

Hình 5. Public V3.1: admin tải danh sách thật, hiện không có hồ sơ đang chờ. Không tạo hoặc phê duyệt hồ sơ giáo viên thật.

17. Giá đề xuất - chưa thu tiền

| Gói | Tháng (đ) | Năm (đ) | Credit dự kiến |

| --- | --- | --- | --- |

| Free | 0 | 0 | 200 dùng thử một lần |

| Plus | 59.000 | 590.000 | 600/tháng |

| Premium | 129.000 | 1.290.000 | 1.600/tháng |

| Pro | 249.000 | 2.490.000 | 3.500/tháng |

Packs minh họa: 25.000 đ/250; 59.000 đ/700; 119.000 đ/1.600. Năm bằng 10 tháng, dự kiến cấp từng tháng. Checkout khóa; không giao dịch, nạp tự động, invoice hoặc gia hạn giả. Free 200 một lần khác hạn mức chống lạm dụng200 yêu cầu/ngày của bản thi.

Server kiểm tra entitlement/quota/credit trước Router; reserve, settle hoặc refund và grouped settlement bảo vệ RAG/chat. Client không tự cấp quyền hoặc né giới hạn. Có test transaction/failure, chưa webhook/đối soát/GooglePlayBilling/AppleIAP.

Giá chưa được kiểm chứng lợi nhuận/khả năng chi trả; API có thể phát sinh phí nhà cung cấp kể cả retry. Không hứa thu nhập, khấu trừ đúng mọi invoice hoặc hoàn phí từ provider. Chi tiết: PRICING-PROPOSAL.md.


## 11 / Cấu hình, triển khai và giới hạn còn lại

18. Cách mở và môi trường

Web: Node 24, pnpm 11.25.0. Mở thư mục có package.json; pnpm install --frozen-lockfile; copy .env.example thành .env.local riêng; pnpm dev. Chốt: pnpm typecheck, pnpm test, pnpm build; chạy node scripts/start-regional.cjs. Đọc README/HUONG-DAN/AI-SETUP.

Server env: NEXTAUTH_URL/SECRET, OAuth Google/Facebook, LUMIO_AI_ENABLED, OPENAI_API_KEY/GEMINI_API_KEY/XAI_API_KEY và model hỗ trợ. Bản thi LUMIO_COMPETITION_PREVIEW; không để LUMIO_PUBLIC_DEMO UI-only nếu cần AI. Embedding mặc định tắt; queue có maintenance flag. Không NEXT_PUBLIC_ cho secret.

Flutter: mở lumio-mobile có pubspec.yaml, flutter pub get/analyze/test/run với SDK/Android toolchain. APK 0.3 và Windows cũ không tự nhận source mới; iOS cần macOS/signing, chưa build mới.

| Liên kết | Trạng thái | URL / ghi chú |

| --- | --- | --- |

| Web V3 | PASS | https://lumio-ai-demo.onrender.com/<br>Render Live:3.1.0-regional.1, health200; runtime6eabc3219f9298676bdd29ae0ee15a91b9593288, deployment dep-db889c689jmc73ck1i70. Hosting vẫn Free; Auto-Deploy tắt để tránh reset khi chỉ bổ sung tài liệu. |

| GitHub | PASS | https://github.com/nguyenbedetran-sketch/lumio-ai-regional-2026<br>Source công khai V3.1; runtime đã kiểm tra6eabc3219f9298676bdd29ae0ee15a91b9593288. HEAD có thể bổ sung tài liệu sau runtime. Không công khai lịch sử riêng, env hoặc cơ sở dữ liệu. |

| Drive minh chứng | PARTIAL | https://drive.google.com/drive/folders/1ARB9KHRNnAiHRMd_FH8tHLY4C8dlWbzG<br>Đã tạo đúng thư mục minh chứng và tải3 ảnh public; metadata xác nhận đúng thư mục và quyền ai có liên kết được xem. Đang hoàn tất PDF, source và gói minh chứng. |

| Nộp cuối | NOT TESTED | https://ai.tainangviet.vn/dashboard/regional<br>Chưa nộp. Chỉ gửi một lần sau khi hoàn tất V2, V3 và phần giáo viên theo yêu cầu. |

19. Lỗi / giới hạn còn lại

| Mức | Nội dung |

| --- | --- |

| Phạm vi | Render Free có thể ngủ hoặc đặt lại SQLite; chưa bật database production bền vững hoặc sao lưu ngoài host. |

| Chất lượng | Bộ xác minh Toán có giới hạn cú pháp. Trích dẫn khớp không chứng minh toàn bộ lập luận. Chưa có chấm độc lập của giáo viên hoặc pilot học sinh thật. |

| Phạm vi | Quyền giáo viên dựa trên duyệt bản tự khai. Module này chưa có lớp học, giao bài hoặc thống kê học sinh riêng tư. |

| Chưa thử | Chưa kiểm tra binary Android/iOS mới, thiết bị thật, Facebook public review, realtime voice hay phát hành store. Flutter0.4.0+4 là source. |

| Chủ động tắt | Giá Free/Plus/Premium/Pro là đề xuất. Checkout, kích hoạt gói trả phí và hoàn tiền thật đang tắt. |


## 12 / Mã nguồn, minh chứng và hướng tiếp theo

20. Tệp được thêm/sửa

Nhóm tệp dưới đây để truy xuất; commit/source manifest là danh sách chính xác. Không đọc hoặc đóng gói DB, .env, token hay dữ liệu đăng ký cá nhân.

• lib/tutor/*; lib/ai/*; lib/server/*; API auth/AI/tutor/ingest/rag/sync/summary-jobs

• lib/rag/*; lib/sync/*; lib/lumio/skill-*; recommendations/types/storage/study-tools

• components/lumio: RAGManager/SyncPanel/SummaryJobManager, tutor/skill/privacy/billing UI

• app privacy/data-deletion; styles; scripts/test-ui/start-regional/database-snapshot; tests/*

• package.json/pnpm-lock; .env.example; render-regional.yaml; README/HUONG-DAN/AI-SETUP

• lumio-mobile: core/web_sync*, core/api.dart, ui/web_sync.dart, settings, tutor compatibility

• lumio-mobile: test/web_sync*.dart; pubspec.yaml; README; source version0.4.0+4

• lib/teachers/*; migration11/store/API; self/admin UI; public/data versioned location/country licenses

21. Chỉ mục minh chứng

| Mục | Tệp trong gói minh chứng | Phân loại |

| --- | --- | --- |

| Hình 1 | 02_MinhChung_UI/Public-RAG-tutor-citation.jpg | PublicV3.0,28fbcdc; bài tự soạn |

| Hình 2 | 02_MinhChung_UI/qa-skills-map.png | Graph 7 kỹ năng; synthetic UI |

| Hình 3 | 02_MinhChung_UI/qa-skills-evidence.png | Bằng chứng/bất định; synthetic UI |

| Hình 4-5 | 02_MinhChung_UI/Public-V31-teacher-form.jpg; Public-V31-admin-teachers.jpg | PublicV3.1,6eabc32; không hồ sơ thật |

| Public V3.1 | 02_MinhChung_UI/Public-V31-math-verification.jpg | 4 lượt tutor thật; verifier có giới hạn |

| Bổ sung | 02_MinhChung_UI/qa-pricing-preview.png; qa-rag-tutor-mobile.png | Giá minh họa / viewport; không giao dịch/device |

| Public V2 | 03_KiemThu/V2/public-v2-live-check.json | OAuth/AI/playback thật V2 riêng |

JSON/log gốc lưu tên từng case, expected/actual và lỗi: docs/regional cho V2/RAG/content/live; docs/v3 cho learning, math, sync, queue, mobile. Không trích toàn chat, key, account ID hoặc màn hình admin OAuth vào báo cáo công khai.

22. Hướng cải tiến và trình tự nộp

• Chốt build/regression/audit đúng commit; deploy rồi kiểm tra public V3 và quyền mở GitHub/Drive trước lần nộp cuối. Giữ bằng chứng phiên bản nộp thực tế.

• Có giáo viên chấm bộ đề đa dạng, đánh giá từng ý có được nguồn hỗ trợ; pilot tự nguyện và báo mẫu số/giới hạn; hiệu chuẩn ngưỡng kỹ năng trước tuyên bố mastery.

• Sau cuộc thi: kiểm tra thiết bị, mở rộng native có migration an toàn, storage/backup bền vững, vận hành nhiều máy và thanh toán chỉ khi chủ dự án chốt điều kiện.

Báo cáo bao phủ12 mục phần17 của prompt: hiện trạng, nguyên nhân, tính năng, tệp, env, chạy/deploy, test, lỗi/mức độ, đúng AI, thử học sinh, dữ liệu và kế hoạch. Đây là báo cáo kỹ thuật, không phải biểu mẫu thông tin cá nhân.


PDF tương ứng: outputs/regional-evidence/LUMIO-V3-FINAL/01_BaoCao/AI26A0048-LUMIO-BAO-CAO-NANG-CAP.pdf. Kết quả/biểu mẫu: docs/regional/ và docs/v3/.
