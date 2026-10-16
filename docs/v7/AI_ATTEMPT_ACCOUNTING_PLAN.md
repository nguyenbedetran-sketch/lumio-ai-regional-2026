# F02 tiếp theo · Provenance theo từng lần gọi provider

**Ghi chú cập nhật:** phần dưới giữ thiết kế trước triển khai. F02a1 text/multimodal đã được root phê duyệt sau đó; trạng thái/giới hạn và bằng chứng hiện hành nằm ở [PROVIDER_ATTEMPT_ACCEPTANCE.md](PROVIDER_ATTEMPT_ACCEPTANCE.md). Không hiểu các dòng DESIGN ONLY lịch sử bên dưới là trạng thái của journal đã triển khai, hoặc suy ra toàn bộ cost accounting đã hoàn thiện.

**PROVIDER JOURNAL: DESIGN ONLY — chưa triển khai hoặc migration mới.** Rà soát16/10/2026 trên HEAD9f4a376 và working tree D04. Đã đọc CHECKLIST.md, FEATURE_MATRIX.md và USAGE_OBSERVABILITY.md trước: F02 đã có breakdown request outcome theo model/task/user; không đề xuất thêm dashboard hay thay credit ledger để làm lại phần đó. Sau audit, root chỉ cho phép sửa riêng F02a0 unknown-vs-zero bên dưới, đã kiểm với transport giả;0 API thật. V6§29/41 vẫn PARTIAL về chi phí thực tế.

## Khoảng trống có bằng chứng trong mã

| Điểm chạm | Hiện trạng / tác động |
| --- | --- |
| lib/ai/router.ts:88,158,229,256–275,307 | Metadata usage được lấy trước validation nhưng chỉ trả khi thành công. Incomplete/invalid JSON/tutor/math/source rejection có thể đã tiêu token nhưng catch bên ngoài không có metadata. Một fallback thành công chỉ trả provider/model/usage cuối. Model hiện là tên yêu cầu cấu hình, chưa tách model tự khai trong response. |
| lib/server/store.ts:557 và schema.ts ai_usage | INSERT OR IGNORE với request_id UNIQUE là một outcome/logical request; không biểu diễn được hai dispatch. AIUsageInput không giữ total/reasoning token hoặc model-response provenance. Không đổi uniqueness này vì các caller đang dựa nó để dedupe outcome. |
| lib/ai/telemetry.ts:7 | Best-effort, lỗi ghi không phá kết quả/ledger. Đây là chủ đích đúng với log outcome, không phải bảo đảm ghi đủ chi phí. |
| app/api/ai/route.ts, teaching-ai.ts, summary-execution.ts | Reserve→provider→validate→settle; catch hoàn credit và log error thường thiếu model/usage đã quan sát. Bài giáo viên có ledgerRequestId namespace riêng; job có requestId theo part/lease sequence. Phải giữ những ranh giới này. |
| lib/rag/embeddings.ts:106; app/api/rag/search/route.ts:59,102 | Phát hiện ban đầu: query path dùng result.totalTokens \|\|0 nên thiếu usage bị ghi thành0. F02a0 đã sửa riêng sau phê duyệt: biến number/undefined và truyền trực tiếp totalTokens; storage nullable hiện có giữ unknown là null,0 có thật vẫn là0. Không thay embeddings/ledger/schema. |
| app/api/voice/route.ts | STT/TTS đi thẳng fetch, ngoài routeAI. Outcome không có token/duration pricing; TTS success không lưu model. Không được tự gán model hoặc ước đoán thời lượng/tokens từ kích thước audio. |
| usage-report.ts:24,43–87 | Scope rõ recorded-request-outcomes, null và costRecords minh bạch. Tổng này không được cộng thêm provider attempts rồi gọi là số request hoặc tính tiền hai lần. |
| billing-core.ts:239,347–406; ai-http-core.ts | Reservation/finalization/receipt bảo vệ credit; không chứng minh provider nhận/không nhận request hay hoàn tiền. Network timeout/rollback/cancel vẫn có thể có phí ngoài app. |

Runner live có ghi từng attempt trên tập tự soạn, nhưng global fetch wrapper/raw output của harness **không phải** instrumentation production và không được sao chép thành logger nội dung người học.

## Gia tăng nhỏ nhất đề xuất

**F02a0 — DONE_LOCAL, scope nhỏ.** RAG query giữ unknown token là undefined/null, giữ0 khi upstream thực sự gửi0. tests/v7-rag-billing.cjs hiện **32/32 PASS** gồm27 cũ+5 mới: omitted/observed0/positive/malformed string/negative; SQLite lưu đúng null hoặc số tương ứng, mỗi request vẫn2 credit, không còn hold, replay cùngUUID không gọi lại hoặc ghi thêm usage. Báo cáo [rag-billing.json](reports/rag-billing.json) dùng handlers/SQLite thật, OAuth/transport là fixture,0 provider thật. AIUsageInput vốn inputTokens optional và cột SQL nullable nên không có migration/type contract mới. Chưa chứng minh đầy đủ per-attempt cost.

