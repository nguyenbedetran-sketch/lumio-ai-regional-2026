# V7 · Chuẩn bị kiểm tra provider thật có giới hạn

Trạng thái hiện tại: **baseline live đã chạy; bản sửa mới chờ follow-up có giới hạn**. Root đã chạy10 bài gia sư với39/40 provider HTTP attempts trong report gốc được giữ nguyên. Runner sau review đạt **24/24 kiểm tra offline**,0 provider thật trong các kiểm tra đó. Không tự đọc .env.local, deploy hoặc nộp bài.

## Tái sử dụng và phạm vi

scripts/evaluate-v7-live.cjs tiếp nối mẫu auth boundary, DB dùng một lần và giới hạn transport của evaluate-tutor.cjs/evaluate-content.cjs, đồng thời sửa hợp đồng account/UUID hiện tại. Runner gọi **handler app/api/ai/route.ts thật**; không viết lại AI Router, tutor, grounding, math hoặc ledger. Nó dùng10 bài trong lib/tutor/reference-problems.ts và nội dung5 ngôn ngữ trong tests/fixtures/v7-ai-evaluation.v1.json. Chỉ dữ liệu tự soạn, không có tên/bài nộp/hồ sơ của học sinh thật.

Auth principal tổng hợp được chèn tại ranh giới harness. Request/guard/route, source/tutor/math checks, quota, credit và SQLite tạm là mã thật. Đây không phải OAuth thật, public HTTP/Render, pilot học sinh hoặc đánh giá giáo viên độc lập. DB tạm được dọn khi kết thúc; không dùng hoặc sao chép DB ứng dụng.

## Chạy offline trước

Từ thư mục release-repo có package.json, dùng Node24 và dependency đã cài:

~~~powershell
node scripts/evaluate-v7-live.cjs --check
~~~

Hoặc chạy riêng node tests/v7-live-runner.cjs. Báo cáo docs/v7/reports/live-runner-check.json ghi rõ24 kiểm tra, HTTP intercept và0 provider thật. Kiểm tra gồm:

- Mode/cap/flag rõ ràng; --check không nhận --env-file và không dùng fetch thật mặc định.
- Chỉ nhập key/model OpenAI/Gemini; bỏ qua DB path, auth secret, NODE_OPTIONS và cấu hình khác trong file.
- Canonical account header + UUID trên mọi request, cả yêu cầu lời giải sớm.
- Chỉ hai origin/endpoint HTTPS thật đã cho phép; chặn username/password/query/redirect/host giả.
- Cap đếm cả lỗi mạng và fallback; dừng trước transport nếu ghi báo cáo thất bại.
- Các trường provider/model/status/latency/token được lấy từ response fixture; không ghi header/token.
- Handler/SQLite thật chạy3 gợi ý + full trên một bài tổng hợp; early full bị chặn không gọi provider.
- Credit thật của DB tạm được kiểm tra trước/sau; early-full không trừ credit, không còn giữ credit sau thành công/lỗi. Không tắt quota hoặc cấp ví thử nghiệm vô hạn.
- Dừng sau lỗi xác thực/rate-limit của provider, sau3 case lỗi liên tiếp hoặc hết cap; các case chưa bắt đầu là NOT_TESTED.
- Case thiếu dữ kiện kiểm tra trạng thái clarification/hintCount0/full409, vẫn chờ người đọc đánh giá nội dung. Case mục tiêu không liên quan dùng nguồn hợp lệ, nhận summary200 và không được gắn nhãn kiểm tra từ chối thiếu nguồn.
- Giữ raw output bị validator từ chối, tách semantic review, lọc credential trước khi ghi report.
- Chỉ tạo report V7 tên mới; không ghi đè file cũ hoặc đi ra thư mục reports.
- Full-response non200 được phân loại lỗi, trừ clarification409 được mong đợi; lỗi provider/cap ở full dừng đúng như ở hint. Full sai bị verifier loại có ghi lỗi và hoàn hold.
- Nghiệm đúng lặp lại được so dưới dạng tập số, không bị tính sai chỉ vì [4,4] khác [4]. Runner ghi SHA-256 của chính file chạy.

## Baseline live và đính chính kỹ thuật

Report gốc: [v7-live-tutor-acceptance-20261016.json](reports/v7-live-tutor-acceptance-20261016.json), SHA-256 **97aa3a8c215650e6abfbf618d3e23f9befde81521ccf3636e7979f43441da92a**.39 provider attempts thật,10 case tự soạn, auth boundary tổng hợp và DB dùng một lần; không phải public OAuth hoặc pilot học sinh.

