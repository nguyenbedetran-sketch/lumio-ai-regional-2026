# Teacher Workspace: kế hoạch triển khai và tiêu chí nghiệm thu

Ngày bắt đầu: 15/10/2026 (UTC+7). Phạm vi là nâng cấp source Lumio hiện có, không thay nền tảng hoặc nộp lại bài thi.

## Audit ban đầu

- Web: Next.js 15.5.27 App Router, React 19.1.8, TypeScript; Node 24.19.0, pnpm 11.25.0. Có Motion và Lucide; không cần thêm thư viện dashboard.
- Dữ liệu: `node:sqlite`, WAL, transaction và migration phiên bản 11. Có users, organizations, memberships; không tạo hệ thống tài khoản song song.
- Xác thực: NextAuth Google/Facebook, danh tính canonical, phiên có version, chặn origin và account binding ở các endpoint hồ sơ giáo viên.
- Quyền: system role USER/DEV/ADMIN/SUPER_ADMIN; vai trò tổ chức OWNER/SCHOOL_ADMIN/TEACHER/STUDENT/PARENT. Quyền giáo viên dựa trên credential còn hiệu lực sau xét duyệt bản khai. ORGANIZATION_ADMIN ánh xạ vào OWNER/SCHOOL_ADMIN, không cấp quyền quản trị hệ thống.
- `/teacher` hiện có hồ sơ đăng ký và trạng thái duyệt; chưa có lớp/bài tập/chấm điểm. Phải giữ onboarding này cho người chưa được cấp quyền.
- AI: dùng router, kiểm soát tài khoản/credit/hạn mức, logging, trích dẫn và bộ xác minh Toán hiện có. Nội dung mới của giáo viên không được tự công bố.
- Public audit đọc ngày 15/10: `/api/health` HTTP200, version `3.1.0-regional.1`, mode competition-preview; `/api/config` có cấu hình đăng nhập/AI/voice. Đây là kiểm tra cấu hình, không chứng minh mọi nhà cung cấp hoạt động hoặc mọi kết quả đúng.
- Render Free và SQLite một máy vẫn có rủi ro mất dữ liệu khi triển khai/khởi động lại. Không bật hosting trả phí, không nhận tiền thật.

## Giai đoạn 1: quyền, lớp và dashboard

Tạo migration cộng thêm; lớp thuộc tổ chức, người dùng thuộc membership rõ ràng. Giáo viên chỉ truy cập lớp được phân công; quản trị tổ chức chỉ trong tổ chức của mình. SUPER_ADMIN không mặc nhiên đọc mọi bài làm. Tạo lớp, mời bằng mã lưu băm, tham gia lớp, nhóm và đồng giảng viên phải có tác dụng trên dữ liệu máy chủ. Dashboard tính từ dữ liệu đã lưu, ban đầu là trạng thái rỗng.

Nghiệm thu: phiên hết hạn/thu hồi credential, học sinh giả mạo giáo viên, đọc/sửa chéo lớp/tổ chức, tạo/tham gia, xung đột revision và retry cùng requestId. Đóng/mở lại DB vẫn giữ dữ liệu khi tệp còn nguyên.

## Giai đoạn 2: học liệu, giáo án và giao bài

Thư viện và ngân hàng câu hỏi có metadata, tìm kiếm, quyền chia sẻ. AI Lesson Studio dùng nguồn có quyền truy cập hoặc chủ đề/khối/mục tiêu nhập rõ, lưu nháp chỉnh sửa. Phân biệt trích đoạn thật và suy luận AI. Câu hỏi phải qua kiểm tra cấu trúc/trùng lặp/nội dung và xác nhận của giáo viên. Giao bài tạo snapshot, đối tượng lớp/nhóm/cá nhân và hạn nộp; sửa ngân hàng không làm đổi bài đã giao.

Nghiệm thu: nguồn không có quyền, trích dẫn bịa, câu hỏi sai/trùng/không phù hợp, sửa sau khi duyệt làm mất trạng thái duyệt. Cả API và giao diện phải chặn giao nháp chưa duyệt. Không gửi danh sách/tên/email học sinh ra dịch vụ AI.

## Giai đoạn 3: bài làm, chấm và phân tích

Học sinh chỉ xem bài được giao và bài làm của mình. MCQ tự chấm vào trạng thái tạm; tự luận/rubric có giáo viên quyết định. Giáo viên sửa/xác nhận rồi chủ động công bố. Đáp án, rubric nội bộ và điểm chưa công bố không nằm trong payload học sinh. Mọi sửa điểm/công bố được ghi nhật ký. Analytics dựa trên điểm đã xác nhận, nêu số lần/bằng chứng; không gọi một lần kiểm tra là năng lực ổn định.

Nghiệm thu: nộp đúng đối tượng/hạn, giới hạn retry, không nộp hộ, không lấy answer key từ GET/POST lỗi, không thấy điểm trước công bố, không đọc dữ liệu tổ chức khác. Kiểm tra chấm và công bố xuyên suốt bằng handler thật/SQLite riêng; tài khoản tổng hợp phải được ghi rõ.

## Giai đoạn 4: giao tiếp, xuất và chất lượng giao diện

Thông báo/lịch trong ứng dụng theo lớp, báo cáo CSV chống công thức và bản in lưu PDF, thiết lập giáo viên. Desktop/tablet/mobile dùng chung API; trạng thái đang tải, rỗng, lỗi và mất kết nối có hướng xử lý. Chuyển động tôn trọng reduced-motion và không cản trở thao tác.

Nghiệm thu: xuất chỉ dữ liệu có quyền, không rò đáp án trong bản xuất học sinh; keyboard/nhãn/390px/768px/desktop, không lỗi runtime. Sau mỗi giai đoạn lưu báo cáo thực tế, không chuyển mục sang PASS khi mới có UI hoặc fixture.

## Bàn giao

Chạy regression, typecheck, build production và kiểm thử luồng liên vai trò với dữ liệu nhập trong môi trường thử nghiệm. Đánh dấu rõ mock provider, OAuth tổng hợp, AI thật, thiết bị thật và thử nghiệm người học. Bàn giao ZIP source, hướng dẫn chạy/cấu hình, danh sách thay đổi, báo cáo và ảnh kiểm tra. Giữ nguyên biên nhận dự thi đã có; không tự nộp lần thứ hai.