**F02a1 — một journal metadata mới, không phải sổ cái tiền.** Nếu được phê duyệt, dùng migration tiếp theo (dự kiến17 khi16 vẫn mới nhất), không sửa migrations1–16. Một bảng ai_provider_attempts; chưa thêm rate-card/payment/invoice service. Không backfill attempt/token từ outcome lịch sử; ngày bắt đầu coverage phải hiển thị rõ.

| Nhóm trường đề xuất | Ràng buộc / nguồn |
| --- | --- |
| id, logical_request_id, component, dispatch_ordinal, user_id, reservation_id? | Server tạo; UNIQUE(logical_request_id,component,dispatch_ordinal). logical_request_id phải là ID guard/ledger hiện có; ordinal đếm **mỗi fetch** chứ không mỗi retry HTTP của browser. RAG embedding/generation tách component nhưng cùng root liên kết. |
| feature, provider, requested_model, response_model?, endpoint_kind | Closed enums và string có giới hạn; feature do server xác định như learner.quiz, teacher.lesson, rag.query_embedding, job.summary_part. Không nhận actor/feature/model override từ JSON client. Response model là metadata provider khai, không chứng nhận model chạy vật lý. |
| prepared_at, ended_at?, transport_outcome, http_status?, latency_ms?, safe_error_code? | prepared là “đã ghi trước điểm gọi”, **không chứng minh provider đã nhận**. Terminal outcome: response_received, network_unknown, timeout_unknown, cancelled_unknown. Crash sau prepare giữ unresolved/unknown, không đoán0 phí. Terminal CAS chỉ ghi một lần. |
| input_tokens?, output_tokens?, cached_tokens?, total_tokens?, reasoning_tokens?, usage_source/version | Integer không âm hoặc null;0 chỉ khi upstream báo0. Tổng/token thành phần không tự suy ra khi thiếu. Cache có thể là phần của input; không cộng lặp. Chỉ normalize field đã được adapter kiểm. |
| provider_request_id? | Chỉ identifier response được allowlist, giới hạn độ dài; không lưu cả headers. Không có thì null, không tự tạo thành ID provider. |

Chưa thêm số tiền mặc định. Estimate trong view mới là null/unpriced cho tới khi có rate snapshot được người vận hành chấp nhận; không sao giá ChatGPT subscription, giá gói59k/129k/249k hoặc số credit thành giá API. requested_model và response_model khác nhau/mất không tự chọn một rate. Usage duration/characters cho voice cần adapter/đơn vị đã xác minh riêng.

Bảng journal cập nhật prepare→terminal bằng CAS và khóa terminal tại API nội bộ; đây không phải append-only financial ledger hay hóa đơn bất biến. Nếu cần append-only event journal sau này, phải tách migration/threat model, không mặc nhiên sửa billing_ledger hoặc nhân bản nó. Giữ billing ledger hiện có làm nguồn chuẩn cho reserve/usage/refund.

## Thứ tự dispatch, lỗi ghi và settlement

1. Auth/canonical account/session/consent/feature guard như hiện tại; reserve credit trước transport. Context trace chỉ server truyền vào routeAI/adapter, không được validateInput deserialize từ client.
2. Cấp attempt ID/ordinal và ghi prepare bằng transaction ngắn, **không giữ transaction qua await/fetch**. Không ghi được trước dispatch thì dừng bằng lỗi accounting riêng, không gọi provider/fallback do lỗi ghi và hoàn reservation theo luồng hiện có. Không dùng Error thường khiến Router hiểu nhầm là lỗi mạng đủ điều kiện fallback.
3. Capture HTTP/model/usage đã normalize **trước** kiểm incomplete/schema/math/source. Nội dung phản hồi lỗi, prompt, quote, transcript, audio và vector không vào journal. HTTP200 có usage vẫn là response_received dù output sau đó bị loại; logical outcome/credit có thể error/refunded.
4. Nếu ghi terminal thất bại sau response, không undo request đã gửi, không tự fallback/retry chỉ vì logger lỗi. Giữ prepare unresolved để báo accounting incomplete, warning an toàn; nếu kết quả hợp lệ và ledger còn hoạt động thì không phá câu trả lời chỉ vì metadata best-effort. Nếu DB thực sự hỏng khiến settlement thất bại, dùng luồng lỗi/refund hiện có. Không hứa record usage đầy đủ khi storage lỗi.
5. Settle/refund vẫn ở billing-core. Callback tutor/source/job/receipt trong transaction không được mở BEGIN lồng. Journal không ghi credit delta thứ hai; join reservation/ledger để trình bày app charge state. Provider observation tách app validation/publication state.
6. Replay cùng UUID bị chặn trước transport nên tạo **0 dispatch mới**. Fallback tạo ordinal mới cùng logical request. Queue retry được phép tạo request ID/sequence mới như hiện tại, liên kết job/part bằng ID nội bộ không title; không reset attempt counter vì HTTP/worker restart. Không thêm retry mới trong phase này.
7. Network loss/cancel sau dispatch là provider receipt/cost unknown; app refund không sửa observation thành free. Lease recovery không tái gọi một completed request để “điền usage”. Receipt TTL7 ngày không được trở thành lý do bỏ tombstone/idempotency hoặc phát sinh lượt trả phí mới.