Review chéo phát hiện hai lỗi phân loại trong evaluator cũ: full HTTP lỗi có thể chỉ thành PARTIAL/fail0; nghiệm lặp đúng có thể bị so nhầm bằng array. Đã sửa và thêm regression offline. Runner cũ không tự ghi hash file, nên không gán hash runner mới ngược cho lần phát sinh cũ.

[v7-live-tutor-technical-correction.json](reports/v7-live-tutor-technical-correction.json) đọc lại toàn bộ10 transcript gốc theo tiêu chí đã sửa:10 technical passes,0 thay đổi classification vì lượt gốc này không gặp hai lỗi evaluator đó. Đây **không phải lượt generation mới hoặc xác nhận lời giải/giọng hướng dẫn đúng toàn bộ**. Các vấn đề toán/sư phạm đã ghi trong [developer review độc lập](reports/v7-live-tutor-review.json) vẫn có giá trị và cần sửa/kiểm tiếp; không biến technical pass thành semantic pass.

Script chỉ đọc transcript và tạo report mới, không gọi handler/provider, không sửa raw source:

~~~powershell
node scripts/review-v7-live-technical.cjs --source=v7-live-tutor-acceptance-20261016.json --out=v7-live-tutor-technical-correction.json
~~~

Lệnh từ chối nếu đích đã có; dùng tên mới nếu cần tái review. Report ghi hash gốc, hash từng case, hash runner/script hiện hành, known issues và giới hạn. Không áp stop policy ngược để xóa bằng chứng case thực tế đã chạy.

## Live — chỉ root chạy sau source freeze

Cần truyền đường dẫn **tuyệt đối** tới file môi trường riêng. Không chép giá trị key vào command line hoặc chat. File có thể chứa cấu hình server khác nhưng runner chỉ nhập các tên sau, không nạp dotenv mở rộng:

- OPENAI_API_KEY / GEMINI_API_KEY.
- OPENAI_MODEL / GEMINI_MODEL.
- Các biến MODEL_QUICK, MODEL_THINK, MODEL_DEEP, MODEL_TUTOR của hai provider đó.

Không nhập auth/DB/admin/Node options từ file. Runner tự tạo auth secret tổng hợp và DB tạm. File trong public/docs/app bị từ chối. File nguồn, đường dẫn private và giá trị header không được lưu vào report.

Ví dụ PowerShell; người vận hành đặt biến đường dẫn tới file riêng đã có:

~~~powershell
$lumioProviderEnv = 'C:\PRIVATE\lumio-provider.env'
node scripts/evaluate-v7-live.cjs --live --suite=tutor --max-provider-calls=40 "--env-file=$lumioProviderEnv" --out=v7-live-tutor-final.json
~~~

Đây là10 kịch bản gia sư, mỗi bài tối đa3 gợi ý +1 yêu cầu full trả phí, thêm một request early-full phải bị chặn trước provider. Bài thiếu dữ kiện giữ hintCount0 và full409, có câu kiểm tra tham chiếu về chiều rộng; runner không tự kết luận model đã hỏi đúng hoặc không bịa diện tích chỉ từ cờ trạng thái. Phải đọc transcript/raw output. Lỗi/rejection được giữ nguyên, không tự thử lại để lấy kết quả đẹp.

**40 là hard cap tổng transport, không bảo đảm hoàn tất40 câu trả lời.** Fallback dùng cùng cap; lỗi mạng cũng tính một dispatch attempt. Nếu hết budget, phần chưa chạy không được gọi là PASS. Không có resume tự động. Chạy lại command với file mới là một lượt có thể tốn phí mới.

Runner ngừng bắt đầu case mới khi nhận PROVIDER_AUTH_ERROR, PROVIDER_RATE_LIMIT, PROVIDER_NOT_CONFIGURED, INVALID_MODEL_CONFIG hoặc AI_DISABLED. Case đó là BLOCKED, không tính thành lỗi chất lượng mô hình. Sau3 case kỹ thuật FAIL liên tiếp cũng dừng. Report ghi stoppedReason, summary.blocked, summary.notTested và danh sách notTestedCases; CLI trả exit code1 khi dừng sớm. Cap là PARTIAL_LIMIT, không phải benchmark FAIL. Không tự retry provider; fallback chỉ theo chính sách Router hiện có.

