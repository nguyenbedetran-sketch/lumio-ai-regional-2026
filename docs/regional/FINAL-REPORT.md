# Lumio AI26A0048 — Báo cáo nâng cấp V2 + V3

Ngày: 15/10/2026. Source web: `3.0.0-regional.1`; source Flutter: `0.4.0+4`.

**BẢN NHÁP NGHIỆM THU.** Đã hoàn thành mã và kiểm tra giới hạn được ghi dưới đây; chờ chốt build, triển khai và kiểm tra công khai V3. Chưa nộp lần cuối. Kết quả V2 không tự chứng minh V3. PDF cũ là bản nháp V2, chưa phải báo cáo chốt V3.

## 1. Hiện trạng trước nâng cấp

V2 cần bật AI thật trên bản mạng, khóa lời giải phía server, nguồn đối chiếu, đề xuất dựa vào hoạt động học và minh chứng riêng. V3 mở rộng từ V2, giữ thư viện local, AI Router, credit ledger và gia sư; không viết lại hoặc giả định mọi tính năng đã thành production.

## 2. Nguyên nhân gốc

Chế độ demo cũ chủ động tắt AI; việc mở lời giải từng phụ thuộc dữ liệu client; nguồn thiếu metadata tin cậy; điểm tổng hoặc lượt thích chưa đủ để nói người học yếu kỹ năng nào. Sync, tác vụ dài và hạn mức cần trạng thái máy chủ có quyền sở hữu, CAS/lease và quyết toán nguyên tử. Xem [audit ban đầu](01-INITIAL-AUDIT.md) và [bàn giao V3](../v3/00-HANDOFF.md).

## 3. Chức năng nâng cấp và trạng thái

| Hạng mục | Trạng thái | Kết quả và giới hạn |
| --- | --- | --- |
| AI public V2 | PASS trong phép thử đã ghi | Google OAuth, bốn lượt gia sư để mở sau ba gợi ý và một bản đọc phát trong trình duyệt. [Report](public-v2-live-check.json). Không phải V3/device proof. |
| Nguồn và ingestion | PASS trong phạm vi hỗ trợ | PDF có trang thật, DOCX mục/đoạn, PPTX thứ tự slide; trích nguyên văn/HMAC gắn chủ sở hữu. Ảnh scan và Office math không an toàn không được giả là đã đọc. |
| RAG V3 | PARTIAL | BM25, hybrid tùy chọn, snapshot theo tài khoản/workspace, trích dẫn nhiều nguồn; 23 core +21 API +23 UI đã ghi. Corpus nhỏ, TTL bảy ngày, không phải vector production hoặc bảo đảm mọi câu trả lời đúng. |
| Math Verification | PARTIAL | 25 kiểm tra: BigInt hữu tỉ, điều kiện gốc, thay nghiệm và một số bước tường minh. Không chứng nhận toàn bộ lập luận văn xuôi/hình học/nhiều biến. |
| Learning Intelligence | PARTIAL | 39 unit, 43 UI; graph bảy kỹ năng, bằng chứng lần chọn đầu, chống đếm trùng, giãn cách, độ khó và lý do đề xuất. Ngưỡng tạm chưa hiệu chuẩn; một câu đúng không là thành thạo. |
| Web sync | PARTIAL | Opt-in, epoch/revision/CAS, idempotency, merge ba phía/outbox, quyền tài khoản và phục hồi lỗi. Free host có thể mất snapshot; không phải sync nhiều thiết bị thật đã chứng minh. |
| Mobile/Dart | PARTIAL | Source 0.4.0+4, analyze không lỗi và 71/71 Flutter tests. Bản web JSON riêng giữ metadata, chỉ sửa ghi chú; thư viện native vẫn riêng. Chưa build APK/IPA mới hoặc thử điện thoại thật. |
| Queue tóm tắt | PARTIAL | 23 kiểm tra SQLite: checkpoint, retry hữu hạn, hủy/fencing, quota/credit. Text ≤120k; YouTube ≤2 giờ theo thời lượng khai báo. Không là tác vụ 12 giờ bền vững/daemon luôn chạy. |
| Billing | PARTIAL | Kiểm tra quyền và reserve/settle/refund server. Giá đề xuất, checkout khóa; không thu tiền hoặc cấp credit trả phí thật. |
| Học sinh thật | NOT TESTED | Chưa tuyển, thu hoặc chấm pilot; protocol/phiếu/CSV trống đã chuẩn bị. |
| V3 public và nộp cuối | NOT TESTED tại thời điểm bản nháp | Root đang chốt toàn bộ regression/build/deploy; chỉ ghi PASS khi có report và đúng commit. |

## 4. Tệp thay đổi

Nhóm chính: `lib/tutor`, `lib/rag`, `lib/sync`, `lib/server` và API tương ứng; `lib/lumio/skill-*`, `components/lumio/skill-evidence.tsx`, `study-tools.tsx`, giao diện RAG/sync/queue, privacy/data-deletion, tests và guides. Mobile thêm `core/web_sync*`, `ui/web_sync.dart`, Settings mount, HTTP adapter và tests. Danh sách source chính xác theo commit/manifest chốt; không đưa `.env`, DB hoặc token vào gói.

## 5. Cấu hình và cách mở

