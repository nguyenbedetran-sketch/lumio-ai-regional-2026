# Mở và đánh giá Lumio AI 3.3.0-rc.1

Hướng dẫn cho đợt nâng cấp có phạm vi V7, cập nhật ngày 16/10/2026. Đây **không phải tuyên bố hoàn thành toàn bộ V6/V7**. Mã hiện tại giữ hệ thống cũ, bổ sung bảo vệ yêu cầu AI, tổ chức giao diện, định vị nguồn, lịch sử điểm và luyện lại có kiểm soát.

**Mốc triển khai:** tại lúc viết, [website public](https://lumio-ai-demo.onrender.com/) vẫn là bản 3.2; chưa có xác nhận triển khai 3.3.0-rc.1. Hãy dùng bản local và báo cáo đúng phiên bản để xem phần mới. **Lần nộp dự thi số 4 đang HELD**, chưa thực hiện; không sửa các biên nhận trước.

## 1. Mở source trên máy

Mở thư mục **có `package.json` phiên bản `3.3.0-rc.1`** bằng VS Code. Nếu gói tải có nhiều thư mục, chọn phần web. Dùng Node.js **24.x** và pnpm **11.25.0** theo hướng dẫn sẵn có của dự án.

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000), dừng bằng `Ctrl+C`. Không mở file `.tsx` trực tiếp hoặc dùng Live Server. Dev server chỉ nhận loopback; URL này không phải link truy cập từ điện thoại khác. `localhost` và `127.0.0.1` có kho trình duyệt/cookie riêng, nên dùng nhất quán một địa chỉ.

Không cần API key để thử thư viện local, ghi chú, thẻ/câu hỏi thủ công, kế hoạch và ôn tập. Đăng nhập, gia sư và tạo nội dung AI cần cấu hình thật; khi thiếu cấu hình, hệ thống báo chưa sẵn sàng, không giả lập thành công. Xem [AI-SETUP.md](../../AI-SETUP.md) để tạo `.env.local` riêng từ `.env.example`, cấu hình OAuth/AI và khóa phiên. Không đưa file này, database, cookie hoặc khóa bí mật vào GitHub/minh chứng. Không chạy các lệnh kiểm tra dịch vụ thật chỉ để xem UI: chúng có thể phát sinh phí.

## 2. Đi theo một vòng học

**Nguồn → hiểu → luyện tập → ôn lại**, bắt đầu bằng một đoạn bài học tự soạn, không có thông tin cá nhân.

1. Ở `/`, chọn **Thêm nội dung**, dán bài hoặc nhập file được hỗ trợ. Thư viện mới có thể trống; sản phẩm không tự tạo lớp, học sinh hay điểm mẫu.
2. Mở bài. Trong **Studio học tập**, chọn tác vụ phù hợp như tóm tắt/chương/bản đồ kiến thức. **Hỏi Lumio** dành cho câu hỏi tiếp nối; gia sư cần các lượt gợi ý và người học thử trước khi mở lời giải đầy đủ. Đổi chế độ không bỏ qua điều kiện máy chủ.
3. Dùng thẻ hoặc bài luyện tập, xem giải thích và nguồn, rồi tự đánh giá để ôn lại. Tiến bộ/đề xuất dựa trên hoạt động đã ghi nhận; không đồng nghĩa đã chứng minh người học tiến bộ hay thành thạo toàn bộ môn.

Để đối chiếu câu trả lời, chọn **Xem vị trí trích dẫn**. Nguồn đang mở đưa về đúng đoạn; PDF dùng trang có căn cứ trích xuất. **Mở nguồn gốc** là hành động riêng. Trích dẫn từ chỉ mục nhiều tài liệu mở **đoạn trích snapshot có tên nguồn riêng**, không tự đưa sang một tài liệu khác đang mở. Không có vị trí xác định thì không được hiểu là AI đã xác nhận số trang/thời gian. Trích đoạn khớp nguồn cũng chưa chứng minh câu trả lời đúng.

**Cài đặt** giữ tên, ngôn ngữ giao diện/AI, giao diện sáng/tối và chuyển động ở mức đầu; ba mục nâng cao được thu gọn: **Thiết bị & đồng bộ**, **Tra cứu nhiều học liệu**, **Khả năng AI hiện có**. Đăng nhập không tự đồng bộ toàn thư viện. Đồng bộ văn bản/lập chỉ mục cần lựa chọn riêng; embedding gửi ra dịch vụ ngoài mặc định tắt và cần đồng ý riêng. Đọc thông báo dữ liệu trước mỗi tác vụ AI. Lưu ý các bản nháp chưa lưu được giữ khi chọn tiếp tục chỉnh sửa; bỏ bản nháp là quyết định rõ ràng, không phải lưu tự động.

