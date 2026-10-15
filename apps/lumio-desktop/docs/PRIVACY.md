# Dữ liệu và quyền — Lumio AI Desktop 0.1.0

Lumio chỉ xin thu âm khi bạn nhấn bắt đầu. Bản Windows có thể nhận âm thanh của tất cả ứng dụng đang phát vào đầu ra âm thanh Windows, ví dụ Zoom, Teams, Meet hoặc video. Không có quyền theo dõi ứng dụng Zoom, đọc tài khoản Zoom, lấy mật khẩu hay tự tham gia cuộc họp.

Hộp thoại xác nhận xuất hiện cho mỗi lần lấy âm thanh máy tính. Cho phép micro không đồng nghĩa cho phép camera. Chính sách main process chỉ cho phép trang Lumio ở `http://127.0.0.1:3210`, đúng cửa sổ và top frame; yêu cầu display capture phải có user gesture. Trang khác và iframe không được cấp quyền. Camera, USB, vị trí, Bluetooth, thông báo và quyền không nhận diện đều bị từ chối.

Luồng hình ảnh tạm từ chính cửa sổ Lumio chỉ đáp ứng yêu cầu kỹ thuật của getDisplayMedia. Nó không được ghi vào file audio, không gửi chép lời và không chụp màn hình cuộc họp. Khi dừng, đổi trang thu âm hoặc đóng ứng dụng, luồng được giải phóng. Native menu Dừng thu âm gửi cùng sự kiện dừng về phần ghi âm.

Dữ liệu học và file thu âm dùng vùng riêng trên máy. Bản portable không kèm API keys, thông tin OAuth, database người dùng hay phiên đăng nhập trình duyệt. Backend không tải `.env` hoặc `.env.*` từ bản nguồn làm việc; chỉ nhận biến đã chọn và vị trí dữ liệu riêng trong AppData. AI trực tuyến chưa bật trong bản desktop; dùng bản web có cấu hình và tài khoản phù hợp để chép lời. Ghi âm local không tự gửi âm thanh tới AI.

Các liên kết HTTPS ngoài Lumio mở trong trình duyệt mặc định. Không chia sẻ cookie giữa Electron và trình duyệt. Google/Facebook OAuth dùng bản web, chưa có chuyển phiên từ trình duyệt vào app.

Để xóa toàn bộ dữ liệu desktop, đóng Lumio rồi xóa thư mục `%APPDATA%\Lumio AI Desktop` do app tạo. Xuất bản sao trước nếu cần giữ dữ liệu. Giữ file âm thanh theo cách bạn quản lý tài liệu cá nhân; bản ghi đã tải ra Downloads cần được xóa riêng.