Từ web có `package.json`, dùng Node 24 và pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
pnpm typecheck
pnpm test
pnpm build
node scripts/start-regional.cjs
```

Đọc [README](../../README.md), [HUONG-DAN](../../HUONG-DAN.md) và [AI-SETUP](../../AI-SETUP.md). Khóa OpenAI/Gemini/xAI và OAuth chỉ cấu hình server; không dùng `NEXT_PUBLIC_` cho secret. Bản thi Render Free dùng SQLite tạm, không phát sinh dịch vụ trả phí mới. Hạn mức dùng chung các process trỏ cùng DB, không phải nhiều máy có DB riêng.

Flutter: mở `outputs/lumio-mobile`, chạy `flutter pub get`, `flutter analyze`, `flutter test`, `flutter run -d <device-id>` với SDK/Android toolchain hợp lệ. Đọc README mobile. Đổi phiên bản source không có nghĩa đã phát hành APK mới.

## 6. Kiểm thử và phân loại bằng chứng

UI dùng học liệu/tài khoản tổng hợp và chặn provider. DB/HTTP tests thực thi SQLite/route với transport fixture. Đánh giá AI thật có report riêng; không cộng các suite thành số học sinh hoặc tỷ lệ AI đúng tổng quát. Bảng chốt regression toàn dự án sẽ lấy từ `final-status.json`, không tự cộng chạy lặp.

Xem [bàn giao V3](../v3/00-HANDOFF.md), [retrieval thật](rag-live-evaluation.json), [Math](../v3/02-MATH-VERIFICATION.md), [learning](../v3/03-LEARNING-INTELLIGENCE.md), [mobile](../v3/04-MOBILE-SYNC-SCOPE.md), [queue](../v3/04-BACKGROUND-SUMMARIES.md) và [operations](../v3/05-OPERATIONS-AND-SYNC.md).

## 7. Độ chính xác và lỗi còn lại

Kiểm tra nguồn khớp nguyên văn không tự chứng minh kết luận đúng. Bộ Toán có phạm vi parser/độ lớn và dạng bài giới hạn; ngoài phạm vi hiện chưa xác minh. Retrieval thật dùng corpus tự soạn rất nhỏ, không là benchmark trường học. Hội thoại AI V2 lưu cả lỗi và chạy lại; chưa có đánh giá độc lập. Chưa kiểm tra V3 công khai, tải toàn trường, xóa tài khoản/backup production toàn diện hoặc thiết bị Android/iOS thật tại thời điểm này.

## 8. Thử nghiệm người dùng

**NOT TESTED.** [STUDENT-PILOT](STUDENT-PILOT.md), [PILOT-FEEDBACK](PILOT-FEEDBACK.md) và `pilot-metrics.csv` được chuẩn bị để học sinh tự nguyện thực hiện. Không tạo người tham gia, chữ ký, điểm hoặc lời nhận xét giả. Cần đồng ý phù hợp, mã giả danh, đo trước/sau/bài tương tự và ghi đầy đủ mẫu số/thiếu dữ liệu.

## 9. Quyền riêng tư và an toàn

Học liệu gốc local; sync là bản JSON tự chọn, không gồm file media gốc. RAG lưu text/chunks và vector tối đa bảy ngày, embedding/query ra ngoài cần đồng ý riêng. Gia sư giữ đề ≤4.000 ký tự, tối đa100 lượt/digest tối đa bảy ngày. Queue giữ input và từng kết quả part tối đa bảy ngày; hủy không thu hồi dữ liệu provider đã nhận. Dọn khi truy cập/worker; không hứa xóa forensic hoặc thay provider. Render Free có thể reset sớm. Có tắt, xuất và xóa từng loại dữ liệu; chưa là production consent/data deletion toàn diện. Xem `/privacy` và `/data-deletion` trên app.

## 10. Giá đề xuất, chưa thu tiền

| Gói | Tháng | Năm | Credit dự kiến |
| --- | --- | --- | --- |
| Free | 0đ | 0đ | 200 dùng thử một lần |
| Plus | 59.000đ | 590.000đ | 600/tháng |
| Premium | 129.000đ | 1.290.000đ | 1.600/tháng |
| Pro | 249.000đ | 2.490.000đ | 3.500/tháng |

Packs minh họa: 25.000đ/250; 59.000đ/700; 119.000đ/1.600. Không giao dịch, nạp ví, tự gia hạn hoặc invoice giả. Giá chưa được kiểm chứng lợi nhuận/khả năng chi trả.

## 11. Chỉ mục ảnh và việc tiếp theo

Ảnh UI V2: `qa-source-*`, `qa-tutor-*`, `qa-personalization-*`, `qa-pricing-*`. Ảnh V3 trong `docs/v3`: `qa-rag-index-desktop.png`, `qa-rag-tutor-desktop.png`, `qa-rag-tutor-mobile.png`, `qa-skills-map.png`, `qa-skills-evidence.png`, `qa-sync-copy-mobile.png`. Đây là ảnh app thật với dữ liệu QA tổng hợp, không phải buổi học sinh thật. Ảnh `public-v2-*` thuộc phép thử public thật V2 riêng.

Chốt đúng commit V3, chạy regression/build/audit và kiểm tra public; cập nhật báo cáo PDF/Markdown bằng trạng thái có bằng chứng; kiểm tra GitHub/Drive không có bí mật và quyền mở link; sau đó nộp một lần cuối theo chỉ đạo người dùng. Chưa ghi đã nộp cho đến khi có xác nhận cổng.