## 3. Giáo viên và học sinh

| Địa chỉ      | Cách vào và phạm vi                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/teacher`   | Khách/người chưa được duyệt thấy cổng đăng ký giáo viên. Sau đăng nhập, khai thông tin và chờ quản trị xét duyệt. Giáo viên được duyệt hoặc SUPER_ADMIN mới vào workspace; quyền tổ chức/lớp vẫn được kiểm tra riêng. |
| `/classroom` | Học sinh đăng nhập, nhập mã lớp giáo viên cấp, nhận đúng bài và xem kết quả của mình sau công bố. Không dùng quyền giáo viên để giả làm một học sinh khác.                                                            |
| `/admin`     | Cần tài khoản được cấp quyền ở server và phiên xác thực gần đây. Không có nút tự nâng quyền. Xét bản khai giáo viên không phải xác minh danh tính/công tác chính thức.                                                |

Trong workspace giáo viên, chọn/tạo không gian rồi **Lớp học → tạo lớp → mã mời**. Soạn nguồn, giáo án hoặc câu hỏi; xem lại và duyệt trước khi giao. Các công cụ còn lại vẫn nằm trong nhóm **Công cụ khác** và **Cài đặt**; không bị xóa để làm menu ngắn hơn. Muốn thử nhiều vai trò, dùng các tài khoản kiểm thử riêng, không đưa hồ sơ/lớp thật vào tài liệu public.

**E1 — chấm và lịch sử:** mở **Chấm & nhận xét**, kiểm tra điểm từng câu, nhận xét và xác nhận trước khi lưu. **Công bố kết quả** là thao tác riêng. Bài đã công bố chỉ đọc cho đến khi bấm **Bắt đầu điều chỉnh điểm**; cần lý do và xem lại trước khi lưu bản chấm mới. Điều chỉnh tạm rút kết quả hiện tại cho đến khi công bố lại. **Lịch sử điểm** giữ các lần lưu/công bố; bản kế thừa thiếu người/thời gian thật được ghi rõ là chưa biết. Học sinh chỉ thấy lịch sử kết quả đã công bố của chính mình, không thấy lý do nội bộ hoặc bản chấm nháp.

**E2 — cửa sổ và luyện lại:** trong bản nháp bài tập, có giờ mở, hạn nộp và giờ đóng cứng; nhập theo giờ thiết bị, gửi lên dưới dạng UTC. Sau khi giao, đề, người nhận và cửa sổ được giữ cố định. Trước giờ mở, học sinh chỉ thấy metadata, chưa thấy đề/hướng dẫn; chỉ mở được khi máy chủ trả quyền nộp. Tải lại trạng thái quanh giờ mở/đóng; đổi đồng hồ thiết bị không cấp thêm quyền.

Sau khi bài gốc đã được giáo viên chấm, tại dòng bài nộp chọn **Cho luyện lại**, nhập cửa sổ, lý do, xác nhận cảnh báo cùng đề và xem lại trước khi cấp. Máy chủ quyết định điều kiện, tối đa **3 lần tính cả bài gốc**, và không cấp chồng một lần chưa giải quyết. Bài luyện lại đã nộp nhưng chưa chấm vẫn cần giáo viên xử lý dù đã đóng. Bản hiện tại chỉ cho học sinh nộp một lần qua UI; không có nút thay thế bài đã nộp.

Lần mới dùng **cùng bộ câu hỏi đã chốt**, giữ bài/kết quả cũ riêng. Đáp án đã xem không thể thành bí mật trở lại: đây là **luyện tập**, không phải đề thi mới bảo mật hay thi có giám sát. Muốn đề khác, tạo và duyệt bài mới. Chỉ lần hiện đang công bố mới nhất của mỗi bài gốc/học sinh được chọn cho phân tích; ba lần cùng bài không thành ba bài đánh giá độc lập. CSV vẫn giữ các dòng lịch sử và có cột bài gốc/lần làm/dấu dùng trong phân tích. Xem [hợp đồng E2 và giới hạn](assessment-retakes-contract.md).

## 4. Báo cáo quản trị mới

Trong `/admin` → **Hoạt động AI**, mở **Phân tích sử dụng theo model, tính năng và tài khoản**, chọn phạm vi rồi bấm **Xem báo cáo**. Đây là truy vấn chỉ đọc, không gọi provider. Chi phí/token chưa đo hiển thị chưa biết, không coi là 0. Thống kê chỉ gồm **kết quả yêu cầu đã ghi nhận**; có thể thiếu lượt fallback và token tiêu thụ khi lỗi, không phải hóa đơn hay sổ đầy đủ mọi lần gọi. Credit/hoàn credit dùng sổ giao dịch riêng. [Phạm vi observability](USAGE_OBSERVABILITY.md).

## 5. Xem minh chứng đúng loại

[Báo cáo UI tích hợp](qa-integrated-ui-report.json) ghi phiên bản `3.3.0-rc.1`, hash/timestamp báo cáo và 18 ảnh mới. Các bộ kiểm tra dùng React/CSS thật, browser storage thật, **tài khoản/lớp/đáp án và HTTP tổng hợp có nhãn**, không seed dữ liệu giả vào database sản phẩm:

| Luồng                                  | Báo cáo / ảnh tiêu biểu                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Giáo viên                              | [129 kiểm tra browser](qa-teaching-ui-report.json) · [desktop](qa-teaching-desktop.png) · [mobile](qa-teaching-mobile.png)                                   |
| Học cá nhân, nguồn, bản nháp, Settings | [172 kiểm tra browser](qa-learner-ui-report.json) · [vị trí trích dẫn](qa-learner-source-location.png) · [Settings mobile](qa-settings-mobile.png)           |
| E1 lịch sử/chấm lại                    | [47 kiểm tra browser](qa-grade-history-ui-report.json) · [giáo viên](qa-grade-history-teacher-desktop.png) · [học sinh](qa-grade-history-student-mobile.png) |
| E2 luyện lại                           | [36 kiểm tra browser](qa-practice-ui-report.json) · [xác nhận](qa-practice-review-desktop.png) · [kết quả cũ/mới](qa-practice-student-mobile.png)            |

Tổng là **384 kiểm tra browser**; 32 kiểm tra SSR/pure dùng chung chỉ tính một lần, thêm 15 kiểm tra E2 và 6 kiểm tra cú pháp learner. Có kiểm tra tại 7 độ rộng 320–1440px, bàn phím, focus, giữ/bỏ nháp, mất phản hồi và đổi tài khoản. Muốn chạy lại trong profile Edge cô lập:

```powershell
pnpm test:v7:ui
```

Không cần mở dev server cho bốn fixture này. Chạy sẽ cập nhật báo cáo/ảnh local của chúng. Không dùng ảnh lỗi ban đầu có tên `current-failure`/`initial-failure` làm ảnh nghiệm thu cuối. Handler/SQLite/quyền/rollback có các bộ kiểm tra riêng; UI giả lập không thay chúng. [Nghiệm thu và giới hạn](ACCEPTANCE_REPORT.md) · [Ma trận phạm vi](FEATURE_MATRIX.md).

**Không suy rộng:** các ảnh/report trên không chứng minh OAuth thật, chất lượng provider thật, URL public mới, điện thoại vật lý, thanh toán, học sinh thật hay hiệu quả học tập. Các bằng chứng lịch sử 3.1/3.2 không tự trở thành xác nhận 3.3. Runner provider V7 hiện mới được chuẩn bị/kiểm tra offline; [quy trình riêng](LIVE_PROVIDER_ACCEPTANCE.md). Cần bằng chứng đúng phiên bản cho từng bước trước phát hành/nộp.

## 6. Những phần chưa được nhận là hoàn tất

- Chưa xác nhận triển khai public 3.3, cập nhật gói nguồn/minh chứng public và lần nộp 4. Hướng dẫn này không thực hiện các bước đó.
- Chưa có pilot người học thật, đánh giá giáo viên độc lập, xác minh quan hệ/người giám hộ hoặc đo trước–sau/ghi nhớ dài hạn.
- Thanh toán thật, ký/phát hành APK/IPA/EXE, kiểm tra thiết bị/micro/Zoom thực, tích hợp LMS/push và thi bảo mật đầy đủ chưa được nhận nghiệm thu trong đợt này.
- Chưa có database/object storage/worker production bền vững đa máy. **Hosting miễn phí có thể mất SQLite khi ngủ, restart hoặc deploy**, gồm tài khoản/quyền, credit, phiên, sync/chỉ mục, lớp, bài nộp và lịch sử điểm. Học liệu trình duyệt là kho riêng: xuất JSON và giữ file gốc; JSON thư viện không phải backup toàn bộ dữ liệu lớp/server. Lịch sử điểm/lý do không tự có TTL 7 ngày hay endpoint tự xóa. Không tải database/backup chứa hồ sơ hoặc điểm thật lên nơi công khai.

Đọc [quy trình thăm dò kết quả học tập chưa thực hiện](LEARNING_OUTCOMES_PROTOCOL.vi.md), [runbook vận hành](OPERATIONS_RUNBOOK.md) và [checklist đang theo dõi](CHECKLIST.md) khi đánh giá bước tiếp theo. Trạng thái triển khai và nộp chỉ đổi sau khi có kết quả xác minh riêng.
