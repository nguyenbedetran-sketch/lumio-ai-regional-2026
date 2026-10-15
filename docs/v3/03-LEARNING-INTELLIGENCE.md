# V3 — Bằng chứng kỹ năng, đề xuất và quyền điều khiển

Ngày: 15/10/2026. Phạm vi này nâng tiếp baseline V2; không thay báo cáo nghiệm thu cuối hoặc xác nhận deploy/nộp bài. Toàn bộ fixture/ảnh ở đây là **dữ liệu kiểm thử tổng hợp, không phải học sinh thật**.

## Thay đổi dùng được

- Quiz có phạm vi kỹ năng/độ khó tùy chọn cho lần luyện. Mặc định chỉ dùng alias chủ đề khớp chính xác và nhãn đã có; không suy diễn topic rộng thành kỹ năng chuẩn.
- Khi hoàn tất, `Attempt.skillEvidence` tùy chọn ghi ID lần làm, version taxonomy, fingerprint nội dung câu, nhãn và nguồn nhãn, lựa chọn/đúng sai, first-choice/previous-attempt. Fingerprint chỉ để chống đếm lặp, không phải chữ ký xác thực nguồn.
- Lịch sử cũ vẫn đọc/xuất/nhập được; thiếu snapshot thì chỉ hiển thị kết quả đã lưu. Không gán độ khó hiện tại ngược cho lần làm cũ.
- Bản đồ tương tác 7 kỹ năng Toán nền tảng có các edge tiên quyết khai báo tĩnh, kiểm tra ID/cycle. Chọn node hoặc nền tảng để xem dữ liệu tương ứng. Đây không phải curriculum đầy đủ hoặc chẩn đoán tự động.
- Hồ sơ tách kết quả quan sát với diễn giải tạm thời: số câu khác nhau, ngày UTC, giãn cách, kết quả theo nhãn khó, mẫu lặp, lỗi gần đây và khoảng mô tả. Lượt thích/streak/thời gian mở trang không trở thành năng lực.
- Gợi ý có thể ưu tiên lỗi ở kỹ năng/nền tảng, thu thập thêm bằng chứng hoặc bước tiếp trong graph khi tất cả nền tảng đủ tín hiệu. Chỉ mở học liệu thật có trong thư viện và gắn được kỹ năng, không tạo link giả.
- Có tắt riêng kỹ năng, tắt cá nhân hóa chung và xóa snapshot thật khỏi thư viện tài khoản trên thiết bị. Xóa snapshot giữ điểm quiz/đáp án/học liệu. Bản đồng bộ/xuất ở nơi khác được giải thích riêng trong privacy.
- Copy, nhãn kỹ năng, giới hạn và quyền điều khiển hỗ trợ 5 ngôn ngữ. Graph dùng bàn phím, layout điện thoại và reduced motion.

## Quy tắc diễn giải đã công bố

`SKILL_RULES` phiên bản `evidence-1`: cửa sổ 90 ngày; một nội dung câu chỉ đóng góp một lần chọn đầu độc lập, kể cả sao chép sang học liệu khác. Các lần từng làm vẫn hiện số lượt nhưng không nhân số câu độc lập. Lỗi gần đây lấy lần quan sát mới nhất của mỗi câu trong 14 ngày, nên sai lặp có thể gợi ý ôn mà không tăng độ tự tin giả.

“Kết quả ổn định hơn” cần ít nhất 8 câu khác nhau, 3 ngày, giãn ít nhất 7 ngày, có ít nhất 2 câu ở mỗi mức của 2 mức độ khó được khai báo, tỷ lệ đúng từ 80% và cận dưới khoảng mô tả từ 55%. Hai lỗi ở hai câu khác nhau gần đây ưu tiên nhãn “Nên ôn”. Dữ liệu ít còn “Chưa đủ bằng chứng” hoặc “Đang luyện”. Không có boolean `mastered`.

Các ngưỡng là **heuristic thử nghiệm, chưa hiệu chuẩn trên học sinh**. Khoảng Wilson 95% chỉ mô tả mẫu câu đã làm dưới công thức đã nêu; câu hỏi không được lấy ngẫu nhiên/hiệu chuẩn, nên không gọi đó là xác suất thành thạo cả chương trình. Nhãn độ khó và gán kỹ năng do học liệu/người dùng khai báo, không được xem là nhãn đã được giáo viên xác thực. First-choice chỉ quan sát trong app, không chứng minh chưa nhận trợ giúp nơi khác. Đáp án quiz vẫn có thể cần người kiểm tra.

## Dữ liệu, tắt và xóa

Hồ sơ được tính từ thư viện của tài khoản đang dùng; module không đọc namespace tài khoản khác, không gọi network/provider hoặc cấp quyền/credit. Snapshot là dữ liệu quiz cục bộ, có thể nằm trong bản đồng bộ văn bản nếu người dùng chủ động gửi; tính năng sync do module khác quản lý. Tắt ngừng tính/xếp gợi ý theo kỹ năng, không xóa quiz. Nút xóa loại bỏ `skillEvidence` và đã được UI kiểm tra với IndexedDB, không chỉ thay con số trên màn hình.

