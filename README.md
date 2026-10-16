# Lumio AI 3.3 RC — nâng cấp V6 + V7 · AI26A0048

Source nhánh nâng cấp hiện tại **3.3.0-rc.1**, SQLite migrations **1–17**. V6 và V7 là một backlog chung trên ứng dụng hiện có. Có thêm bảo vệ request AI/credit lặp, ràng buộc tài khoản, điều hướng gọn, trích dẫn đúng vị trí, lịch sử điểm bất biến, luyện lại có cửa sổ thời gian và kiểm cấu trúc/backup database. Đọc [hướng dẫn mở và nghiệm thu](docs/v7/REVIEW_GUIDE.vi.md), [audit](docs/PRODUCT_AUDIT.md), [checklist đang làm](docs/v7/CHECKLIST.md) và [kết quả thực tế](docs/v7/ACCEPTANCE_REPORT.md). Bản RC này chưa đồng nghĩa hoàn thành mọi mục V6/V7; public, native và biên nhận thi có gate riêng.

Teacher Workspace3.2 được giữ và mở rộng: lớp/nhóm/mã mời/đồng giảng viên, giáo án/học liệu, ngân hàng câu hỏi, giao–nộp–chấm–công bố, phân tích kết quả đã công bố, thông báo/lịch, báo cáo và tùy chọn giáo viên. Các module học cá nhân V2/V3 vẫn có. [Tài liệu3.2 lịch sử](TEACHER-WORKSPACE.md) và [báo cáo3.2](docs/teacher-workspace) không phải bằng chứng cho bản RC mới. APK/IPA/EXE và thử nghiệm người học thật chưa được suy ra từ kiểm thử source web.