## Điểm chạm triển khai nếu được duyệt

| Chặng | File / tái sử dụng |
| --- | --- |
| Schema/core | Mới provider-attempt-core/schema; append schema.ts, compose store.ts, update canonical database-integrity.ts/backup required version **sau khi SQL chốt**. Backup13–16 thật vẫn phải inspect/read-only, restore-copy lên version mới riêng. |
| Text/multimodal | router.ts thêm typed optional server observer/context; instrument ngay runProvider trước fetch và sau body metadata. Giữ model/provider/fallback/max-output/validation đúng hiện trạng. Không patch global fetch trong app. |
| Caller attribution | app/api/ai/route.ts, teaching-ai.ts, summary-execution.ts truyền request/user/reservation/feature server; job-worker giữ sequence. Không làm vỡ test loader hoặc caller không có journal trong harness. |
| Embedding/voice | embeddings.ts và các route RAG/voice dùng cùng journal API qua adapter; không nhân bản schema/ledger. Hoàn chặng này mới được nói coverage cả provider paths; trước đó phải ghi rõ text-only. |
| Admin read | Mở rộng usage-report.ts và admin usage endpoint bằng scope enum mới recorded-provider-attempts dưới cùng ai.usage.read + intended account/no-store. Giữ view outcome hiện có và pagination; không gộp hai mẫu số. UI chỉ một breakdown hiện có với nhãn scope/coverage/unknown, không dashboard mới. |
| Privacy/ops | Update privacy/USAGE_OBSERVABILITY/runbook về linked account metadata và retention; snapshot chứa journal riêng. Tests và release source phải có helper schema mới. |

## Dữ liệu riêng, giới hạn và nghiệm thu theo chặng

- user_id/receipt/job/part ID là dữ liệu liên kết tài khoản, không phải anonymous. Không thu tên/email/class roster/điểm/anonymousExcerpt/source URL/nội dung. Chỉ admin hiện hành được xem breakdown; không thêm endpoint user tự chỉ định user_id/SQL group key. Sanitize provider model/ID/error, không trả raw headers/body ra UI.
- Trước triển khai phải chốt constants đo được: row-byte limit, số unresolved/records mỗi account/global, retention completed và purge batch có index. Đề xuất cửa sổ31 ngày cho view giữ nguyên, nhưng **chưa có retention policy mới được áp dụng**. Purge journal không được purge billing/receipt tombstone; unresolved có nhãn mất coverage, không biến unknown thành0. Nếu hết capacity, từ chối paid dispatch mới rõ ràng thay vì âm thầm bỏ prepare.
- Test1: SQLite tạm/migration version mới, rollback lỗi, schema13/14/15/16 backups/read-only và restore-copy; terminal CAS/id collisions/cross-account forged context. Không cần DB/cloud mới.
- Test2: intercept actual Router với first500→fallback200, incomplete+usage, valid-wire/invalid-schema, math rejection, missing usage,0/cache/total, response model khác/không có. Một row mỗi dispatch; old ai_usage vẫn một outcome. Không gọi provider thật.
- Test3: actual handler+ledger: revoke/cancel/source changed/commit rollback, lost ACK/sameUUID, concurrent duplicate, receipt expired+tombstone, queue new sequence. Credit delta đúng một lần; journal không gây transport thứ hai; callback không nested BEGIN.
- Test4: storage failure trước/giữa/sau response, process restart với prepare unresolved, metadata-only/no secrets, aggregation null/partial/priced coverage, admin/account/pagination/cache denial và retention boundary. Không gọi đây là pentest hoặc crash-host DR.
- Sau khi cả adapter paths freeze, root có thể cho phép một smoke rất nhỏ với nguồn tự soạn để chứng minh actual upstream metadata extraction. Không dùng smoke thay benchmark/pilot hoặc invoice reconciliation.

## Những điều phase nhỏ này chưa giải quyết

Chưa có approved rate cards/versioned prices, daily USD hard budget, provider-side idempotency proof, invoice/rebate reconciliation, realtime voice accounting, off-host persistence/DR hoặc multi-host quota. Journal hữu ích hơn về **attempt đã quan sát**, nhưng không thể biết hóa đơn của request timeout hoặc bảo đảm exactly-once tại provider. Render Free mất DB vẫn mất journal và bảo vệ local. Giữ F02 PARTIAL; không nâng nhãn V6 cost engineering thành COMPLETE chỉ từ migration hoặc token counters.
