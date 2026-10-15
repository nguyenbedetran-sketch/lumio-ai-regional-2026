# Mở và dùng Lumio Teacher Workspace 3.2

Đây là source nâng cấp từ Lumio 3.1, giữ Next.js/React/TypeScript, NextAuth và SQLite. Không có dữ liệu học sinh mẫu được đưa vào sản phẩm. Flutter/Dart và Electron là dự án đi kèm; nâng cấp này tập trung vào website responsive, không phải APK/IPA/EXE mới.

## Mở code trên Windows

1. Giải nén ZIP, mở thư mục chứa `package.json` bằng VS Code. Không dùng Live Server hoặc mở file TSX trực tiếp.
2. Cài Node.js **24.x** và pnpm **11.25.0**. Kiểm tra bằng `node --version`, `pnpm --version`.
3. Trong terminal của thư mục đó:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

4. Mở `http://localhost:3000`. Dừng bằng Ctrl+C. Các lần sau chỉ cần `pnpm dev`.

Source sạch không chứa key, OAuth secret, cơ sở dữ liệu, tài khoản quản trị hoặc cookie của người làm dự án. Phần học cục bộ vẫn mở được; lớp học cần đăng nhập đã cấu hình, còn tạo nội dung AI cần key phía máy chủ. Không có cơ chế đăng nhập giả hay tự cấp quyền admin để bỏ qua bước này.

## Cấu hình và quyền

Xem [AI-SETUP.md](AI-SETUP.md) cho `.env.local`, OAuth và API. Không đưa `.env.local`, client secret hoặc SQLite lên GitHub. Dùng `pnpm auth:check` và `pnpm services:check` để kiểm tra cấu hình; có cấu hình không tự chứng minh provider đã chạy được.

Admin được bootstrap từ email Google đã xác minh trong `LUMIO_ADMIN_EMAILS`, sau một lần đăng nhập mới. Email công việc tự khai không cấp quyền. Người quản trị mở `/admin` → Xét duyệt giáo viên. Hồ sơ được duyệt chỉ là quyền ứng dụng theo khai báo, không phải chứng nhận nghề nghiệp.

- Người chưa được duyệt: `/teacher` giữ nguyên biểu mẫu đăng ký/trạng thái.
- Giáo viên được duyệt hoặc SUPER_ADMIN: `/teacher` mở Teacher Workspace.
- Học sinh: `/classroom` để nhập mã mời và làm bài.
- Quản trị tổ chức tương ứng OWNER/SCHOOL_ADMIN trong database hiện có; không phải quản trị hệ thống. Giáo viên cần được phân công vào lớp. SUPER_ADMIN cũng không mặc nhiên đọc mọi lớp.

## Luồng dùng đầu tiên

1. Tạo không gian giảng dạy, rồi vào **Lớp học** → tạo lớp, chọn môn/khối. Tên không gian không xác thực bạn là đại diện pháp lý của một trường cùng tên.
2. Trong lớp, tạo mã mời có hạn và số lượt dùng. Chỉ gửi mã tới người cần tham gia. Học sinh đăng nhập tài khoản của mình, mở `/classroom` và nhập mã. Một tài khoản không đồng thời làm giáo viên và học sinh trong cùng tổ chức.
3. Tạo nhóm từ thành viên đã vào lớp. Phân công đồng giảng viên bằng mã tài khoản người đó cung cấp trong Cài đặt; họ phải có quyền giáo viên hiện hành. Có thể thu hồi mã, gỡ học sinh/giáo viên hoặc quản lý vai trò tổ chức với quyền phù hợp.
4. Vào **Thư viện giảng dạy** để dán văn bản hoặc dùng bộ trích xuất PDF/DOCX/PPTX hiện có. Kiểm tra phần trích xuất; không coi ảnh scan hoặc công thức Office lỗi là đã đọc đủ. Nguồn chỉ có văn bản và metadata trên server, không phải kho giữ toàn bộ tệp gốc.
5. Trong **Studio bài giảng**, soạn giáo án thủ công hoặc chọn nguồn/chủ đề, khối, mục tiêu để tạo nháp AI. Chỉnh sửa, đối chiếu rồi xác nhận đã xem lại; công bố/chia sẻ là bước riêng. Có xuất văn bản/Markdown và in lưu PDF theo công cụ hiển thị.
6. Trong **Ngân hàng câu hỏi**, tạo trắc nghiệm hoặc tự luận. Nhập đáp án, lời giải, điểm và rubric phù hợp. AI hỗ trợ tạo trắc nghiệm theo mức độ; mọi kết quả đều là nháp. Xem lại trước khi xác nhận. Sửa nội dung làm mất trạng thái đã duyệt.
7. Trong **Bài tập**, chọn lớp, câu hỏi đã duyệt, cả lớp/nhóm/cá nhân và hạn nộp. Lưu nháp → duyệt → giao. Đề đã giao có snapshot riêng; sửa ngân hàng không tự sửa đề học sinh đã nhận. Đối tượng được chốt lúc giao; thêm thành viên vào lớp/nhóm sau đó không tự cấp lại bài cũ.
8. Học sinh mở bài, nhập đáp án và nộp, kiểm tra xác nhận máy chủ. Giao diện hiện tại cho nộp một lần; API có CAS cho cập nhật bài chưa chấm nhưng chưa có luồng sửa bài nộp trong giao diện. Hạn nộp và tùy chọn nhận bài muộn vẫn áp dụng; bài muộn được ghi rõ.
9. Trong **Chấm & nhận xét**, điểm trắc nghiệm tự tính chỉ là bản tạm. Giáo viên kiểm tra từng câu/rubric, sửa điểm/nhận xét trước công bố, xác nhận rồi **công bố**. Học sinh không nhận đáp án, rubric nội bộ hoặc điểm chưa công bố. API hỗ trợ điều chỉnh điểm đã công bố về bản chờ duyệt; giao diện hiện tại khóa phần đã công bố, chưa có nút mở lại để chỉnh.
10. **Tiến bộ học tập** tổng hợp các kết quả đã công bố. Dưới ba bài theo chủ đề là chưa đủ bằng chứng; đây chưa phải phép đo năng lực đã hiệu chuẩn. Lỗi quan sát được và gợi ý giảng lại không phải chẩn đoán nguyên nhân cá nhân.
11. **Thông báo & lịch** lưu thông báo nháp trước bước công bố; lịch gắn lớp. Đây là giao tiếp trong ứng dụng, không tự gửi email/SMS hoặc thông báo hệ điều hành.
12. **Báo cáo** cho xuất CSV và dùng hộp thoại In → Lưu PDF. Phạm vi chỉ từ lớp được cấp quyền. Tệp tải có thể chứa dữ liệu học tập, cần giữ riêng. **Cài đặt** phân biệt cài đặt tổ chức với tùy chọn cá nhân giáo viên và quyền riêng tư.