Khu vực mới: [Teacher Workspace](https://lumio-ai-demo.onrender.com/teacher), [Góc học sinh](https://lumio-ai-demo.onrender.com/classroom), [Admin](https://lumio-ai-demo.onrender.com/admin). Giáo viên chưa được duyệt vẫn thấy hồ sơ đăng ký. Đọc [báo cáo bàn giao3.2](docs/teacher-workspace/FINAL-REPORT.md) để phân biệt kiểm thử tự động, AI thật, public và các giới hạn còn lại.

Bản thi dùng hosting miễn phí, hạn mức và database tạm; chưa phải dịch vụ lưu trữ production. Public3.1 đã kiểm tra tại [lumio-ai-demo.onrender.com](https://lumio-ai-demo.onrender.com/): runtime **`6eabc3219f9298676bdd29ae0ee15a91b9593288`**, health200, Google OAuth thật, form/queue giáo viên và bốn lượt tutor; [AI](docs/v3/public-v31-live-check.json), [teacher](docs/v3/public-v31-teacher-check.json), [HTTP](docs/v3/public-v31-http-check.json). Không có hồ sơ hay quyết định giáo viên thật. **Cổng đã ghi nhận lần nộp số 1 lúc 15:05:41 ngày 15/10/2026 (UTC+7)**; [biên nhận và hai URL đã đối chiếu](docs/regional/REGIONAL-SUBMISSION-RECEIPT.json). Không nộp lần thứ hai khi cập nhật tài liệu/tệp tải tại cùng URL.

Đoạn trên là lịch sử public3.1 và biên nhận lần1; không chứng minh Teacher Workspace3.2 đã triển khai/được kiểm tra. Căn cứ mới nằm ở `docs/teacher-workspace`: báo cáo phải phân biệt handler/DB thật trong môi trường riêng, phiên tổng hợp, transport giả, provider thật và public. Hash runtime của lần thử được ghi riêng; không mặc nhiên là HEAD tài liệu. Xem [báo cáo khu vực trước](docs/regional/FINAL-REPORT.md) khi cần đối chiếu hồ sơ3.1.

## Mở code

Mở **thư mục có `package.json`** trong VS Code. Nếu ZIP chung có `web`, `mobile`, `desktop`, mở `web` để chạy website. Cài Node.js **24.x** và pnpm **11.25.0**; nếu chưa có pnpm: `npm install -g pnpm@11.25.0`. Mở lại terminal sau khi cài Node:

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000), dừng bằng Ctrl+C. Không mở `.tsx` trực tiếp hoặc dùng Live Server. Không cần key cho thư viện local, ghi chú, thẻ/quiz thủ công, kế hoạch và ôn tập. Thiếu cấu hình thì AI/đăng nhập không tự giả lập thành công.

Repository/ZIP không chứa `.env.local`, API/OAuth secret, `.data`, database, cookie hoặc dữ liệu cá nhân. Đọc [AI-SETUP.md](AI-SETUP.md) để cấu hình máy mới và [HUONG-DAN.md](HUONG-DAN.md) để sử dụng.

## Nâng cấp khu vực

- Gia sư giữ phiên theo tài khoản/bài ở máy chủ. Một gợi ý chính và một câu hỏi, chờ người học thử; máy chủ kiểm tra ít nhất 3 gợi ý thực chất trước lời giải đầy đủ. Đổi mode không bỏ qua khóa; lỗi/rỗng/lặp không được cộng.
- Nguồn có đoạn trích và vị trí khi trích xuất xác định được: trang PDF, mục/đoạn DOCX, slide PPTX. Không dùng số trang do AI đoán; backup không tự mang lại quyền tin vào metadata. Tệp quét và Office math phức tạp có giới hạn, không được âm thầm làm phẳng sai công thức.
- Quiz có giải thích, chủ đề, độ khó và nguồn; chặn lựa chọn/câu hỏi trùng. Thẻ hiện nguồn sau khi lật. Kiểm tra cấu trúc/nguồn không chứng minh mọi nội dung AI đều đúng.
- Đề xuất tách sở thích với kết quả quiz/câu sai theo chủ đề/lịch ôn; chọn chủ đề, độ khó, mục tiêu; đa dạng hóa và có lý do bằng số liệu. Xử lý trên thiết bị; có tắt/xóa phản hồi, tự đánh giá sau học riêng với lượt mở.
- Thông báo dữ liệu trước yêu cầu AI, `/privacy`, `/data-deletion` và xóa phiên gia sư chính chủ. Không gửi key tới trình duyệt hoặc ghi toàn học liệu/hội thoại vào log vận hành.
- Bảng giá **đề xuất đã chọn cho bản thi**: Free 0đ/200 credit một lần; Plus 59.000đ/600 credit mỗi tháng, Premium 129.000đ/1.600, Pro 249.000đ/3.500. Năm dự kiến bằng 10 tháng. Có gói bổ sung minh họa; thanh toán thật **chủ động tắt**. Checkout không thu tiền hoặc cấp credit trả phí. [Chi tiết](docs/regional/PRICING-PROPOSAL.md).

V3 bổ sung hồ sơ bằng chứng kỹ năng cục bộ, graph Toán nhỏ có tiên quyết khai báo, đề xuất theo lỗi/giãn cách/nhãn khó và mức bất định; một câu đúng không được coi thành thạo. Xem [phạm vi và kiểm thử](docs/v3/03-LEARNING-INTELLIGENCE.md). Trong Cài đặt có bản đồng bộ văn bản chủ động và chỉ mục tra cứu nhiều học liệu; không tự tải cả thư viện khi đăng nhập. Embedding ra ngoài mặc định tắt, cần cấu hình và đồng ý riêng. Tóm tắt chạy nền là đường riêng có consent: tối đa 120.000 ký tự hoặc 2 giờ YouTube /12 phần, lưu tiến độ trên server, có hủy/xóa; preview miễn phí không bảo đảm chạy liên tục. Các phần V3 không tự được tính PASS chỉ vì có source; xem báo cáo module và nghiệm thu cuối.

Giữ source các chức năng trước: tóm tắt toàn bộ nguồn/video theo từng phần, chương/sơ đồ tư duy, đọc tiếng dài từng phần, thu âm cuộc họp có cấp quyền, focus có chuông, thống kê hoạt động, sáng/tối/5 ngôn ngữ/mobile, quản trị và liên kết Google/Facebook. Xem [tóm tắt](docs/WHOLE-MEDIA-SUMMARY.md), [đọc tiếng](docs/READ-ALOUD.md), [thu âm](docs/MEETING-CAPTURE.md). Không mặc nhiên coi mọi phần cứng đã được kiểm tra lại.

## Hồ sơ và xét duyệt giáo viên

Sau đăng nhập, mở **Dành cho giáo viên** trên thanh bên hoặc `/teacher`. Điền tên khai báo, quốc gia/vùng lãnh thổ, tỉnh/thành, xã/phường, trường, cấp dạy và môn; xác nhận thông tin và đồng ý lưu. Có Mầm non; email công việc và link HTTPS là tùy chọn. Việt Nam dùng danh mục local có phiên bản và cho nhập tay khi cần; nước khác dùng tên địa phương khai tay. Không yêu cầu căn cước, ngày sinh hoặc dữ liệu học sinh.

Hồ sơ gửi lên luôn **chờ duyệt**. `/admin` → **Xét duyệt giáo viên** dành cho `ADMIN`/`SUPER_ADMIN`, có lọc/tìm/sắp xếp và ghi lý do trước duyệt/từ chối/thu hồi. `DEV` không xem hồ sơ này. Người phụ trách cấu hình `LUMIO_ADMIN_EMAILS` riêng ở server bằng email Google quản trị đã xác minh rồi đăng nhập lại; không nhập quyền admin từ trình duyệt. Admin không tự duyệt hồ sơ của mình. Không cần key hay dịch vụ xác minh trả phí mới cho module này.

Quyền giáo viên là credential riêng do admin xét **bản khai**, không phải xác minh danh tính/công tác chính thức; API luôn trả `identityVerified:false`. Nó không đổi USER thành ADMIN và không tự cấp quyền đọc dữ liệu học sinh. Teacher Workspace 3.2 có lớp, giao–nộp–chấm–công bố và phân tích kết quả; mỗi thao tác còn kiểm tư cách thành viên tổ chức và phân công lớp. Xem phạm vi và giới hạn trong [nghiệm thu](docs/teacher-workspace/ACCEPTANCE.md).

Hồ sơ/credential giáo viên không nằm trong sync/thư viện local và **không tự hết hạn sau bảy ngày, chưa có endpoint tự xóa hồ sơ**. Xóa dữ liệu trình duyệt/snapshot không xóa bản khai server; liên hệ người phụ trách dự án để xử lý. DB và backup có thể chứa thông tin khai báo riêng, không đưa vào GitHub/minh chứng. Render Free có thể mất cả hồ sơ và quyền. [Backend/27 kiểm tra](docs/v3/08-TEACHER-BACKEND.md) · [Nguồn danh mục](docs/v3/09-LOCATION-DATA.md).

UI tổng hợp và public là các phép kiểm tra riêng. Public3.1 đã mở form249 quốc gia/34 tỉnh và queue admin rỗng bằng Google OAuth thật; **không gửi hay duyệt hồ sơ giáo viên thật**. Approve/reject/revoke được thử trong fixtures riêng; không xác nhận danh tính/công tác chính thức.

## Chọn đúng chế độ

| Chế độ            | Lệnh/cấu hình                                                       | Phạm vi                                                       |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| Phát triển local  | `pnpm dev`                                                          | Học liệu local; AI/OAuth cần env riêng; database server local |
| Public UI-only cũ | `render.yaml`, `node scripts/start-public-demo.cjs`                 | Tắt AI/tài khoản/database; không phải bằng chứng AI thật      |
| Khu vực có AI     | `render-regional.yaml`, `node scripts/start-regional.cjs` sau build | AI thật qua tài khoản/credit; SQLite tạm có thể reset         |

```sh
pnpm install --frozen-lockfile
pnpm build
node scripts/start-regional.cjs
```

Lệnh cuối cần origin **HTTPS hợp lệ**, `LUMIO_COMPETITION_PREVIEW=true`, `LUMIO_PUBLIC_DEMO=false`, `LUMIO_AI_ENABLED=true`, Google OAuth, khóa phiên và AI phía server. Không thay `pnpm dev` để thử localhost HTTP. Nhập secret qua Environment của hosting, không commit vào YAML. Lệnh start từ chối cấu hình thiếu/xung đột; không tắt kiểm tra để ép chạy.

Giới hạn: 15 lượt/phút, 150 lượt/ngày UTC và 1 yêu cầu đang chạy/tài khoản. Chế độ khu vực thêm **200 lượt thử AI/ngày UTC và 3 đồng thời**. V3 lưu cửa sổ/lease vào SQLite: các process phải dùng chung đúng tệp DB; không bảo đảm nhiều máy có ổ riêng. Restart giữ counter nếu tệp DB còn; hosting reset DB thì counter cũng reset. Không phải ngân sách tiền tuyệt đối. Credit được kiểm tra trước khi gọi, lỗi hoàn phần giữ. Hosting miễn phí không làm API AI miễn phí.

Render Free có thể mất SQLite khi ngủ/restart/deploy: tài khoản, liên kết, ví, nhật ký, phiên gia sư, bản đồng bộ/chỉ mục, hàng đợi và hồ sơ/quyền giáo viên có thể reset. Học liệu trình duyệt lưu riêng; hãy xuất JSON và giữ file gốc. Phiên gia sư, bản đồng bộ, chỉ mục và tác vụ có thời hạn tối đa 7 ngày theo quy tắc module; dọn khi truy cập/worker, host tạm có thể mất sớm hơn. Quy tắc này không áp dụng cho bản khai/credential giáo viên hoặc nhật ký tài khoản. Bản đồng bộ không chứa file gốc, và chưa phải dịch vụ lưu bền vững. Không bật cờ storage bền vững giả trên Render Free. Chưa có adapter PostgreSQL thật.

Migration chạy khi khởi tạo store; bản source hiện tại yêu cầu **schema17/49 bảng/53 định nghĩa versioned/sáu guard cũ**. `/api/health` kiểm contract DB/version, không xác nhận AI đúng hay full build/public đã đạt. Backup CLI Node24 nhận genuine13–17 không migrate/seed nguồn; chỉ restored copy mở bằng runtime mới mới nâng17. Giữ snapshot và artifact cũ đúng cặp khi rollback; không xóa history/table để ép build cũ chạy. [Runbook17](docs/v7/OPERATIONS_RUNBOOK.md) có 23 kiểm tra ops local, giới hạn riêng tư/free host và [checkpoint16/21 lịch sử](docs/v7/reports/operations-integrity-schema16.json).

[Journal F02a1](docs/v7/PROVIDER_ATTEMPT_ACCEPTANCE.md) ghi metadata mỗi dispatch routeAI text/multimodal của learner/teacher/summary jobs; chưa gồm embedding/voice hoặc backfill lịch sử. Admin → Hoạt động AI tách **Kết quả yêu cầu** và **Từng lần gọi AI**, cùng quyền/account/no-store hiện có. Token/cost thiếu giữ null, chi phí chưa có rate luôn chưa biết; journal không thay ledger credit hoặc hóa đơn. Terminal quá 31 ngày dọn tối đa 200 mỗi prepare; unresolved không tự purge và có cap 64/account, 2048 toàn DB, 100000 tổng. Khối dung lượng đếm mọi tuổi; bản ghi còn giữ đầu tiên không phải ngày bật instrumentation. DB/backup có metadata tài khoản riêng, không công khai. Chưa suy ra full regression/build/public17 từ các gate module.

## Kiểm tra và minh chứng

```sh
pnpm typecheck
pnpm test
# Trong terminal khác, sau khi pnpm dev đã chạy:
pnpm test:http
# UI cũng dùng server localhost:3000 đó:
pnpm test:regional-tutor
pnpm test:regional-sources
pnpm test:regional-learning
node tests/skill-evidence.cjs
node scripts/test-ui.cjs --v3-learning
node scripts/test-ui.cjs --v3-rag
node scripts/test-ui.cjs --v3-sync
node tests/teacher-api.cjs
pnpm test:teacher-self
pnpm test:teacher-admin
# Fixture quản trị usage riêng, không gọi provider:
pnpm test:v7:usage-ui
```

Test tự động có fixture/dịch vụ giả được ghi nhãn. Hội thoại AI thật local có báo cáo riêng, không thay OAuth/public hoặc kết quả học sinh. `pnpm services:check` gọi dịch vụ thật và có thể tính phí; không chạy lặp tự động. Kiểm tra bộ đề không bảo đảm mọi câu AI đều đúng. Thiết bị/micro/Zoom thật cần kiểm tra riêng.

Hai lệnh UI giáo viên mở profile Edge riêng, dùng React/CSS của sản phẩm cùng hồ sơ/tài khoản/HTTP tổng hợp; không đăng nhập tài khoản thật hoặc cấp quyền giáo viên thật. `teacher-api.cjs` kiểm tra handler/quyền và SQLite tạm. `--v3-sync` kiểm tra DOM/IndexedDB/offline thật với HTTP fixture; không thay thử hai thiết bị hay sync public.

Đợt source3.1 đã chạy `pnpm test` **600 kiểm tra PASS**; UI riêng: admin giáo viên **31 +3 SSR**, form giáo viên **43 +4 SSR PASS**. [Compiled15 PASS](docs/v3/production-compiled-report.json) dùng bản cài sạch, route/workers thật, JWT/DB tổng hợp, không thay OAuth public. [Report admin](docs/v3/qa-teacher-admin-report.json) · [Report form](docs/v3/qa-teacher-self-report.json) · [Bàn giao](docs/v3/00-HANDOFF.md).

Public tutor3.1 thực hiện bốn lượt, giữ khóa ba gợi ý, chỉ lỗi x=6 và cho lời giải x=5 sau mở khóa. Bộ kiểm tra xác nhận nghiệm/điều kiện/tính đủ trong phạm vi hỗ trợ; các bước chỉ được kiểm tra một phần, số học hiển thị chưa kiểm tra. Không chứng nhận mọi lập luận, mọi bài Toán, trình bày model hoàn hảo hoặc hiệu quả học sinh. PDF/Linux và hybrid nhiều nguồn thật được ghi riêng ở [publicV3.0](docs/v3/public-v3-live-check.json), không cộng vào requestV3.1.

- [Kiểm tra ban đầu](docs/regional/01-INITIAL-AUDIT.md) · [Nghiệm thu](docs/regional/FINAL-REPORT.md)
- [Cá nhân hóa/privacy/giá và UI](docs/regional/LEARNING-PRIVACY-VERIFICATION.md) · [Định vị có nguồn](docs/regional/PRODUCT-POSITIONING.md)
- [Pilot tự nguyện](docs/regional/STUDENT-PILOT.md) · [Phiếu trống](docs/regional/PILOT-FEEDBACK.md) · [CSV trống](docs/regional/pilot-metrics.csv)

**Thử nghiệm học sinh chưa thực hiện**, không có số người/điểm trước-sau giả. Báo cáo1.x và audit trước nâng cấp là lịch sử; không thay nghiệm thu V2+V3. Chỉ dùng URL public/GitHub/Drive và trạng thái nộp đã được báo cáo cuối xác minh.

## Cấu trúc

`app/`: trang/API; `components/lumio/`: giao diện; `components/admin/`: quản trị/xét duyệt; `components/teachers/`: hồ sơ giáo viên; `lib/teachers/`: hợp đồng/danh mục; `lib/tutor/`: chính sách/Toán; `lib/ai/`: router/grounding/contracts; `lib/ingestion/`: trích xuất; `lib/server/`: tài khoản/quyền/SQLite/credit/phiên; `lib/lumio/`: dữ liệu/i18n/logic học; `tests/`: kiểm tra; `docs/regional/` và `docs/v3/`: minh chứng.

Không dùng DeepSeek. Tên dịch vụ chỉ xuất hiện trong thiết lập/chính sách/quản trị kỹ thuật; công cụ học mang tên Lumio. Danh sách plugin hoặc schema tham khảo không đồng nghĩa mọi dịch vụ đã kết nối.