Mỗi case dùng một tài khoản tổng hợp riêng với ví Free200 credit mặc định. Mọi yêu cầu vẫn qua reserve/settle/refund và quota hiện tại. Trần HTTP ở transport bổ sung cho bảo vệ ledger, không thay ledger và không cho phép bỏ qua giới hạn tài khoản. Report lưu số dư/credit đang giữ trước và sau mỗi case; nếu còn giữ credit sau khi handler kết thúc thì dừng để điều tra. Không có dữ liệu hay số dư người dùng thật.

Đợt nội dung nhỏ chạy riêng sau khi được cho phép:

~~~powershell
node scripts/evaluate-v7-live.cjs --live --suite=content --languages=vi --max-provider-calls=8 "--env-file=$lumioProviderEnv" --out=v7-live-content-final.json
~~~

Mỗi ngôn ngữ có6 trường hợp: summary, cards, quiz, source-injection, **mục tiêu không liên quan nhưng nguồn vẫn hợp lệ**, nguồn mâu thuẫn20/30. Default chỉ vi. Có thể chọn danh sách vi,en,zh-CN,ja,ko; số ngôn ngữ lớn hơn cần cap và phê duyệt tương ứng. Case unrelated-goal-summary mong đợi HTTP200 và tóm tắt nguồn đã cung cấp, không bịa chi tiết về mục tiêu ngoài nguồn. Nó không chứng minh từ chối thiếu nguồn; coverage RAG no-hit thật được ghi riêng ở bộ kiểm tra offline. Conflict/injection vẫn cần review nội dung; exact quote không tự chứng minh đã xử lý mâu thuẫn hay ngăn mọi injection.

Các tùy chọn:

| Flag | Phạm vi |
| --- | --- |
| --live hoặc --check | Bắt buộc đúng một mode. Không tự chạy live. |
| --suite=tutor/content/all | Mặc định tutor. all vẫn dùng chung một cap. |
| --max-provider-calls=N | Số nguyên1–60; default tutor40/content8/all50. |
| --env-file=absolute-path | Bắt buộc cho live, cấm trong check. |
| --cases=linear,rational-domain | Chỉ ID đã có trong tập10 bài; mặc định đủ10 cho suite tutor. |
| --languages=vi,en | Chỉ mã trong corpus5 ngôn ngữ; mặc định vi. |
| --out=v7-live-name.json | Chỉ basename mới trong docs/v7/reports; không cho path/ghi đè. Bỏ flag để sinh tên duy nhất. |

## Nội dung report và giới hạn kết luận

- sourceHashes, HEAD/package/Node/schema khi thực sự chạy; HEAD không thay các hash working tree.
- providerHTTPAttemptLimit, routeRequests, transportAttempts, actualProviderHTTPAttempts và entry từng lần: provider/model yêu cầu, model response nếu có, HTTP status, responseReceived, dispatch flag, độ trễ, token/cached token/finish status.
- Raw output model tối đa64k ký tự mỗi attempt; trạng thái capture/truncation được ghi. Output bị từ chối vẫn nằm trong providerAttempts, gắn với case/phase, không lấy output cũ ghép thành lần chạy sạch.
- Transcript do handler trả, server hint progression/full gate, đáp án tham chiếu, verifier scope và exact source references. Không ghi Authorization, API key, cookie hoặc toàn bộ provider request headers.
- TECHNICAL_PASS_REVIEW_PENDING chỉ nói các kiểm tra kỹ thuật cụ thể đạt. Report tổng vẫn PARTIAL_REVIEW_REQUIRED cho tới khi có review nội dung riêng; semanticAccuracyClaim=false. Không tự đặt điểm sư phạm, tỷ lệ học tốt hơn hoặc chứng nhận giáo viên.
- Canary xuất hiện là một quan sát, chưa phân biệt được model tuân lệnh hay chỉ trích lại câu trong nguồn; cần đọc raw output. Mô hình từ chối an toàn có thể làm case không hoàn tất mà không chứng minh lỗi sư phạm.
- App hoàn credit không đồng nghĩa provider hoàn phí. Token không có giá/invoice đối soát; cap HTTP không phải cap USD. Lỗi mạng có thể xảy ra trước/sau provider nhận; responseReceived không khẳng định chi phí thực tế.
- Metadata/raw report phải ghi được trước mỗi lần gửi mới. Nếu disk lỗi sau provider trả, output có thể không được lưu đầy đủ; runner dừng và không tự gọi lại.
- Không có ảnh/âm thanh/thiết bị thật, public OAuth, off-host DR hoặc pilot trong runner này. Chúng cần bằng chứng riêng.