## Sử dụng AI có kiểm soát

Giáo viên chọn nguồn cụ thể và xác nhận gửi nội dung tới dịch vụ ngoài cho từng yêu cầu. Chỉ có chủ đề, khối, mục tiêu, độ khó và phần nguồn cần thiết được chuẩn bị; không tự gửi roster/tên/email/điểm/bài làm của lớp. Gợi ý nhận xét cần đoạn ngắn đã bỏ nhận dạng do giáo viên tự nhập. Bộ phát hiện thông tin riêng tư không bảo đảm ẩn danh hoàn toàn.

Trích dẫn chỉ được dựng từ học liệu có quyền truy cập và đoạn khớp; trang/slide/mốc thời gian chỉ khi metadata hoặc phụ đề cho phép xác định. Nội dung theo chủ đề không nguồn được ghi là suy luận AI. Bộ QA kiểm cấu trúc, trùng lặp và một số dạng Toán; không chứng nhận mọi lời giải hay giáo án đúng. Giáo viên phải đối chiếu trước khi dùng.

CRUD giữ requestId khi thử lại để tránh ghi trùng. Không tự lặp lại yêu cầu AI sau mất phản hồi. Nếu kết quả không phục hồi được, kiểm tra credit/lỗi trước khi chủ động tạo yêu cầu mới; tạo lại có thể dùng thêm credit. Không có key ở frontend hoặc trong source Flutter.

## Kiểm thử và build

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Báo cáo mới ở [docs/teacher-workspace](docs/teacher-workspace). Các báo cáo phải phân biệt handler/SQLite thật trong môi trường thử nghiệm với phiên tổng hợp, provider giả, provider thật và học sinh thật. Đếm kiểm tra không phải tỷ lệ AI trả lời đúng. Chạy test production HTTP trong một checkout sạch không chứa `.env*` riêng tư, sau khi build:

```powershell
pnpm test:teaching:production
```

Lệnh này tạo DB và JWT tổng hợp riêng, khởi động Next đã biên dịch trên port trống, không gọi OAuth/provider thật và không dùng tài khoản của bạn. Không chèn đường đăng nhập thử vào sản phẩm.

## Lưu trữ và phát hành

Migrations cộng thêm vào schema hiện có; khởi động lại server khi nâng source. Sao lưu SQLite bằng `scripts/database-snapshot.cjs` khi tệp DB còn, giữ bản sao riêng và thử khôi phục vào tệp mới. Không ghi đè DB đang chạy. Dữ liệu lớp không tự hết hạn bảy ngày như snapshot thư viện; xóa local/đăng xuất không xóa bài làm trên server.

Render Free có thể ngủ/reset; đây chưa là kho dữ liệu nhiều máy bền vững hoặc sổ điểm chính thức. Thanh toán thật vẫn tắt. APK/IPA/Windows mới, Facebook public review và thử nghiệm giáo viên/học sinh thật không được coi là đã kiểm tra chỉ vì source web mới hoạt động.

Source Flutter/Dart nằm ở `apps/lumio-mobile`, Electron ở `apps/lumio-desktop` trong gói chung. Mở chúng bằng cửa sổ VS Code riêng và theo README của từng dự án. Đồng bộ snapshot hiện có không đồng nghĩa mọi module Teacher Workspace đã có màn hình native riêng.

Bài thi khu vực đã được ghi nhận một lần ngày 15/10/2026. Báo cáo/biên nhận V3.1 là lịch sử riêng; đợt nâng cấp này không tự tạo lần nộp thứ hai.
