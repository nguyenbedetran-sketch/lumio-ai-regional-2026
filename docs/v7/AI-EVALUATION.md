# V7: RAG đa ngôn ngữ và đánh giá AI offline

Phạm vi này nâng tiếp trên mã 3.2; không đổi provider/model, database, quyền API hoặc chính sách ba gợi ý. Không sử dụng API key hoặc gọi dịch vụ AI trong các phép thử dưới đây.

## Tìm kiếm từ khóa

`lib/rag/retrieval.ts` phiên bản token `unicode-bigram-1` giữ chữ Latin/tiếng Việt bỏ dấu như trước, đồng thời giữ kana hữu thanh và Hangul đã ghép. Từ khóa chữ Hán, Nhật và Hàn dùng các cặp ký tự liền nhau; một truy vấn một ký tự vẫn tìm được trong đoạn. Không nối cặp qua dấu câu, khoảng trắng hoặc chữ Latin. Đây là khớp từ khóa, không phải hiểu nghĩa, dịch thuật hoặc bộ tách từ được hiệu chuẩn.

Các giới hạn tường minh: tối đa 120.000 UTF-16 code units đầu vào tokenizer, 4.000 cho query, 8.192 token/đoạn, 40 query token khác nhau và 64 code units/token. RAG hiện có chỉ đọc chunk tối đa 1.600 ký tự cùng title, nên giới hạn token không cắt text nguồn RAG. Token chỉ dùng xếp hạng; text, offset, paragraph, page/slide/timestamp và exact quote vẫn lấy từ nguồn gốc. Thay tokenizer không tạo hoặc xác thực metadata nguồn.

`scripts/test-v7-rag-tokenizer.cjs` dùng actual tokenizer/ranker và một SQLite `:memory:` riêng. Bao phủ tiếng Việt/Anh/Trung/Nhật/Hàn, composed/decomposed, width/kana, supplementary Han, CJK–Latin trộn, bigram/stopword/no-hit, giới hạn và provenance/ACL. Không giả dữ liệu người học hoặc gọi provider.

## Corpus có phiên bản

`tests/fixtures/v7-ai-evaluation.v1.json`, ID `lumio-v7-authored-offline-1`, phiên bản 1.0.0, gồm:

- Năm bản ngôn ngữ vi/en/zh-CN/ja/ko, mỗi bản có nguồn tự soạn, query đúng/thiếu nguồn, hai nguồn số liệu mâu thuẫn, quote đúng/giả, payload injection, câu hỏi có đáp án xác định và một đầu ra câu hỏi lỗi.
- Mười một tình huống Toán: phương trình bậc nhất, phân thức/mẫu 0, hai nghiệm, nghiệm ngoại lai, thiếu nghiệm, phân số, phép toán không xác định, căn vô tỉ dạng gần đúng, phép biến đổi mất nghiệm, thiếu dữ kiện và phép nhân sai.
- Tổng 46 case; không phải 46 câu AI đã sinh hoặc 46 người dùng. Các câu/biến thể ngôn ngữ do người phát triển tự soạn, chưa có review giáo viên độc lập.

Runner `scripts/evaluate-v7-ai.cjs` tái sử dụng `lexicalRank`, `potentialConflict`, source serialization/citation validators, `validateInput`, router instructions, exact math và teaching content QA đang dùng trong sản phẩm. Không tạo bản validator, route hoặc provider riêng. Mọi fetch trong lượt đánh giá đều bị chặn; báo cáo ghi 0 actual provider requests và provider/model `null`.

Năm chiều đánh giá được tách riêng:

| Chiều     | Thực sự kiểm                                                                       | Chưa chứng minh                                       |
| --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Đáp án    | Đáp án phương trình tự soạn trong grammar hỗ trợ, đối chiếu độc lập                | AI thật trả đúng, chất lượng diễn đạt                 |
| Nguồn     | Keyword hits/no-hits, giữ hai nguồn mâu thuẫn số, exact quote và bỏ locator giả    | Entailment mọi claim, recall trên tài liệu thật lớn   |
| Toán      | Exact/invalid/unknown hữu hạn, điều kiện/đủ nghiệm/bước mất nghiệm                 | Toàn bộ chứng minh, hình học, khoa học/đơn vị         |
| Injection | Source nằm trong data, client không tự đặt context có quyền                        | Mô hình thực luôn chống injection, pentest            |
| Câu hỏi   | Schema, lựa chọn tương đương, đáp án sai, nhiều đáp án đúng, số học tường minh sai | Độ khó/độ tuổi/sư phạm/curriculum/ngữ nghĩa toàn diện |

Các đầu ra vẫn `review-required`/`draft-only`. Trích đoạn đúng không làm cho mọi câu trả lời đúng. Một phép toán mà checker trả `unknown` được ghi rõ là chưa xác minh, không được hiển thị như nghiệm đúng.

## Chạy và kết quả

Từ thư mục có `package.json`:

```powershell
node scripts/test-v7-rag-tokenizer.cjs
node scripts/evaluate-v7-ai.cjs
node scripts/test-v7-ai-evaluation.cjs
```

`node scripts/evaluate-v7-ai.cjs --check` chỉ kiểm/đọc, không ghi report. Runner không nhận `--live`, không đọc `.env.local`, không thay báo cáo lịch sử trong `docs/regional` hoặc `docs/teacher-workspace`.

Report mới ở `docs/v7/reports/rag-tokenizer.json`, `ai-evaluation.json`, `ai-evaluation.md` và `ai-evaluation-runner.json`. JSON ghi expected/actual, case/assertion riêng, giới hạn, corpus hash và hash module thực; base Git commit một mình không định danh các thay đổi V7 chưa commit. Thời gian đo là CPU validator local, không phải latency provider/SLO.

Lượt chạy đầu: tokenizer 20 kiểm tra PASS; corpus 46/46 case với 189 assertions PASS trong phạm vi xác định; regression của evaluator 11 PASS. Không cộng 46/189/11 thành một tỷ lệ AI chính xác. Report mới nhất là nguồn kết quả chính xác sau khi root chạy lại toàn bộ.

## Phép thử thật cần tách riêng

Các report provider V2/V3/3.2 là lịch sử riêng, không được gắn thành request của corpus V7. Root có thể dùng API/runner hiện có để thực hiện một lượt smoke có ngân sách sau khi tích hợp; ghi model/prompt/corpus phiên bản, request thực, token/latency thực, output nguyên bản đã khử nhận dạng, lỗi và người review. Đánh giá chất lượng ngôn ngữ, hỗ trợ claim bằng nguồn và hữu ích sư phạm cần đọc/chấm đầu ra thật. Pilot học sinh/giáo viên và hiệu quả học tập vẫn **NOT TESTED**.

Không có live provider, embedding mới, OAuth, deploy, thiết bị vật lý, load test hoặc người tham gia trong bộ offline này. Không coi kiểm thử serialization/context là chứng nhận an toàn toàn hệ thống.