SyncPanel được bổ sung copy 5 ngôn ngữ và thông báo phục hồi thân thiện cho phiên/account đổi, xung đột, chỉnh sửa trong lúc sync, quá dung lượng, dữ liệu lỗi và lỗi bộ nhớ. Không hiện raw exception/payload tùy ý. Không đổi logic merge/replay/request của SyncPanel trong phần sửa copy này. Footer được sửa để phân biệt đăng nhập với thao tác đồng bộ chủ động. `/privacy` và `/data-deletion` mô tả local/cloud snapshot, RAG, embedding có đồng ý riêng và tóm tắt chạy nền 7 ngày; preview tạm có thể reset sớm hơn.

## Bằng chứng kiểm tra

| Phép kiểm tra | Kết quả | Phạm vi |
|---|---|---|
| `node tests/skill-evidence.cjs` | PASS 39 | Pure synthetic regression: metadata/legacy/repeat/difficulty/spacing/UTC/import/reset/taxonomy/reasons; thêm sync copy và không lộ lỗi raw |
| `node scripts/test-ui.cjs --v3-learning` | PASS 43 | Edge profile riêng, desktop và 390px: graph, uncertainty, first answer, quiz thật ghi snapshot, opt-out/reload, xóa IndexedDB giữ score, đổi account, sync copy/account header/5 locales |
| `pnpm typecheck` | PASS tại thời điểm tích hợp | Kiểm tra TypeScript toàn project; build/release cuối do root chạy lại sau các module còn lại |
| Regression liền kề | PASS: core9, concurrency10, recommendations23, study11 | Fixture/model giao dịch, không phải tải nhiều thiết bị hay người dùng thật |
| Người học thật/hiệu quả đề xuất | NOT TESTED | Chưa có người tham gia; dùng bộ pilot tự nguyện V2, không có kết quả trước/sau được tạo giả |
| Mobile native/voice hardware/public sync | NOT TESTED trong suite này | 390px là viewport browser, không phải Android/iPhone thật. Sync UI dùng response giả và không ghi server |

Chi tiết chính xác: [skill-evidence-unit.json](skill-evidence-unit.json), [qa-v3-learning-report.json](qa-v3-learning-report.json). UI suite không có provider call, không có server mutation hoặc runtime error. Nó không thay phép thử backend sync/RAG/jobs hoặc OAuth/public thật của các module khác.

## Ảnh thật từ ứng dụng với fixture được ghi nhãn

| Tệp | Nội dung |
|---|---|
| `qa-skills-desktop.png` | Màn hình đề xuất, graph và mẫu đủ nhiều câu/giãn cách |
| `qa-skills-map.png` | Crop nguyên graph đang tương tác, 7 node có trạng thái |
| `qa-skills-evidence.png` | Crop detail 8 câu/3 ngày/8 ngày/8 đúng, khoảng mô tả và cảnh báo |
| `qa-skills-mobile.png` | Một quiz hoàn thành từ UI cho 1/1 nhưng vẫn chưa đủ bằng chứng |
| `qa-sync-copy-mobile.png` | Opt-in và lỗi phiên thân thiện trên viewport390px, response401 giả |

Đã mở/xem crop detail và sync mobile; font, chữ tiếng Việt, khoảng cách và không tràn ổn. Các ảnh không chứng minh có học sinh tham gia hoặc hiệu quả học tập thật.

## File thay đổi chính

`lib/lumio/skill-evidence.ts`, `skill-taxonomy.ts`, `skill-copy.ts`; optional field/parser trong `types.ts`, `storage.ts`; optional control trong `recommendations.ts`; `components/lumio/skill-evidence.tsx`, `recommendations.tsx`, `study-tools.tsx`; `app/personalization.css`; `lib/sync/copy.ts`, lời hiển thị `components/lumio/sync-panel.tsx`; copy `lib/lumio/i18n.ts`, `i18n-extra.ts`; `app/privacy/page.tsx`, `app/data-deletion/page.tsx`; `tests/skill-evidence.cjs`, `tests/v3-learning.browser.js`; flag runner `--v3-learning` và `--v3-rag`. Root nối callback xóa trong `app.tsx`; không sửa quyền auth/billing/router vì module kỹ năng.

## Hạn chế và bước tiếp theo

Trạng thái mục tiêu Learning Intelligence rộng vẫn **PARTIAL**: mới là graph 7 kỹ năng, nhãn khai báo và thống kê minh bạch; chưa có taxonomy được kiểm định toàn chương trình, độ khó hiệu chuẩn, kiểm chứng học sinh hay mô hình dự báo năng lực được đánh giá ngoài mẫu. Chỉ nên mở rộng sau review nội dung, pilot tự nguyện và bài kiểm tra chuyển giao; không thêm mạng nơ-ron vào điểm kỹ năng chỉ để đổi tên công nghệ. Bộ ranker sở thích V2 vẫn là phần riêng.

Rollback: tắt điều khiển kỹ năng để quay về đề xuất V2; dữ liệu mới optional, reader cũ vẫn dùng điểm/đáp án. Có thể xuất thư viện trước khi đổi phiên bản. Không xóa lịch sử gốc để rollback, không tự chuyển AI hay thu phí.
