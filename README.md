# Lumio AI 2.0 - Bản dự thi vòng khu vực AI26A0048

Không gian học từ tài liệu của bạn: gia sư hỏi từng bước, nguồn để đối chiếu, tóm tắt, flashcard, quiz, lịch ôn và đề xuất theo dữ liệu thực. Đợt này nâng trực tiếp **web 2.0.0-regional.1**. Source Flutter/Dart Android 0.3 và Windows/Electron 0.1 được giữ riêng; **không build lại hoặc xác nhận tương thích mới trong đợt này**.

Bản thi dùng hosting miễn phí, hạn mức và database tạm; chưa phải dịch vụ lưu trữ production. Có code không đồng nghĩa AI đã cấu hình, đã deploy hoặc đã nộp bài. Xem [báo cáo khu vực](docs/regional/FINAL-REPORT.md); nếu còn BẢN NHÁP thì trạng thái cuối chưa chốt.

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
- Bảng giá **đề xuất**: Free 0đ/200 credit một lần; Plus 59.000đ/600 credit mỗi tháng, Premium 129.000đ/1.600, Pro 249.000đ/3.500. Năm dự kiến bằng 10 tháng. Có gói bổ sung minh họa; checkout khóa, không thu tiền hoặc cấp credit trả phí. [Chi tiết](docs/regional/PRICING-PROPOSAL.md).

Giữ source các chức năng trước: tóm tắt toàn bộ nguồn/video theo từng phần, chương/sơ đồ tư duy, đọc tiếng dài từng phần, thu âm cuộc họp có cấp quyền, focus có chuông, thống kê hoạt động, sáng/tối/5 ngôn ngữ/mobile, quản trị và liên kết Google/Facebook. Xem [tóm tắt](docs/WHOLE-MEDIA-SUMMARY.md), [đọc tiếng](docs/READ-ALOUD.md), [thu âm](docs/MEETING-CAPTURE.md). Không mặc nhiên coi mọi phần cứng đã được kiểm tra lại.

## Chọn đúng chế độ

| Chế độ | Lệnh/cấu hình | Phạm vi |
| --- | --- | --- |
| Phát triển local | `pnpm dev` | Học liệu local; AI/OAuth cần env riêng; database server local |
| Public UI-only cũ | `render.yaml`, `node scripts/start-public-demo.cjs` | Tắt AI/tài khoản/database; không phải bằng chứng AI thật |
| Khu vực có AI | `render-regional.yaml`, `node scripts/start-regional.cjs` sau build | AI thật qua tài khoản/credit; SQLite tạm có thể reset |

```sh
pnpm install --frozen-lockfile
pnpm build
node scripts/start-regional.cjs
```

Lệnh cuối cần origin **HTTPS hợp lệ**, `LUMIO_COMPETITION_PREVIEW=true`, `LUMIO_PUBLIC_DEMO=false`, `LUMIO_AI_ENABLED=true`, Google OAuth, khóa phiên và AI phía server. Không thay `pnpm dev` để thử localhost HTTP. Nhập secret qua Environment của hosting, không commit vào YAML. Lệnh start từ chối cấu hình thiếu/xung đột; không tắt kiểm tra để ép chạy.

Giới hạn: 15 lượt/phút, 150 lượt/ngày UTC và 1 yêu cầu đang chạy/tài khoản. Chế độ khu vực thêm **200 lượt thử AI/ngày UTC và 3 đồng thời/instance**. Bộ đếm nằm trong bộ nhớ, reset khi restart; không phải ngân sách tiền tuyệt đối hay bộ đếm dùng chung nhiều instance. Credit được kiểm tra trước khi gọi, lỗi hoàn phần giữ. Hosting miễn phí không làm API AI miễn phí.

Render Free có thể mất SQLite khi ngủ/restart/deploy: tài khoản, liên kết, ví, nhật ký và phiên gia sư có thể reset. Học liệu trình duyệt lưu riêng; hãy xuất JSON và giữ file gốc. Phiên gia sư hết hiệu lực 7 ngày, dọn khi truy cập; host tạm có thể mất dữ liệu sớm hơn. Không bật cờ lưu trữ bền vững giả trên Render Free. Chưa có adapter PostgreSQL thật hoặc đồng bộ học liệu đám mây.

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
```

Test tự động có fixture/dịch vụ giả được ghi nhãn. Hội thoại AI thật local có báo cáo riêng, không thay OAuth/public hoặc kết quả học sinh. `pnpm services:check` gọi dịch vụ thật và có thể tính phí; không chạy lặp tự động. Kiểm tra bộ đề không bảo đảm mọi câu AI đều đúng. Thiết bị/micro/Zoom thật cần kiểm tra riêng.

- [Kiểm tra ban đầu](docs/regional/01-INITIAL-AUDIT.md) · [Nghiệm thu](docs/regional/FINAL-REPORT.md)
- [Cá nhân hóa/privacy/giá và UI](docs/regional/LEARNING-PRIVACY-VERIFICATION.md) · [Định vị có nguồn](docs/regional/PRODUCT-POSITIONING.md)
- [Pilot tự nguyện](docs/regional/STUDENT-PILOT.md) · [Phiếu trống](docs/regional/PILOT-FEEDBACK.md) · [CSV trống](docs/regional/pilot-metrics.csv)

**Thử nghiệm học sinh chưa thực hiện**, không có số người/điểm trước-sau giả. Báo cáo 1.x là lịch sử, không thay nghiệm thu 2.0. Chỉ dùng URL public/GitHub/Drive và trạng thái nộp đã được báo cáo cuối xác minh.

## Cấu trúc

`app/`: trang/API; `components/lumio/`: giao diện; `components/admin/`: quản trị; `lib/tutor/`: chính sách/Toán; `lib/ai/`: router/grounding/contracts; `lib/ingestion/`: trích xuất; `lib/server/`: tài khoản/quyền/SQLite/credit/phiên; `lib/lumio/`: dữ liệu/i18n/logic học; `tests/`: kiểm tra; `docs/regional/`: minh chứng.

Không dùng DeepSeek. Tên dịch vụ chỉ xuất hiện trong thiết lập/chính sách/quản trị kỹ thuật; công cụ học mang tên Lumio. Danh sách plugin hoặc schema tham khảo không đồng nghĩa mọi dịch vụ đã kết nối.
